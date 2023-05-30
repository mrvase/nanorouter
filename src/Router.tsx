import React from "react";
import { createHistory } from "./history";
import {
  Action,
  History,
  Location,
  NavigateOptions,
  Path,
  Route,
  RouteMatch,
  To,
} from "./types";
import { createKey, resolveTo } from "./utils";
import { getMatches } from "./matches";

export const HistoryContext = React.createContext<History>(null!);

export const NavigationContext = React.createContext<NavigateFunction>(null!);

export const RouterStateContext = React.createContext<{
  location: Location;
  action: Action;
}>(null!);

export function useLocation(): Location {
  return React.useContext(RouterStateContext).location;
}

export function useAction(): string {
  return React.useContext(RouterStateContext).action;
}

export const PathContext = React.createContext<Path>(null!);

export function usePath(): Path {
  return React.useContext(PathContext);
}

interface NavigateFunction {
  (to: To, options?: NavigateOptions): Path;
}

export function useNavigate() {
  return React.useContext(NavigationContext);
}

export function Router({
  children,
  window,
  routes,
}: {
  children?: React.ReactNode;
  window?: Window;
  routes: Route[];
}) {
  const [history] = React.useState<History>(createHistory({ window }));

  let [state, setState] = React.useState({
    action: history.action,
    location: history.location,
  });

  React.useLayoutEffect(() => history.listen(setState), [history]);

  let activeRef = React.useRef(false);
  React.useEffect(() => {
    activeRef.current = true;
  });

  const pathname = state.location.pathname;

  let navigate: NavigateFunction = React.useCallback(
    (to: To, options: NavigateOptions = {}) => {
      const { navigate = true, replace = false, state = null } = options;
      let path = resolveTo(to, pathname);
      const action = replace ? history.replace : history.push;

      if (navigate && activeRef.current) {
        action({
          ...path,
          key: createKey(),
          state,
        });
      }

      return path;
    },
    [pathname]
  );

  return (
    <HistoryContext.Provider value={history}>
      <RouteConfigContext.Provider value={routes}>
        <RouterStateContext.Provider value={state}>
          <PathContext.Provider value={state.location}>
            <NavigationContext.Provider value={navigate}>
              {children}
            </NavigationContext.Provider>
          </PathContext.Provider>
        </RouterStateContext.Provider>
      </RouteConfigContext.Provider>
    </HistoryContext.Provider>
  );
}

export function RelativeRouteNavigator({
  children,
}: {
  children?: React.ReactNode;
}) {
  const prevType = React.useContext(RoutesTypeContext);

  const path = usePath();
  const route = useRoute();

  const [parentRoute, nestedPathName] = React.useMemo(() => {
    if (prevType === null) {
      return ["", path.pathname];
    } else if (prevType === "nested") {
      const parentRoute = route.accumulated.slice(0, -route.segment.length);

      const nestedPathName = path.pathname.slice(parentRoute.length);

      return [parentRoute, nestedPathName];
    } else {
      return ["", route.segment];
    }
  }, [prevType, path, route]);

  const nextPath = React.useMemo(
    () => ({ ...path, pathname: nestedPathName }),
    [path, nestedPathName]
  );

  const parentNavigate = useNavigate();

  const navigate = React.useCallback(
    (to: To, options: NavigateOptions = {}) => {
      let path = `${parentRoute}${
        typeof to === "string" ? to : to.pathname ?? ""
      }`;
      return parentNavigate(path, options);
    },
    [parentNavigate, parentRoute]
  );

  return (
    <PathContext.Provider value={nextPath}>
      <NavigationContext.Provider value={navigate}>
        {children}
      </NavigationContext.Provider>
    </PathContext.Provider>
  );
}

export function ParallelRouteNavigator({
  children,
  pathname,
  matches,
  index,
}: {
  children?: React.ReactNode;
  pathname: string;
  matches: RouteMatch[];
  index: number;
}) {
  const path = usePath();

  const nextPath = React.useMemo(
    () => ({ ...path, pathname }),
    [path, pathname]
  );

  const parentNavigate = useNavigate();

  const navigate = React.useCallback(
    (to: To, options: NavigateOptions = {}) => {
      const next: { segment: string }[] = [...matches];
      next[index] = {
        segment: typeof to === "string" ? to : to.pathname ?? "",
      };
      const path = next.map((el) => el.segment).join("");
      return parentNavigate(path, options);
    },
    [parentNavigate, matches, index]
  );

  return (
    <PathContext.Provider value={nextPath}>
      <NavigationContext.Provider value={navigate}>
        {children}
      </NavigationContext.Provider>
    </PathContext.Provider>
  );
}

const RouteConfigContext = React.createContext<Route[]>(null!);

export const useRouteConfig = () => React.useContext(RouteConfigContext);

const RouteContext = React.createContext<RouteMatch>(null!);

export const useRoute = () => React.useContext(RouteContext);

const useMatches = () => {
  const config = useRouteConfig();
  const path = usePath();
  return React.useMemo(() => {
    const matches = getMatches(path.pathname, config, { withConfig: true });
    return matches;
  }, [path.pathname]);
};

export function NestedRoutes() {
  const matches = useMatches();

  return (
    <RelativeRouteNavigator>
      <RoutesTypeContext.Provider value="nested">
        {matches.reduceRight((children, el, index) => {
          return (
            <RouteConfigContext.Provider value={el.config.subroutes ?? []}>
              <RouteContext.Provider key={index} value={el}>
                <el.config.render params={el.params}>
                  {children}
                </el.config.render>
              </RouteContext.Provider>
            </RouteConfigContext.Provider>
          );
        }, null as React.ReactNode)}
      </RoutesTypeContext.Provider>
    </RelativeRouteNavigator>
  );
}

export const RoutesTypeContext = React.createContext<
  "parallel" | "nested" | null
>(null);

export const createEvents = (id: string) => {
  const dispatch = (detail: { type: string; payload: any }) =>
    document.dispatchEvent(
      new CustomEvent(`routes:${id}`, {
        detail,
      })
    );

  return {
    move(payload: { from: number; to: number }) {
      dispatch({ type: "move", payload });
    },
    open(payload: { path: string; index: number }) {
      dispatch({ type: "open", payload });
    },
    close(payload: number) {
      dispatch({ type: "close", payload });
    },
  };
};

function ParallelRoutingListener({
  id,
  matches,
  keys,
  setKeys,
}: {
  id: string;
  matches: RouteMatch[];
  keys: string[];
  setKeys: (ps: string[]) => void;
}) {
  const navigate = useNavigate();

  React.useEffect(() => {
    const handleAction = (
      ev: Event & { detail?: { type: string; payload: any } }
    ) => {
      const { type, payload } = ev.detail!;
      const array: [string, string][] = matches.map((el, index) => [
        el.segment,
        keys[index],
      ]);

      if (type === "move") {
        const from = payload.from;
        const to = payload.to;
        const [removed] = array.splice(from, 1);
        array.splice(to, 0, removed);
      } else if (type === "open") {
        const { path, index } = payload;
        array.splice(index + 1, 0, [path, createKey()]);
      } else if (type === "close") {
        const index = payload;
        array.splice(index, 1);
      } else {
        return;
      }

      console.log(array);

      navigate(array.map((el) => el[0]).join(""));
      setKeys(array.map((el) => el[1]));
    };

    document.addEventListener(`routes:${id}`, handleAction);
    return () => {
      document.removeEventListener(`routes:${id}`, handleAction);
    };
  }, [id, matches, keys, navigate]);
  return null;
}

export function ParallelRoutesImpl({ id }: { id?: string }) {
  const matches = useMatches();

  const [keys, setKeys] = React.useState<string[]>([]);
  if (keys.length !== matches.length) {
    setKeys(matches.map(() => createKey()));
  }

  return (
    <>
      {id && (
        <ParallelRoutingListener
          id={id}
          matches={matches}
          keys={keys}
          setKeys={setKeys}
        />
      )}
      {matches.map((el, index) => {
        return (
          <ParallelRouteNavigator
            key={keys[index] ?? index}
            pathname={el.segment}
            matches={matches}
            index={index}
          >
            <RouteConfigContext.Provider value={el.config.subroutes ?? []}>
              <RouteContext.Provider key={index} value={el}>
                <el.config.render params={el.params} />
              </RouteContext.Provider>
            </RouteConfigContext.Provider>
          </ParallelRouteNavigator>
        );
      })}
    </>
  );
}

export function ParallelRoutes({ id }: { id?: string }) {
  return (
    <RelativeRouteNavigator>
      <RoutesTypeContext.Provider value="parallel">
        <ParallelRoutesImpl id={id} />
      </RoutesTypeContext.Provider>
    </RelativeRouteNavigator>
  );
}

import React from "react";
import {
  usePath,
  useRoute,
  useNavigate,
  RelativeMatchesContext,
  useMatches,
} from "../Router";
import { RelativePathContext, RelativeNavigationContext } from "../Router";
import { To, NavigateOptions, RouteMatch } from "../types";

export const RoutesTypeContext = React.createContext<
  "parallel" | "nested" | null
>(null);

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

  const matches = useMatches();

  const nextMatches = route
    ? matches.find((el) => el === route)!.children
    : matches;

  return (
    <RelativeMatchesContext.Provider value={nextMatches}>
      <RoutesTypeContext.Provider value="nested">
        <RelativePathContext.Provider value={nextPath}>
          <RelativeNavigationContext.Provider value={navigate}>
            {children}
          </RelativeNavigationContext.Provider>
        </RelativePathContext.Provider>
      </RoutesTypeContext.Provider>
    </RelativeMatchesContext.Provider>
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
    <RoutesTypeContext.Provider value="parallel">
      <RelativePathContext.Provider value={nextPath}>
        <RelativeNavigationContext.Provider value={navigate}>
          {children}
        </RelativeNavigationContext.Provider>
      </RelativePathContext.Provider>
    </RoutesTypeContext.Provider>
  );
}

/*
export const useMatches = () => {
  let config: { subroutes?: Route[] } = useRoute()?.config;
  if (!config) {
    const subroutes = useHistory().routes;
    config = { subroutes };
  }
  const path = usePath();
  return React.useMemo(() => {
    const matches = getMatches(path.pathname, config.subroutes ?? [], {
      withConfig: true,
    });
    return matches;
  }, [path.pathname]);
};
*/

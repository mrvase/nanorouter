import React from "react";
import { usePath, useRoute, useNavigate, useHistory } from "../Router";
import { PathContext, NavigationContext } from "../Router";
import { getMatches } from "../matches";
import { To, NavigateOptions, RouteMatch, Route } from "../types";

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

  return (
    <RoutesTypeContext.Provider value="nested">
      <PathContext.Provider value={nextPath}>
        <NavigationContext.Provider value={navigate}>
          {children}
        </NavigationContext.Provider>
      </PathContext.Provider>
    </RoutesTypeContext.Provider>
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
      <PathContext.Provider value={nextPath}>
        <NavigationContext.Provider value={navigate}>
          {children}
        </NavigationContext.Provider>
      </PathContext.Provider>
    </RoutesTypeContext.Provider>
  );
}

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

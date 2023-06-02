import React from "react";
import {
  History,
  HistoryState,
  Location,
  NavigateOptions,
  Path,
  RouteMatch,
  To,
} from "./types";
import { createKey, resolveTo } from "./utils";

export const HistoryContext = React.createContext<History>(null!);
export const useHistory = () => React.useContext(HistoryContext);

export const NavigationContext = React.createContext<
  (to: To, options?: NavigateOptions) => Path
>(null!);
export const useNavigate = () => React.useContext(NavigationContext);

export const RouterStateContext = React.createContext<HistoryState>(null!);
export const useLocation = () => React.useContext(RouterStateContext).location;
export const useAction = () => React.useContext(RouterStateContext).action;
export const useRouterIsLoading = () =>
  React.useContext(RouterStateContext).isLoading;

export const PathContext = React.createContext<Path>(null!);
export const usePath = () => React.useContext(PathContext);

export const RouteContext = React.createContext<RouteMatch>(null!);
export const useRoute = () => React.useContext(RouteContext);

export function Router({
  children,
  history,
}: {
  children?: React.ReactNode;
  history: History;
}) {
  const state = React.useSyncExternalStore(...history.sync());

  let activeRef = React.useRef(false);
  React.useEffect(() => {
    activeRef.current = true;
  });

  const pathname = state.location.pathname;

  let navigate = React.useCallback(
    (to: To, options: NavigateOptions = {}) => {
      const { navigate = true, replace = false, state = null } = options;
      let path: Path & Partial<Location> = resolveTo(to, pathname);

      if (navigate && activeRef.current) {
        path.key = createKey();
        path.state = state;
        (replace ? history.replace : history.push)(path as Location);
      }

      return path as Location;
    },
    [pathname]
  );

  return (
    <HistoryContext.Provider value={history}>
      <RouterStateContext.Provider value={state}>
        <PathContext.Provider value={state.location}>
          <NavigationContext.Provider value={navigate}>
            {children}
          </NavigationContext.Provider>
        </PathContext.Provider>
      </RouterStateContext.Provider>
    </HistoryContext.Provider>
  );
}

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

export const RouterStateContext = React.createContext<HistoryState>(null!);
export const useLocation = () => React.useContext(RouterStateContext).location;
export const useAction = () => React.useContext(RouterStateContext).action;
export const useRouterIsLoading = () =>
  React.useContext(RouterStateContext).isLoading;

export const RelativeNavigationContext = React.createContext<
  (to: To, options?: NavigateOptions) => Path
>(null!);
export const useNavigate = () => React.useContext(RelativeNavigationContext);

export const RelativePathContext = React.createContext<Path>(null!);
export const usePath = () => React.useContext(RelativePathContext);

export const RelativeMatchesContext = React.createContext<RouteMatch[]>(null!);
export const useMatches = () => React.useContext(RelativeMatchesContext);

const RouteContext = React.createContext<
  [id: string | undefined, match: RouteMatch][]
>(null!);

export function useRoute(id?: string): RouteMatch {
  const ctx = React.useContext(RouteContext);
  if (!ctx) return undefined as never;
  if (!id) return ctx[ctx.length - 1][1];
  const result = ctx?.find((el) => el[0] === id)?.[1];
  if (!result) {
    throw new Error(
      `useRoute is called with id "${id}", but no routes with that id is found.`
    );
  }
  return result;
}

export const RouteContextProvider = ({
  children,
  id,
  match,
}: {
  id: string | undefined;
  match: RouteMatch;
  children?: React.ReactNode;
}) => {
  const prev = React.useContext(RouteContext);

  const next = React.useMemo(() => {
    return [...(prev ?? []), [id, match]] as [
      id: string | undefined,
      match: RouteMatch
    ][];
  }, [prev, id, match]);

  return <RouteContext.Provider value={next}>{children}</RouteContext.Provider>;
};

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
        <RelativeMatchesContext.Provider value={state.matches}>
          <RelativePathContext.Provider value={state.location}>
            <RelativeNavigationContext.Provider value={navigate}>
              {children}
            </RelativeNavigationContext.Provider>
          </RelativePathContext.Provider>
        </RelativeMatchesContext.Provider>
      </RouterStateContext.Provider>
    </HistoryContext.Provider>
  );
}

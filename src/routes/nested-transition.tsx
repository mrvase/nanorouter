import React from "react";
import { RouteContextProvider, useMatches } from "../Router";
import { RelativeRouteNavigator } from "./utils";
import { RouteMatch } from "../types";

export const TransitionContext = React.createContext<string>(null!);
export const useRouteTransition = () => React.useContext(TransitionContext);

function usePrevious<T>(value: T) {
  const [{ current, prev }, setState] = React.useState<{ current: T; prev: T }>(
    { current: value, prev: value }
  );
  let isReset = false;
  if (current !== value) {
    setState({ prev: current, current: value });
    isReset = true;
  }
  return [prev || value, isReset] as [T, boolean];
}

export function NestedTransitionRoutesImpl({ id }: { id?: string }) {
  const matches = useMatches();
  const [prevMatches, isReset] = usePrevious(matches);

  const depth = Math.max(prevMatches.length, matches.length);

  const firstNonMatch = React.useMemo(() => {
    const index = prevMatches.findIndex(
      (x, i) => x.segment !== matches[i]?.segment
    );
    return index >= 0 ? index : depth;
  }, [prevMatches, matches]);

  if (isReset) {
    return null;
  }

  const render = (
    match: RouteMatch | undefined,
    props: { exit?: boolean; replace?: boolean },
    children: React.ReactNode
  ) => {
    if (!match || !match.config.render) return null;
    return (
      <RouteTransition key={match.accumulated} {...props}>
        <RouteContextProvider match={match} id={id}>
          <match.config.render params={match.params}>
            {children}
          </match.config.render>
        </RouteContextProvider>
      </RouteTransition>
    );
  };

  type Accumulator = [current: React.ReactNode, prev?: React.ReactNode];

  const children = Array.from({ length: depth }).reduce(
    (children: Accumulator, _, i): Accumulator => {
      const index = depth - 1 - i;
      const currentMatch: RouteMatch | undefined = matches[index];
      const prevMatch: RouteMatch | undefined = prevMatches[index];

      if (index >= firstNonMatch) {
        // handles two paths

        const replace =
          prevMatches.length === matches.length && firstNonMatch === index;

        return [
          render(prevMatch, { exit: true, replace }, [children[0]]),
          render(currentMatch, { replace }, [children[1]]),
        ];
      }

      // firstNonMatch is the nexus that has both paths as children
      const nextChildren =
        index === firstNonMatch - 1 ? children : [children[0]];

      return [render(currentMatch, {}, nextChildren)];
    },
    [null, null] // deepest
  );

  return <>{children}</>;
}

export const NestedTransitionRoutes = (props: { id?: string }) => (
  <RelativeRouteNavigator>
    <NestedTransitionRoutesImpl {...props} />
  </RelativeRouteNavigator>
);

function RouteTransition({
  children,
  exit,
  replace,
}: {
  children: React.ReactNode;
  exit?: boolean;
  replace?: boolean;
}) {
  const [status, setStatus] = React.useState(
    `unmounted${replace ? "-replace" : ""}`
  );
  const [exited, setExited] = React.useState(false);
  if (!exit && exited) {
    setExited(false);
    setStatus(`unmounted${replace ? "-replace" : ""}`);
  }

  React.useEffect(() => {
    setStatus(
      `${exit ? "exited" : "entered"}${exit && replace ? "-replace" : ""}`
    );
  }, [exit, replace]);

  React.useEffect(() => {
    if (exit) {
      let t = setTimeout(() => {
        setExited(true);
      }, 500);
      return () => {
        clearTimeout(t);
      };
    }
  }, [exit]);

  return !exited ? (
    <TransitionContext.Provider value={status}>
      {children}
    </TransitionContext.Provider>
  ) : null;
}

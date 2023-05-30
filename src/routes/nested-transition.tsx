import React from "react";
import { RouteContext } from "../Router";
import { useMatches } from "./utils";
import { RouteMatch } from "../types";

export const TransitionContext = React.createContext<string>(null!);
export const useRouteTransition = () => React.useContext(TransitionContext);

function usePrevious<T>(value: T) {
  const [prev, setPrev] = React.useState<T>();
  const [current, setCurrent] = React.useState<T>();

  let isReset = false;

  if (current !== value) {
    setPrev(current);
    setCurrent(value);
    isReset = true;
  }
  return [prev || value, isReset] as [T, boolean];
}

export function NestedTransitionRoutes() {
  const currentMatches = useMatches();
  const [prevMatches, isReset] = usePrevious(currentMatches);

  const replace = prevMatches.length === currentMatches.length;

  const depth = Math.max(prevMatches.length, currentMatches.length);

  const firstNonMatch = React.useMemo(() => {
    for (let i = 0; i < depth; i++) {
      if (prevMatches[i]?.segment !== currentMatches[i]?.segment) {
        return i;
      }
    }
    return null;
  }, [prevMatches, currentMatches]);

  const render = (
    match: RouteMatch,
    props: { exit?: boolean; replace?: boolean },
    children: React.ReactNode
  ) => {
    return (
      <RouteTransition
        key={match.segment}
        exit={props.exit}
        replace={props.replace}
      >
        <RouteContext.Provider value={match}>
          <match.config.render params={match.params}>
            {children}
          </match.config.render>
        </RouteContext.Provider>
      </RouteTransition>
    );
  };

  type Accumulator = [current: React.ReactNode, prev?: React.ReactNode];

  const children = Array.from({ length: depth }).reduce(
    (children: Accumulator, _, i): Accumulator => {
      const index = depth - 1 - i;
      const currentMatch = currentMatches[index];
      const prevMatch = prevMatches[index];

      if (firstNonMatch !== null && index === firstNonMatch - 1) {
        // has both paths as children (merges)
        // (will always exist since first segment is always a match)

        return [currentMatch ? render(currentMatch, {}, children) : null];
      } else if (firstNonMatch !== null && index >= firstNonMatch) {
        // handles two paths

        return [
          prevMatch
            ? render(
                prevMatch,
                { exit: true, replace: firstNonMatch === index && replace },
                children[1]
              )
            : null,
          currentMatch
            ? render(
                currentMatch,
                { replace: firstNonMatch === index && replace },
                children[0]
              )
            : null,
        ];
      } else {
        return [currentMatch ? render(currentMatch, {}, children[0]) : null];
      }
    },
    [null, null] // deepest
  );

  if (isReset) {
    return null;
  }

  return <>{children}</>;
}

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

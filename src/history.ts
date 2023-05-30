import { getMatches } from "./matches";
import type {
  Location,
  Action,
  Listener,
  History,
  Route,
  RouteMatch,
  HistoryState,
} from "./types";
import { createPath } from "./utils";

const compareParams = (
  params1: Record<string, string>,
  params2: Record<string, string>
) => {
  const keys1 = Object.keys(params1);
  const keys2 = Object.keys(params2);

  if (keys1.length !== keys2.length) {
    return false;
  }

  return keys1.every((key) => params1[key] === params2[key]);
};

const existsInCache = (
  cache: Map<object, Record<string, string>[]>,
  loader: any,
  params: any
) => {
  const current = cache.get(loader);
  return current && current.some((p) => compareParams(p, params));
};

export function createHistory(options: { routes: Route[]; window?: Window }) {
  let state: HistoryState = {
    action: "POP",
    location: getLocation(),
  };

  function setState(newState: HistoryState) {
    state = newState;
    callLoaders(newState.location);
    if (listener) {
      listener(newState);
    }
  }

  let listener: Listener | null = null;

  function handleAction(actionFromArg: "PUSH" | "REPLACE", location: Location) {
    const globalHistory = (options.window ?? document.defaultView!).history;

    const historyState = {
      usr: location.state,
      key: location.key,
    };

    const url = createPath(location);

    try {
      const method = actionFromArg === "PUSH" ? "pushState" : "replaceState";
      globalHistory[method](historyState, "", url);
    } catch (error) {
      // iOS has a limit of 100 pushState calls
      window.location.assign(url);
    }

    setState({
      action: actionFromArg,
      location,
    });
  }

  function handlePop() {
    setState({
      action: "POP",
      location: getLocation(),
    });
  }

  function listen(fn: Listener) {
    const window = options.window ?? document.defaultView!;

    if (listener) {
      throw new Error("A history only accepts one active listener");
    }
    window.addEventListener("popstate", handlePop);
    listener = fn;

    return () => {
      window.removeEventListener("popstate", handlePop);
      listener = null;
    };
  }

  const loaders = new Map<object, Record<string, string>[]>();

  function callLoaders(location: Location) {
    const lastLoaders = new Map(loaders);
    loaders.clear();

    const matches = getMatches(location.pathname, options.routes, {
      withConfig: true,
    });

    callLoadersRecursive(matches);

    function callLoadersRecursive(matches: RouteMatch[]) {
      matches.forEach((match) => {
        callLoader(match);
        if (match.children) {
          callLoadersRecursive(match.children);
        }
      });
    }

    function callLoader(match: RouteMatch) {
      const loader = match.config.loader;
      if (!loader) return;

      if (existsInCache(loaders, loader, match.params)) return;
      loaders.set(loader, (loaders.get(loader) ?? []).concat(match.params));

      if (existsInCache(lastLoaders, loader, match.params)) return;
      loader(match.params);
    }
  }

  function getLocation() {
    const globalHistory = (options.window ?? document.defaultView!).history;
    const { pathname, search, hash } = window.location;
    return {
      pathname,
      search,
      hash,
      // state defaults to `null` because `window.history.state` does
      state: (globalHistory.state && globalHistory.state.usr) || null,
      key: (globalHistory.state && globalHistory.state.key) || "default",
    };
  }

  const history: History = {
    get routes() {
      return options.routes;
    },
    get action() {
      return state.action;
    },
    get location() {
      return state.location;
    },
    listen,
    sync() {
      return [listen, () => state];
    },
    push(location) {
      handleAction("PUSH", location);
    },
    replace(location) {
      handleAction("REPLACE", location);
    },
    go(n) {
      const globalHistory = (options.window ?? document.defaultView!).history;
      return globalHistory.go(n);
    },
  };

  callLoaders(state.location);

  return history;
}

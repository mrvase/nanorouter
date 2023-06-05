import { getMatches } from "./matches";
import type {
  Location,
  Listener,
  History,
  Route,
  RouteMatch,
  HistoryState,
} from "./types";
import { createKey, createPath } from "./utils";

type LoaderData = {
  params: Record<string, string>;
  promise: Promise<any> | undefined;
  data: unknown | undefined;
};

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

/*
const shouldAwait = (matches: RouteMatch[]) => {
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    if (
      (match.config.loader && match.config.await) ||
      (match.children && shouldAwait(match.children))
    ) {
      return true;
    }
  }
  return false;
};
*/

const getFromCache = (cache: Map<object, LoaderData[]>, match: RouteMatch) => {
  const current = cache.get(match.config.loader!);
  return current && current.find((p) => compareParams(p.params, match.params));
};

const rootLocation = {
  pathname: "/",
  search: "",
  hash: "",
  key: createKey(),
  state: null,
};

export function createHistory(options: { routes: Route[]; window?: Window }) {
  let state: HistoryState = {
    action: "POP",
    location: getLocation(),
    matches: getMatches(getLocation().pathname, options.routes),
    isLoading: true,
    pending: undefined,
  };

  let current = createKey();

  function setState(
    newState_: Pick<HistoryState, "action" | "location">,
    initial?: boolean
  ) {
    const newState = {
      ...newState_,
      matches: getMatches(newState_.location.pathname, options.routes),
    };
    const key = newState.location.key;
    current = key;

    const promises = callLoaders(newState.matches);
    const shouldAwait = promises.length > 0;
    let awaited = false;

    const set = (newState: HistoryState) => {
      state = newState;
      if (listener && (!initial || awaited)) listener(newState);
    };

    if (shouldAwait) {
      set({
        ...state,
        isLoading: true,
        pending: newState.location,
        ...(initial && { location: rootLocation, matches: [] }),
      });
      awaited = true;
      Promise.all(promises).then(() => {
        if (current !== key) return;
        set({
          ...newState,
          isLoading: false,
          pending: undefined,
        });
      });
    } else {
      set({
        ...newState,
        isLoading: false,
        pending: undefined,
      });
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

  const loaders = new Map<object, LoaderData[]>();

  function callLoaders(matches: RouteMatch[]) {
    const lastLoaders = new Map(loaders);
    loaders.clear();

    const promises: (Promise<any> | undefined)[] = [];

    callLoadersRecursive(matches);

    function callLoadersRecursive(matches: RouteMatch[]) {
      matches.forEach((match) => {
        promises.push(callLoader(match));
        if (match.children) {
          callLoadersRecursive(match.children);
        }
      });
    }

    function callLoader(match: RouteMatch) {
      const loader = match.config.loader;
      if (!loader) return;

      const current = getFromCache(loaders, match);

      if (current) return;

      let data: LoaderData;

      const prev = getFromCache(lastLoaders, match);

      if (prev) {
        data = prev;
      } else {
        let result = loader(match.params);

        if (result && "then" in result) {
          result = result.then((res) => {
            data.promise = undefined;
            data.data = res;
            return res;
          });
        }

        data = {
          params: match.params,
          promise: result ?? undefined,
          data: undefined,
        };
      }

      loaders.set(loader, (loaders.get(loader) ?? []).concat(data));

      return match.config.await ? data.promise : undefined;
    }

    return promises.filter((el): el is Promise<any> => Boolean(el));
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

  setState(state, true); // to call loaders

  return history;
}

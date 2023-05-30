import { Matcher, Route, RouteMatch } from "./types";

const resolveMatch = (
  url: string,
  matcher: Matcher
): Partial<RouteMatch> | undefined => {
  if (typeof matcher === "string") {
    const segments = matcher.split("/");
    segments.splice(0, 1); // remove first empty element
    let regex = "";
    let keys = [];
    for (let segment of segments) {
      if (segment.startsWith(":")) {
        keys.push(segment.slice(1));
        const existingRegex = segment.slice(segment.indexOf("("));
        regex += existingRegex.startsWith("(")
          ? `/${existingRegex}`
          : "/([^/]+)";
      } else {
        regex += `/${segment}`;
      }
    }
    const match = url.match(new RegExp(`^${regex}`));
    if (!match) return;
    return {
      segment: match[0],
      params: Object.fromEntries(keys.map((key, i) => [key, match[i + 1]])),
    };
  } else if (Array.isArray(matcher)) {
    const match = matcher.find((m) => url.startsWith(m));
    if (!match) return;
    return {
      segment: match[0],
    };
  } else {
    const match = matcher(url);
    if (!match) return;
    return {
      segment: match,
    };
  }
};

export function getMatches(
  url: string,
  routes: Route[],
  options?: {}
): Omit<RouteMatch, "config">[];
export function getMatches(
  url: string,
  routes: Route[],
  options: { withConfig: true }
): RouteMatch[];
export function getMatches(
  url: string,
  routes: Route[],
  options: { withConfig?: boolean } = {}
): Omit<RouteMatch, "config">[] | RouteMatch[] {
  const matches: Omit<RouteMatch, "index">[] = [];

  const isMatch = (match: Partial<RouteMatch>): match is RouteMatch => {
    return "segment" in match;
  };

  const getMatch = (prevUrl: string, nextUrl: string, routes: Route[]) => {
    for (let next of routes) {
      const resolved = resolveMatch(nextUrl, next.match);
      const match: Partial<RouteMatch> = {
        params: {},
        children: [],
        accumulated: "",
        ...(options.withConfig && { config: next }),
        ...resolved,
      };
      if (isMatch(match)) {
        match.accumulated = `${prevUrl}${match.segment}`;
        if (next.subroutes) {
          match.children = getMatches(
            match.segment,
            next.subroutes,
            options
          ) as RouteMatch[];
        }
        matches.push(match);
        if (match.segment.length < nextUrl.length) {
          if (next.next) {
            getMatch(
              `${prevUrl}${match.segment}`,
              nextUrl.slice(match.segment.length),
              next.next()
            );
            return;
          } else {
            break;
            // continue to add 404
          }
        } else {
          return;
        }
      }
    }

    matches.push({
      params: {},
      children: [],
      config: {
        render: () => <>404</>,
        match: "404",
        next: () => [],
      },
      accumulated: `${prevUrl}${nextUrl}`,
      segment: nextUrl,
    });
    // if we get here, no match was found
  };

  if (url === "" || url === "/") {
    return [];
  }

  getMatch("", url, routes);

  return matches.map((match, index) => ({ ...match, index }));
}

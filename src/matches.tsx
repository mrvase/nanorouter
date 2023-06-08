import { Matcher, Route, RouteMatch } from "./types";

const resolveMatch = (
  url: string,
  matcher: Matcher
): Partial<RouteMatch> | undefined => {
  if (typeof matcher === "string") {
    let regex = "";
    let keys = [];
    if (matcher.indexOf("/:") === -1) {
      regex = matcher;
    } else {
      const segments = matcher.split("/");
      segments.splice(0, 1); // remove first empty element
      for (let segment of segments) {
        if (segment.startsWith(":")) {
          const array = segment.slice(1).split(/(\()/);
          keys.push(array.splice(0, 1)[0]);
          const customRegex = array.join("");
          regex += customRegex ? `/${customRegex}` : "/([^/]+)";
        } else {
          regex += `/${segment}`;
        }
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

export function getMatches(url: string, routes: Route[]): RouteMatch[] {
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
        config: next,
        ...resolved,
      };
      if (isMatch(match)) {
        match.accumulated = `${prevUrl}${match.segment}`;
        if (next.subroutes) {
          match.children = getMatches(
            match.segment,
            next.subroutes
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

    if (url === "" || url === "/") {
      return;
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

  getMatch("", url, routes);

  return matches.map((match, index) => ({ ...match, index }));
}

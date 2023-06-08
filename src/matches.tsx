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

  const getMatch = (
    matchedUrl: string,
    remainingUrl: string,
    routes: Route[]
  ) => {
    let nextMatchedUrl = matchedUrl;
    let nextRemainingUrl = remainingUrl;
    for (let next of routes) {
      const resolved = resolveMatch(remainingUrl, next.match);
      const match: Partial<RouteMatch> = {
        params: {},
        children: [],
        accumulated: "",
        config: next,
        ...resolved,
      };
      if (isMatch(match)) {
        nextMatchedUrl = `${matchedUrl}${match.segment}`;
        nextRemainingUrl = remainingUrl.slice(match.segment.length);

        match.accumulated = nextMatchedUrl;
        if (next.subroutes) {
          match.children = getMatches(
            match.segment,
            next.subroutes
          ) as RouteMatch[];
        }
        matches.push(match);

        // even if nextRemaningUrl === "", we will check if a route matches an empty string
        if (next.next) {
          getMatch(nextMatchedUrl, nextRemainingUrl, next.next());
          return;
        }
        break;
      }
    }

    if (nextRemainingUrl === "" || nextRemainingUrl === "/") {
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
      accumulated: `${nextMatchedUrl}${nextRemainingUrl}`,
      segment: nextRemainingUrl,
    });
    // if we get here, no match was found
  };

  getMatch("", url, routes);

  return matches.map((match, index) => ({ ...match, index }));
}

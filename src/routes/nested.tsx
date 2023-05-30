import { RouteContext } from "../Router";
import { useMatches, RelativeRouteNavigator } from "./utils";

export function NestedRoutes() {
  const matches = useMatches();

  return (
    <RelativeRouteNavigator>
      {matches.reduceRight((children, el, index) => {
        return (
          <RouteContext.Provider key={index} value={el}>
            <el.config.render params={el.params}>{children}</el.config.render>
          </RouteContext.Provider>
        );
      }, null as React.ReactNode)}
    </RelativeRouteNavigator>
  );
}

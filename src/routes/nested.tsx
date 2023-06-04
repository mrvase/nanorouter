import { RouteContextProvider } from "../Router";
import { useMatches, RelativeRouteNavigator } from "./utils";

export function NestedRoutes({ id }: { id?: string }) {
  const matches = useMatches();

  return (
    <RelativeRouteNavigator>
      {matches.reduceRight((children, el, index) => {
        return (
          <RouteContextProvider key={index} match={el} id={id}>
            <el.config.render params={el.params}>{children}</el.config.render>
          </RouteContextProvider>
        );
      }, null as React.ReactNode)}
    </RelativeRouteNavigator>
  );
}

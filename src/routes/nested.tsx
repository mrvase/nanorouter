import { RouteContextProvider, useMatches } from "../Router";
import { RelativeRouteNavigator } from "./utils";

function NestedRoutesImpl({ id }: { id?: string }) {
  const matches = useMatches();

  return (
    <>
      {matches.reduceRight((children, el, index) => {
        return (
          <RouteContextProvider key={index} match={el} id={id}>
            <el.config.render params={el.params}>{children}</el.config.render>
          </RouteContextProvider>
        );
      }, null as React.ReactNode)}
    </>
  );
}

export const NestedRoutes = (props: { id?: string }) => (
  <RelativeRouteNavigator>
    <NestedRoutesImpl {...props} />
  </RelativeRouteNavigator>
);

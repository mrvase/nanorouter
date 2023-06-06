import { RouteContextProvider, useMatches } from "../Router";
import { RelativeRouteNavigator } from "./utils";

function NestedRoutesImpl({ id }: { id?: string }) {
  const matches = useMatches();

  return (
    <>
      {matches.reduceRight(
        (children, el, index) =>
          el.config.render ? (
            <RouteContextProvider key={index} match={el} id={id}>
              <el.config.render params={el.params}>{children}</el.config.render>
            </RouteContextProvider>
          ) : (
            children
          ),
        null as React.ReactNode
      )}
    </>
  );
}

export const NestedRoutes = (props: { id?: string }) => (
  <RelativeRouteNavigator>
    <NestedRoutesImpl {...props} />
  </RelativeRouteNavigator>
);

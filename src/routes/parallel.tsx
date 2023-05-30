import React from "react";
import { RouteContext, useNavigate } from "../Router";
import { RouteMatch } from "../types";
import { createKey } from "../utils";
import {
  ParallelRouteNavigator,
  RelativeRouteNavigator,
  useMatches,
} from "./utils";

export const createEvents = (id: string) => {
  const dispatch = (detail: { type: string; payload: any }) =>
    document.dispatchEvent(
      new CustomEvent(`routes:${id}`, {
        detail,
      })
    );

  return {
    move(payload: { from: number; to: number }) {
      dispatch({ type: "move", payload });
    },
    open(payload: { path: string; index: number }) {
      dispatch({ type: "open", payload });
    },
    close(payload: number) {
      dispatch({ type: "close", payload });
    },
  };
};

function ParallelRoutingListener({
  id,
  matches,
  keys,
  setKeys,
}: {
  id: string;
  matches: RouteMatch[];
  keys: string[];
  setKeys: (ps: string[]) => void;
}) {
  const navigate = useNavigate();

  React.useEffect(() => {
    const handleAction = (
      ev: Event & { detail?: { type: string; payload: any } }
    ) => {
      const { type, payload } = ev.detail!;
      const array: [string, string][] = matches.map((el, index) => [
        el.segment,
        keys[index],
      ]);

      if (type === "move") {
        const [removed] = array.splice(payload.from, 1);
        array.splice(payload.to, 0, removed);
      } else if (type === "open") {
        array.splice(payload.index + 1, 0, [payload.path, createKey()]);
      } else if (type === "close") {
        array.splice(payload, 1);
      } else {
        return;
      }

      navigate(array.map((el) => el[0]).join(""));
      setKeys(array.map((el) => el[1]));
    };

    document.addEventListener(`routes:${id}`, handleAction);
    return () => {
      document.removeEventListener(`routes:${id}`, handleAction);
    };
  }, [id, matches, keys, navigate]);
  return null;
}

function ParallelRoutesImpl({ id }: { id?: string }) {
  const matches = useMatches();

  const [keys, setKeys] = React.useState<string[]>([]);
  if (keys.length !== matches.length) {
    setKeys(matches.map(() => createKey()));
  }

  return (
    <>
      {id && (
        <ParallelRoutingListener
          id={id}
          matches={matches}
          keys={keys}
          setKeys={setKeys}
        />
      )}
      {matches.map((el, index) => (
        <ParallelRouteNavigator
          key={keys[index] ?? index}
          pathname={el.segment}
          matches={matches}
          index={index}
        >
          <RouteContext.Provider key={index} value={el}>
            <el.config.render params={el.params} />
          </RouteContext.Provider>
        </ParallelRouteNavigator>
      ))}
    </>
  );
}

export function ParallelRoutes({ id }: { id?: string }) {
  return (
    <RelativeRouteNavigator>
      <ParallelRoutesImpl id={id} />
    </RelativeRouteNavigator>
  );
}

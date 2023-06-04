import React from "react";
import { RouteContextProvider, useNavigate } from "../Router";
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
  keys: { key: string; order: number }[];
  setKeys: (ps: { key: string; order: number }[]) => void;
}) {
  const navigate = useNavigate();

  React.useEffect(() => {
    const handleAction = (
      ev: Event & { detail?: { type: string; payload: any } }
    ) => {
      const { type, payload } = ev.detail!;
      const array: [string, { key: string; order: number }][] = matches.map(
        (el, index) => [el.segment, keys[index]]
      );

      if (type === "move") {
        const [removed] = array.splice(payload.from, 1);
        array.splice(payload.to, 0, removed);
      } else if (type === "open") {
        const order = Math.max(...array.map((el) => el[1].order)) + 1;
        array.splice(payload.index + 1, 0, [
          payload.path,
          { key: createKey(), order },
        ]);
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

function ParallelRoutesImpl({
  id,
  maintainInsertionOrder,
}: {
  id?: string;
  maintainInsertionOrder?: boolean;
}) {
  const matches = useMatches();

  const [keys, setKeys] = React.useState<{ order: number; key: string }[]>([]);
  if (keys.length !== matches.length) {
    setKeys(matches.map((_, order) => ({ order, key: createKey() })));
  }

  const renderList = React.useMemo(() => {
    const list = keys.map(
      (el, index): [{ order: number; key: string }, RouteMatch] => [
        el,
        matches[index],
      ]
    );
    if (maintainInsertionOrder) list.sort((a, b) => a[0].order - b[0].order);
    return list;
  }, [matches, keys]);

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
      {renderList.map(([key, el], index) => (
        <ParallelRouteNavigator
          key={key.key}
          pathname={el.segment}
          matches={matches}
          index={el.index}
        >
          <RouteContextProvider match={el} id={id}>
            <el.config.render params={el.params} />
          </RouteContextProvider>
        </ParallelRouteNavigator>
      ))}
    </>
  );
}

export function ParallelRoutes(props: {
  id?: string;
  maintainInsertionOrder?: boolean;
}) {
  return (
    <RelativeRouteNavigator>
      <ParallelRoutesImpl {...props} />
    </RelativeRouteNavigator>
  );
}

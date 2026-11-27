"use client";
import { useCallback, useEffect, useState } from "react";
import type { BaseRecord, CollectionName, DB } from "./types";

const empty: DB = {
  communities: [],
  entrepreneurs: [],
  clients: [],
  localities: [],
};

async function call<T>(
  url: string,
  method: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok)
    throw new Error(`${method} ${url}: ${res.status} ${await res.text()}`);
  return res.json();
}

/** Client-side mirror of the server DB with optimistic-free, server-confirmed mutations. */
export function useStore() {
  const [db, setDb] = useState<DB>(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Bumped on every change; used as React key to refresh Leaflet GeoJSON layers. */
  const [version, setVersion] = useState(0);

  const reload = useCallback(async () => {
    try {
      setDb(await call<DB>("/api/data", "GET"));
      setVersion((v) => v + 1);
      setError(null);
    } catch (e) {
      setDb(empty);
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    call<DB>("/api/data", "GET")
      .then((d) => {
        if (alive) {
          setDb(d);
          setVersion((v) => v + 1);
        }
      })
      .catch((e) => alive && setError(String(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const apply = (
    c: CollectionName,
    fn: (list: BaseRecord[]) => BaseRecord[],
  ) => {
    setDb((d) => ({ ...d, [c]: fn(d[c] as BaseRecord[]) }));
    setVersion((v) => v + 1);
  };

  const add = useCallback(
    async <T extends object>(c: CollectionName, items: T[]) => {
      // Chunk large imports to keep request bodies reasonable.
      const out: BaseRecord[] = [];
      for (let i = 0; i < items.length; i += 2000) {
        const res = await call<{ items: BaseRecord[] }>(
          `/api/data/${c}`,
          "POST",
          { items: items.slice(i, i + 2000) },
        );
        out.push(...res.items);
      }
      apply(c, (l) => [...l, ...out]);
      return out;
    },
    [],
  );

  const update = useCallback(
    async <T extends { id: string }>(c: CollectionName, items: T[]) => {
      if (!items.length) return;
      const res = await call<{ items: BaseRecord[] }>(`/api/data/${c}`, "PUT", {
        items,
      });
      const byId = new Map(res.items.map((r) => [r.id, r]));
      apply(c, (l) => l.map((r) => byId.get(r.id) ?? r));
    },
    [],
  );

  const remove = useCallback(
    async (c: CollectionName, ids: string[] | "all") => {
      await call(
        `/api/data/${c}`,
        "DELETE",
        ids === "all" ? { all: true } : { ids },
      );
      if (ids === "all") apply(c, () => []);
      else {
        const set = new Set(ids);
        apply(c, (l) => l.filter((r) => !set.has(r.id)));
      }
    },
    [],
  );

  return { db, loading, error, version, reload, add, update, remove };
}

export type Store = ReturnType<typeof useStore>;

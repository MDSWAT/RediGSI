"use client";
import { importBatches } from "./importBatches";
import { useCallback, useEffect, useState } from "react";
import type { BaseRecord, CollectionName, DB } from "./types";
import { createClient } from "@/utils/supabase/client";

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

/**
 * Signed-in users read their workspace straight from Supabase with the browser session (row access
 * is decided by redi_workspace_data, and the full outline set is larger than a serverless response
 * may be). Visitors without a session get the shared CDN copy of the public map.
 */
async function loadWorkspace(): Promise<DB> {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session) return { ...empty, ...(await call<Partial<DB>>("/api/public-map", "GET")) };
  const { data, error } = await supabase.rpc("redi_workspace_data");
  if (error) throw new Error(`Datele nu au putut fi încărcate din baza de date: ${error.message}`);
  return { ...empty, ...(data as Partial<DB>) };
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
      setDb(await loadWorkspace());
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
    loadWorkspace()
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
      const batches = importBatches(items);
      try {
        for (const batch of batches) {
          const res = await call<{ items: BaseRecord[] }>(
            `/api/data/${c}`,
            "POST",
            { items: batch },
          );
          out.push(...res.items);
          apply(c, (l) => [...l, ...res.items]);
        }
      } catch (e) {
        if (out.length)
          throw new Error(
            `${out.length} înregistrări au fost salvate înainte de întrerupere. Verificați duplicatele înainte de reluare. ${String(e)}`,
          );
        throw e;
      }
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

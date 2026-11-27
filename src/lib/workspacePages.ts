import type { DB } from "./types";

/** Records per workspace page: small enough for the anonymous statement limit and serverless responses. */
export const WORKSPACE_PAGE_SIZE = 300;
/** Pages requested at the same time while loading. */
const PARALLEL_PAGES = 6;

export type WorkspacePage = Partial<DB> & { count?: number };

/** Loads every page of the workspace and merges them in order. */
export async function loadAllPages(
  fetchPage: (offset: number) => Promise<WorkspacePage>,
): Promise<DB> {
  const merged: DB = { communities: [], entrepreneurs: [], clients: [], localities: [] };
  for (let start = 0; ; start += WORKSPACE_PAGE_SIZE * PARALLEL_PAGES) {
    const pages = await Promise.all(
      Array.from({ length: PARALLEL_PAGES }, (_, i) => fetchPage(start + i * WORKSPACE_PAGE_SIZE)),
    );
    let finished = false;
    for (const page of pages) {
      merged.communities.push(...(page.communities ?? []));
      merged.entrepreneurs.push(...(page.entrepreneurs ?? []));
      merged.clients.push(...(page.clients ?? []));
      merged.localities.push(...(page.localities ?? []));
      if ((page.count ?? 0) < WORKSPACE_PAGE_SIZE) finished = true;
    }
    if (finished) return merged;
  }
}

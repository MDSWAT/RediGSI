import type { DB } from "./types";

/** Records per workspace page: small enough for the anonymous statement limit and serverless responses. */
export const WORKSPACE_PAGE_SIZE = 300;
/** Pages requested at the same time while loading. */
const PARALLEL_PAGES = 6;

export type WorkspacePage = Partial<DB> & { count?: number };

/** Loads every page of the workspace and merges them in order. */
export async function loadAllPages(
  fetchPage: (offset: number) => Promise<WorkspacePage>,
  onProgress?: (db: DB) => void,
): Promise<DB> {
  const merged: DB = { communities: [], entrepreneurs: [], clients: [], localities: [] };
  const append = (pages: WorkspacePage[]) => {
    let finished = false;
    for (const page of pages) {
      merged.communities.push(...(page.communities ?? []));
      merged.entrepreneurs.push(...(page.entrepreneurs ?? []));
      merged.clients.push(...(page.clients ?? []));
      merged.localities.push(...(page.localities ?? []));
      if ((page.count ?? 0) < WORKSPACE_PAGE_SIZE) finished = true;
    }
    // Publish immutable snapshots; later pages must not mutate data React already rendered.
    onProgress?.({
      communities: [...merged.communities], entrepreneurs: [...merged.entrepreneurs],
      clients: [...merged.clients], localities: [...merged.localities],
    });
    return finished;
  };
  // Prioritize a useful first page, and avoid five unnecessary calls for small workspaces.
  if (append([await fetchPage(0)])) return merged;
  for (let start = WORKSPACE_PAGE_SIZE; ; start += WORKSPACE_PAGE_SIZE * PARALLEL_PAGES) {
    const pages = await Promise.all(
      Array.from({ length: PARALLEL_PAGES }, (_, i) => fetchPage(start + i * WORKSPACE_PAGE_SIZE)),
    );
    const finished = append(pages);
    if (finished) return merged;
  }
}

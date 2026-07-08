import type { Catalog, CatalogPost, UserState, ViewState } from "./types.js";

export function currentSet(catalog: Catalog, state: UserState, view: ViewState): CatalogPost[] {
  let list = catalog.posts.slice();
  const s = view.scope;

  if (s === "fav") list = list.filter((p) => state.fav[p.id]);
  else if (s === "done") list = list.filter((p) => state.done[p.id]);
  else if (s === "uncat") list = list.filter((p) => !p.collections.length);
  else if (s.startsWith("col:")) { const n = s.slice(4); list = list.filter((p) => p.collections.includes(n)); }
  else if (s.startsWith("tag:")) { const t = s.slice(4); list = list.filter((p) => (state.tags[p.id] ?? []).includes(t)); }

  if (view.type !== "all") list = list.filter((p) => p.type === view.type);

  if (view.q) {
    const q = view.q.toLowerCase();
    list = list.filter(
      (p) =>
        (p.caption ?? "").toLowerCase().includes(q) ||
        (p.owner_username ?? "").toLowerCase().includes(q) ||
        (p.owner_name ?? "").toLowerCase().includes(q) ||
        (p.tldr ?? "").toLowerCase().includes(q) ||
        (p.captionTags ?? []).some((t) => t.toLowerCase().includes(q)) ||
        (p.suggestedTags ?? []).some((t) => t.toLowerCase().includes(q))
    );
  }

  if (view.sort === "new") list.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
  else if (view.sort === "old") list.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
  else if (view.sort === "owner") list.sort((a, b) => (a.owner_username || "~").localeCompare(b.owner_username || "~"));

  return list;
}

export function computeCounts(catalog: Catalog, state: UserState): {
  all: number;
  fav: number;
  done: number;
  uncat: number;
  byCollection: Map<string, number>;
  byTag: Map<string, number>;
} {
  let fav = 0, done = 0, uncat = 0;
  const byCollection = new Map<string, number>();
  const byTag = new Map<string, number>();

  for (const p of catalog.posts) {
    if (state.fav[p.id]) fav++;
    if (state.done[p.id]) done++;
    if (!p.collections.length) uncat++;
    for (const c of p.collections) byCollection.set(c, (byCollection.get(c) ?? 0) + 1);
    for (const t of state.tags[p.id] ?? []) byTag.set(t, (byTag.get(t) ?? 0) + 1);
  }

  return { all: catalog.posts.length, fav, done, uncat, byCollection, byTag };
}

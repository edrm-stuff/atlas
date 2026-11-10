import type { Catalog, CatalogPost, Collection } from "../types.js";

export function rebuildCollections(posts: CatalogPost[], prior: Collection[]): Collection[] {
  const names: string[] = [];
  posts.forEach((p) => p.collections.forEach((n) => { if (n && !names.includes(n)) names.push(n); }));
  return names.map((name) => {
    const inCollection = posts.filter((p) => p.collections.includes(name));
    const original = prior.find((c) => c.name === name);
    return {
      name,
      count: inCollection.length,
      updated: original?.updated ?? (Math.max(0, ...inCollection.map((p) => p.timestamp ?? 0)) || null),
    };
  });
}

export function mergeCatalog(
  existing: Catalog,
  incoming: Catalog,
  purged: Record<string, boolean>
): { catalog: Catalog; added: number; updated: number } {
  const byId = new Map<string, CatalogPost>(existing.posts.map((p) => [p.id, p]));
  let added = 0;
  let updated = 0;

  for (const post of incoming.posts) {
    if (purged[post.id]) continue;
    const prev = byId.get(post.id);
    if (prev) {
      byId.set(post.id, {
        ...prev,
        // An export with missing metadata must not blank what we already have.
        url: post.url || prev.url,
        caption: post.caption || prev.caption,
        title: post.title || prev.title,
        owner_name: post.owner_name || prev.owner_name,
        owner_username: post.owner_username || prev.owner_username,
        owner_url: post.owner_url || prev.owner_url,
        timestamp: post.timestamp ?? prev.timestamp,
        type: post.type,
        collections: [...new Set([...prev.collections, ...post.collections])],
        captionTags: [...new Set([...prev.captionTags, ...post.captionTags])].slice(0, 6),
      });
      updated++;
    } else {
      byId.set(post.id, post);
      added++;
    }
  }

  const posts = [...byId.values()];
  const prior = [...existing.collections, ...incoming.collections];
  const collections = rebuildCollections(posts, prior);

  return { catalog: { posts, collections }, added, updated };
}

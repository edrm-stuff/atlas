import type { Catalog, CatalogPost, Collection } from "../types.js";

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
        url: post.url,
        caption: post.caption,
        title: post.title,
        owner_name: post.owner_name,
        owner_username: post.owner_username,
        owner_url: post.owner_url,
        timestamp: post.timestamp,
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
  const names: string[] = [];
  posts.forEach((p) => p.collections.forEach((n) => { if (n && !names.includes(n)) names.push(n); }));

  const collections: Collection[] = names.map((name) => {
    const inCollection = posts.filter((p) => p.collections.includes(name));
    const original = existing.collections.find((c) => c.name === name) ?? incoming.collections.find((c) => c.name === name);
    return {
      name,
      count: inCollection.length,
      updated: original?.updated ?? (Math.max(0, ...inCollection.map((p) => p.timestamp ?? 0)) || null),
    };
  });

  return { catalog: { posts, collections }, added, updated };
}

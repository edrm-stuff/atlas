import type { Catalog, CatalogPost, Collection } from "../types.js";
import { cleanUrl, shortcodeFromUrl, inferType } from "../utils.js";
import { buildCaptionTags, summarizeCaption } from "../tags.js";

export function normalizeCatalog(raw: unknown): Catalog {
  const r = raw as Record<string, unknown>;
  const sourcePosts = Array.isArray(r?.posts) ? (r.posts as unknown[]) : [];
  const byId = new Map<string, CatalogPost>();

  for (let i = 0; i < sourcePosts.length; i++) {
    const post = normalizeCatalogPost(sourcePosts[i], i);
    if (!post.url && !post.id) continue;
    const key = post.id || post.url;
    if (byId.has(key)) {
      const prev = byId.get(key)!;
      prev.collections = [...new Set([...prev.collections, ...post.collections])];
      prev.captionTags = [...new Set([...prev.captionTags, ...post.captionTags])].slice(0, 6);
      if (!prev.caption && post.caption) prev.caption = post.caption;
      if (!prev.tldr && post.tldr) prev.tldr = post.tldr;
      if (!prev.timestamp && post.timestamp) prev.timestamp = post.timestamp;
      continue;
    }
    byId.set(key, post);
  }

  const posts = [...byId.values()];
  const names: string[] = [];
  const addName = (n: unknown) => {
    const name = String(n ?? "").trim();
    if (name && !names.includes(name)) names.push(name);
  };

  const rawCollections = Array.isArray(r?.collections) ? (r.collections as unknown[]) : [];
  rawCollections.forEach((c) => addName(typeof c === "string" ? c : (c as Record<string, unknown>)?.name));
  posts.forEach((p) => p.collections.forEach(addName));

  const collections: Collection[] = names.map((name) => {
    const inCollection = posts.filter((p) => p.collections.includes(name));
    const original = rawCollections.find((c) => (c as Record<string, unknown>)?.name === name) as Record<string, unknown> | undefined;
    return {
      name,
      count: inCollection.length,
      updated: (original?.updated as number | null) ?? (Math.max(0, ...inCollection.map((p) => p.timestamp ?? 0)) || null),
    };
  });

  return { posts, collections };
}

export function normalizeCatalogPost(item: unknown, i: number): CatalogPost {
  const it = item as Record<string, unknown>;
  const url = cleanUrl(it.url ?? it.href ?? it.uri ?? "");
  const id = String((it.id ?? shortcodeFromUrl(url)) || `item-${i}`);
  const caption = String(it.caption ?? it.description ?? it.text ?? "");
  const owner_username = String(it.owner_username ?? it.username ?? "");
  const owner_name = String(it.owner_name ?? it.owner ?? it.title ?? owner_username ?? "Unknown");
  const type = String(it.type ?? inferType(url)).toLowerCase() as "reel" | "post";
  const timestamp = Number(it.timestamp ?? it.creation_timestamp ?? it.created_at ?? 0) || null;
  const collections = Array.isArray(it.collections) ? it.collections.map(String).filter(Boolean) : [];

  // Migrate legacy stags → captionTags; if neither, build from scratch
  const legacyStags = Array.isArray(it.stags) && it.stags.length ? it.stags.map(String) : null;
  const captionTagsRaw = Array.isArray(it.captionTags) && it.captionTags.length ? it.captionTags.map(String) : null;
  const captionTags = (captionTagsRaw ?? legacyStags ?? buildCaptionTags(caption, collections, type)).slice(0, 6);

  const suggestedTags = Array.isArray(it.suggestedTags) ? it.suggestedTags.map(String) : undefined;
  const ai = it.ai as CatalogPost["ai"] | undefined;

  return {
    url, caption, title: String(it.title ?? ""), owner_username, owner_name,
    owner_url: String(it.owner_url ?? ""), timestamp, id, type, collections,
    saved: it.saved !== false,
    tldr: String(it.tldr ?? summarizeCaption(caption, owner_name, type)),
    captionTags,
    suggestedTags,
    ai,
  };
}

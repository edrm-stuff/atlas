import { cleanUrl, isInstagramPostUrl, shortcodeFromUrl, inferType } from "../utils.js";
import type { CatalogPost } from "../types.js";

export function collectInstagramItems(value: unknown, collection: string, out: CatalogPost[]): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) { value.forEach((v) => collectInstagramItems(v, collection, out)); return; }

  const v = value as Record<string, unknown>;
  const item = instagramItemFromEntry(v, collection);
  if (item) out.push(item);

  const nextCollection = typeof v.name === "string" && v.name.trim() ? v.name.trim() : collection;
  for (const [key, child] of Object.entries(v)) {
    if (key === "string_map_data") continue;
    const childCollection = key === "media_list_data" ? nextCollection : collection;
    collectInstagramItems(child, childCollection, out);
  }
}

function instagramItemFromEntry(entry: Record<string, unknown>, collection: string): CatalogPost | null {
  const map = (entry.string_map_data as Record<string, Record<string, unknown>> | undefined) ?? {};
  const mapValues = Object.values(map).filter((v) => v && typeof v === "object");

  const links = [
    entry.url, entry.href, entry.uri,
    ...mapValues.map((v) => v.href),
    ...(Array.isArray(entry.media_list_data)
      ? (entry.media_list_data as Record<string, unknown>[]).map((v) => v?.uri ?? v?.href ?? v?.url)
      : []),
  ].map((u) => cleanUrl(u as string)).filter(Boolean);

  const url = links.find(isInstagramPostUrl) ?? links[0];
  if (!url || !isInstagramPostUrl(url)) return null;

  const savedInfo = map["Saved on"] ?? map["Date"] ?? mapValues.find((v) => v.timestamp) ?? {};
  const captionInfo = map["Caption"] ?? map["Title"] ?? map["Text"] ?? {};
  const timestamp = Number(entry.timestamp ?? entry.creation_timestamp ?? savedInfo.timestamp ?? 0) || null;
  const caption = String(captionInfo.value ?? entry.caption ?? "");
  const owner_name = String(entry.title ?? entry.owner_name ?? entry.owner_username ?? "Instagram save");
  const owner_username = String(entry.owner_username ?? "");
  const type = inferType(url);

  return {
    url, caption, title: "",
    owner_name, owner_username, owner_url: "",
    timestamp, id: shortcodeFromUrl(url), type,
    collections: collection ? [collection] : [],
    saved: true,
    tldr: caption.slice(0, 120) || `${type} saved from Instagram.`,
    captionTags: [],
  };
}

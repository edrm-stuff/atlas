import { cleanUrl, isInstagramPostUrl, shortcodeFromUrl, inferType } from "../utils.js";
import type { CatalogPost } from "../types.js";

export function collectInstagramItems(value: unknown, collection: string, out: CatalogPost[]): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) { value.forEach((v) => collectInstagramItems(v, collection, out)); return; }

  const v = value as Record<string, unknown>;

  if (Array.isArray(v.label_values)) {
    const item = instagramItemFromLabelValues(v, collection);
    if (item) out.push(item);
    return;
  }

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

function dictNameValues(dict: unknown, wantedLabel: string): string[] {
  if (!Array.isArray(dict)) return [];
  const out: string[] = [];
  for (const outer of dict as Record<string, unknown>[]) {
    const inner = outer && Array.isArray(outer.dict) ? (outer.dict as Record<string, unknown>[]) : [];
    for (const d of inner) {
      if (d.label === wantedLabel && typeof d.value === "string" && d.value.trim()) out.push(d.value.trim());
    }
  }
  return out;
}

function instagramItemFromLabelValues(entry: Record<string, unknown>, collection: string): CatalogPost | null {
  const labelValues = entry.label_values as Record<string, unknown>[];

  let url = "";
  let caption = "";
  let title = "";
  let owner_name = "";
  let owner_username = "";
  const hashtags: string[] = [];

  for (const lv of labelValues) {
    if (!lv || typeof lv !== "object") continue;
    if (lv.label === "URL") {
      const candidate = cleanUrl((lv.href ?? lv.value) as string);
      if (isInstagramPostUrl(candidate)) url = candidate;
    } else if (lv.label === "Caption") {
      caption = String(lv.value ?? "");
    } else if (lv.label === "Title") {
      title = String(lv.value ?? "");
    } else if (lv.title === "Owner") {
      owner_name = dictNameValues(lv.dict, "Name")[0] ?? owner_name;
      owner_username = dictNameValues(lv.dict, "Username")[0] ?? owner_username;
    } else if (lv.title === "Hashtags") {
      hashtags.push(...dictNameValues(lv.dict, "Name"));
    }
  }

  if (!url || !isInstagramPostUrl(url)) return null;

  const timestamp = Number(entry.timestamp ?? 0) || null;
  const type = inferType(url);

  return {
    url, caption, title,
    owner_name: owner_name || owner_username || "Unknown",
    owner_username, owner_url: "",
    timestamp, id: shortcodeFromUrl(url), type,
    collections: collection ? [collection] : [],
    saved: true,
    tldr: caption.slice(0, 120) || `${type} saved from Instagram.`,
    captionTags: hashtags.slice(0, 6),
  };
}

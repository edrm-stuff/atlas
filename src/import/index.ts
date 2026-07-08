import type { Catalog } from "../types.js";
import { normalizeCatalog } from "./normalize.js";
import { parseInstagramSavedHtml } from "./instagram-html.js";
import { collectInstagramItems } from "./instagram-json.js";

export function parseImportedText(text: string, name?: string): unknown {
  try { return JSON.parse(text); }
  catch {
    // Legacy saved-catalog.html export format
    const m = text.match(/const DATA = (.*?);\s*const STORAGE_KEY/s);
    if (m) return JSON.parse(m[1]);
    if (/<html[\s>]/i.test(text) && /instagram\.com\/(?:p|reel|tv)\//i.test(text)) {
      return { html_text: text, source_name: name ?? "saved_posts.html" };
    }
    throw new Error("That file is not a supported JSON or Saved Catalog HTML file.");
  }
}

export function normalizeImportedData(raw: unknown, _name?: string): Catalog {
  const r = raw as Record<string, unknown>;
  if (r && Array.isArray(r.posts)) return normalizeCatalog(r);
  if (r && r.html_text) {
    return normalizeCatalog({ posts: parseInstagramSavedHtml(r.html_text as string), collections: [] });
  }
  const found: ReturnType<typeof parseInstagramSavedHtml> = [];
  collectInstagramItems(raw, "", found);
  if (!found.length) throw new Error("No Instagram saved items were found in this file.");
  return normalizeCatalog({ posts: found, collections: [] });
}

import type { Catalog } from "../types.js";
import { normalizeCatalog } from "./normalize.js";
import { parseInstagramSavedHtml } from "./instagram-html.js";
import { collectInstagramItems, newImportDiagnostics } from "./instagram-json.js";

export interface ImportResult {
  catalog: Catalog;
  warning?: string;
}

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

export function normalizeImportedData(raw: unknown, _name?: string): ImportResult {
  const r = raw as Record<string, unknown>;
  if (r && Array.isArray(r.posts)) return { catalog: normalizeCatalog(r) };
  if (r && r.html_text) {
    return { catalog: normalizeCatalog({ posts: parseInstagramSavedHtml(r.html_text as string), collections: [] }) };
  }
  const found: ReturnType<typeof parseInstagramSavedHtml> = [];
  const diag = newImportDiagnostics();
  collectInstagramItems(raw, "", found, diag);
  if (!found.length) throw new Error("No Instagram saved items were found in this file.");

  let warning: string | undefined;
  if (diag.postsMissingMetadata > 0) {
    const labels = diag.unknownLabels.slice(0, 3).map((l) => `"${l}"`).join(", ");
    warning =
      `${diag.postsMissingMetadata} of ${found.length} posts were imported without captions or creator info. ` +
      `Your Instagram export appears to be in a language we don't fully support yet (labels like ${labels}). ` +
      `Links and dates still work — support for more languages is coming.`;
  }
  return { catalog: normalizeCatalog({ posts: found, collections: [] }), warning };
}

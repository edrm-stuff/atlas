import { cleanUrl, isInstagramPostUrl, shortcodeFromUrl, inferType, normalizeText, decodeHtml, parseSavedDate } from "../utils.js";
import { buildCaptionTags, extractHashtags } from "../tags.js";
import type { CatalogPost } from "../types.js";

export function parseInstagramSavedHtml(html: string): CatalogPost[] {
  const posts = typeof DOMParser === "function"
    ? parseInstagramSavedHtmlDom(html)
    : parseInstagramSavedHtmlFallback(html);
  if (!posts.length) throw new Error("No Instagram saved posts were found in this HTML file.");
  return posts;
}

function parseInstagramSavedHtmlDom(html: string): CatalogPost[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const anchors = [...doc.querySelectorAll("a[href]")].filter((a) => {
    const href = a.getAttribute("href") ?? (a as HTMLAnchorElement).href;
    return isInstagramPostUrl(href);
  });

  return anchors.map((a, i) => {
    const url = cleanUrl(a.getAttribute("href") ?? (a as HTMLAnchorElement).href);
    const block = findSavedPostBlock(a, doc);
    const rows = [...block.querySelectorAll("tr")];
    let caption = "", owner_name = "", owner_username = "", owner_url = "";

    rows.forEach((tr) => {
      const cells = [...tr.children].filter((c) => /^(td|th)$/i.test(c.tagName));
      if (cells.length !== 2) return;
      const label = normalizeText(cells[0].textContent);
      const value = normalizeText(cells[1].textContent);
      if (label === "Caption" && value && !caption) caption = value;
      if (label === "Name" && value && !owner_name) owner_name = value;
      if (label === "Username" && value && !owner_username) owner_username = value;
      if (label === "URL" && value && !isInstagramPostUrl(value) && !owner_url) owner_url = value;
    });

    const dateEl = block.querySelector("._3-94._a6-o");
    const dateText = normalizeText(dateEl?.textContent ?? "");
    const timestamp = parseSavedDate(dateText);
    const type = inferType(url);

    return {
      url, caption, title: "", owner_username,
      owner_name: owner_name || owner_username || "Instagram save",
      owner_url, timestamp, id: shortcodeFromUrl(url) || url || `item-${i}`, type,
      collections: [], saved: true,
      tldr: caption.slice(0, 120) || `${type} saved from Instagram.`,
      captionTags: buildCaptionTags(caption, extractHashtags(caption), type),
    };
  });
}

function findSavedPostBlock(anchor: Element, doc: Document): Element {
  let node: Element | null = anchor.parentElement;
  while (node && node !== doc.body) {
    if (node.querySelector?.("._3-94._a6-o") && /Caption|Owner/.test(node.textContent ?? "")) return node;
    node = node.parentElement;
  }
  return anchor.closest("table") ?? anchor.parentElement ?? anchor;
}

function parseInstagramSavedHtmlFallback(html: string): CatalogPost[] {
  const matches = [...html.matchAll(/<a[^>]+href="([^"]*instagram\.com\/(?:p|reel|tv)\/[^"]+)"[^>]*>/gi)];
  return matches.map((m, i) => {
    const url = decodeHtml(m[1]);
    const next = matches[i + 1] ? matches[i + 1].index : html.length;
    const block = html.slice(m.index, next);

    const captionMatch = block.match(/<tr><td class="_a6_q">Caption<\/td><td class="_2piu _a6_r">([\s\S]*?)<\/td><\/tr>/i);
    const caption = normalizeText(decodeHtml((captionMatch?.[1] ?? "").replace(/<[^>]+>/g, " ")));
    const nameMatch = block.match(/<td class="_a6_q">Name<\/td><td class="_2piu _a6_r">([\s\S]*?)<\/td>/i);
    const owner_name = normalizeText(decodeHtml((nameMatch?.[1] ?? "").replace(/<[^>]+>/g, " ")));
    const userMatch = block.match(/<td class="_a6_q">Username<\/td><td class="_2piu _a6_r">([\s\S]*?)<\/td>/i);
    const owner_username = normalizeText(decodeHtml((userMatch?.[1] ?? "").replace(/<[^>]+>/g, " ")));
    const ownerUrlMatch = block.match(/<td class="_a6_q">URL<\/td><td class="_2piu _a6_r">([\s\S]*?)<\/td>/i);
    const owner_url = ownerUrlMatch ? normalizeText(decodeHtml(ownerUrlMatch[1].replace(/<[^>]+>/g, " "))) : "";
    const dateMatch = block.match(/<div class="_3-94 _a6-o">([^<]+)<\/div>/i);
    const dateText = normalizeText(decodeHtml(dateMatch?.[1] ?? ""));
    const type = inferType(url);

    return {
      url, caption, title: "", owner_username,
      owner_name: owner_name || owner_username || "Instagram save",
      owner_url, timestamp: parseSavedDate(dateText),
      id: shortcodeFromUrl(url) || url || `item-${i}`, type,
      collections: [], saved: true,
      tldr: caption.slice(0, 120) || `${type} saved from Instagram.`,
      captionTags: buildCaptionTags(caption, extractHashtags(caption), type),
    };
  });
}

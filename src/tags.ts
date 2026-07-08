const KEYWORD_TAGS: [string, string][] = [
  ["ai", "ai-tools"],
  ["claude", "ai-tools"],
  ["chatgpt", "ai-tools"],
  ["design", "design"],
  ["travel", "travel"],
  ["recipe", "recipe"],
  ["food", "food"],
  ["work", "productivity"],
  ["business", "business"],
  ["marketing", "marketing"],
  ["learn", "education"],
  ["tutorial", "education"],
  ["fitness", "fitness"],
  ["workout", "fitness"],
  ["tech", "tech"],
  ["code", "tech"],
];

export function extractHashtags(text: string): string[] {
  return [...(text ?? "").matchAll(/#([\p{L}\p{N}_-]+)/gu)].map((m) => m[1]);
}

export function buildCaptionTags(caption: string, collections: string[], type: string): string[] {
  const tags: string[] = [];
  const add = (t: string) => {
    t = (t ?? "").toLowerCase().replace(/^#/, "").trim();
    if (t && !tags.includes(t)) tags.push(t);
  };
  (collections ?? []).forEach(add);
  add(type);
  extractHashtags(caption ?? "").slice(0, 5).forEach(add);
  const text = (caption ?? "").toLowerCase();
  KEYWORD_TAGS.forEach(([needle, tag]) => { if (text.includes(needle)) add(tag); });
  if (!tags.length) add("saved");
  return tags;
}

export function summarizeCaption(caption: string, owner: string, type: string): string {
  const clean = (caption ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return (type || "post") + " saved from " + (owner || "Instagram") + ".";
  return clean.length > 120 ? clean.slice(0, 117).trim() + "..." : clean;
}

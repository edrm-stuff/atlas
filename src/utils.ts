export function esc(s: string | null | undefined): string {
  return (s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] ?? c));
}

export function fmtDate(ts: number | null): string {
  if (!ts) return "—";
  const d = new Date(ts * 1000);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
}

export function cleanUrl(url: unknown): string {
  return String(url ?? "").trim();
}

export function shortcodeFromUrl(url: string): string {
  const m = url.match(/instagram\.com\/(?:p|reel|tv)\/([^/?#]+)/i);
  return m ? m[1] : "";
}

export function isInstagramPostUrl(url: string): boolean {
  return /instagram\.com\/(p|reel|tv)\//i.test(url ?? "");
}

export function inferType(url: string): "reel" | "post" {
  return /instagram\.com\/reel\//i.test(url ?? "") ? "reel" : "post";
}

export function normalizeText(s: string | null | undefined): string {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

export function decodeHtml(s: string | null | undefined): string {
  return (s ?? "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'");
}

export function parseSavedDate(text: string): number | null {
  const t = Date.parse((text ?? "").replace(/ /g, " "));
  return Number.isFinite(t) ? Math.floor(t / 1000) : null;
}

export function initial(ownerName: string, ownerUsername: string): string {
  const s = (ownerName || ownerUsername || "?").trim();
  return s ? s[0].toUpperCase() : "?";
}

export function igProfile(ownerUsername: string, ownerUrl: string): string {
  if (ownerUsername) return "https://www.instagram.com/" + encodeURIComponent(ownerUsername) + "/";
  return ownerUrl || "#";
}

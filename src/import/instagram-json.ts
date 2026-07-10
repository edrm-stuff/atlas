import { cleanUrl, isInstagramPostUrl, shortcodeFromUrl, inferType } from "../utils.js";
import type { CatalogPost } from "../types.js";

// Instagram data exports escape UTF-8 bytes as Latin-1 code points
// ("impressÃµes" parses to "impressÃµes" instead of "impressões").
// Re-interpret the string's code points as UTF-8 bytes when possible.
export function fixMojibake(s: string): string {
  if (!/[Â-ô]/.test(s)) return s;
  try {
    const bytes = new Uint8Array([...s].map((c) => c.charCodeAt(0)));
    if ([...s].some((c) => c.charCodeAt(0) > 255)) return s;
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return decoded;
  } catch {
    return s;
  }
}

// Instagram localizes export labels to the account language.
// Covered: English, Portuguese, Spanish, French, German, Italian, Arabic, Hebrew, Japanese.
const CAPTION_LABELS = new Set([
  "Caption", "Legenda", "Descripción", "Texto", "Légende", "Bildunterschrift", "Didascalia",
  "الشرح", "التسمية التوضيحية", "כיתוב", "キャプション",
]);
const TITLE_LABELS = new Set([
  "Title", "Título", "Titre", "Titel", "Titolo",
  "العنوان", "כותרת", "タイトル",
]);
const OWNER_TITLES = new Set([
  "Owner", "Dono", "Propietario", "Propriétaire", "Eigentümer", "Proprietario",
  "المالك", "בעלים", "所有者", "オーナー",
]);
const NAME_LABELS = new Set([
  "Name", "Nome", "Nombre", "Nom",
  "الاسم", "שם", "名前",
]);
const USERNAME_LABELS = new Set([
  "Username", "Nome de usuário", "Nombre de usuario", "Nom d'utilisateur", "Benutzername", "Nome utente",
  "اسم المستخدم", "שם משתמש", "ユーザー名", "ユーザーネーム",
]);
const SAVED_ON_KEYS = [
  "Saved on", "Guardado em", "Salvo em", "Guardado el", "Enregistré le", "Gespeichert am", "Salvato il",
  "تاريخ الحفظ", "נשמר בתאריך", "保存日",
];

export interface ImportDiagnostics {
  // Posts whose URL parsed but whose metadata labels were not recognized —
  // usually an export in a language we don't cover yet.
  postsMissingMetadata: number;
  unknownLabels: string[];
}

export function newImportDiagnostics(): ImportDiagnostics {
  return { postsMissingMetadata: 0, unknownLabels: [] };
}

export function collectInstagramItems(value: unknown, collection: string, out: CatalogPost[], diag?: ImportDiagnostics): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) { value.forEach((v) => collectInstagramItems(v, collection, out, diag)); return; }

  const v = value as Record<string, unknown>;

  if (Array.isArray(v.label_values)) {
    const item = instagramItemFromLabelValues(v, collection, diag);
    if (item) out.push(item);
    return;
  }

  const item = instagramItemFromEntry(v, collection);
  if (item) out.push(item);

  const nextCollection = typeof v.name === "string" && v.name.trim() ? fixMojibake(v.name.trim()) : collection;
  for (const [key, child] of Object.entries(v)) {
    if (key === "string_map_data") continue;
    const childCollection = key === "media_list_data" ? nextCollection : collection;
    collectInstagramItems(child, childCollection, out, diag);
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

  const mapGet = (keys: string[]) => {
    for (const [k, v] of Object.entries(map)) {
      if (keys.includes(fixMojibake(k))) return v;
    }
    return undefined;
  };

  const savedInfo = mapGet(SAVED_ON_KEYS) ?? map["Date"] ?? mapValues.find((v) => v.timestamp) ?? {};
  const captionInfo = mapGet([...CAPTION_LABELS, "Text"]) ?? {};
  const timestamp = Number(entry.timestamp ?? entry.creation_timestamp ?? savedInfo.timestamp ?? 0) || null;
  const caption = fixMojibake(String(captionInfo.value ?? entry.caption ?? ""));
  const owner_name = fixMojibake(String(entry.title ?? entry.owner_name ?? entry.owner_username ?? "Instagram save"));
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

function dictNameValues(dict: unknown, wantedLabels: Set<string>): string[] {
  if (!Array.isArray(dict)) return [];
  const out: string[] = [];
  for (const outer of dict as Record<string, unknown>[]) {
    const inner = outer && Array.isArray(outer.dict) ? (outer.dict as Record<string, unknown>[]) : [];
    for (const d of inner) {
      if (typeof d.label === "string" && wantedLabels.has(fixMojibake(d.label)) && typeof d.value === "string" && d.value.trim()) {
        out.push(fixMojibake(d.value.trim()));
      }
    }
  }
  return out;
}

function instagramItemFromLabelValues(entry: Record<string, unknown>, collection: string, diag?: ImportDiagnostics): CatalogPost | null {
  const labelValues = entry.label_values as Record<string, unknown>[];

  let url = "";
  let caption = "";
  let title = "";
  let owner_name = "";
  let owner_username = "";
  const hashtags: string[] = [];
  const unmatched: string[] = [];

  for (const lv of labelValues) {
    if (!lv || typeof lv !== "object") continue;
    const label = typeof lv.label === "string" ? fixMojibake(lv.label) : "";
    const lvTitle = typeof lv.title === "string" ? fixMojibake(lv.title) : "";
    if (label === "URL") {
      const candidate = cleanUrl((lv.href ?? lv.value) as string);
      if (isInstagramPostUrl(candidate)) url = candidate;
    } else if (CAPTION_LABELS.has(label)) {
      caption = caption || fixMojibake(String(lv.value ?? ""));
    } else if (TITLE_LABELS.has(label)) {
      title = title || fixMojibake(String(lv.value ?? ""));
    } else if (OWNER_TITLES.has(lvTitle)) {
      owner_name = dictNameValues(lv.dict, NAME_LABELS)[0] ?? owner_name;
      owner_username = dictNameValues(lv.dict, USERNAME_LABELS)[0] ?? owner_username;
    } else if (lvTitle === "Hashtags") {
      hashtags.push(...dictNameValues(lv.dict, NAME_LABELS));
    } else if (label || lvTitle) {
      unmatched.push(label || lvTitle);
    }
  }

  if (!url || !isInstagramPostUrl(url)) return null;

  if (diag && !caption && !owner_name && !owner_username && unmatched.length) {
    diag.postsMissingMetadata++;
    for (const l of unmatched) {
      if (!diag.unknownLabels.includes(l)) diag.unknownLabels.push(l);
    }
  }

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

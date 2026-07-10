import type { CatalogPost, UserState } from "../types.js";
import { esc, fmtDate, initial, igProfile } from "../utils.js";

const COL_COLORS: Record<string, string> = {};
const PALETTE = ["#d6422a", "#1f5e54", "#c98a1a", "#7b4ea8", "#2b6cb0", "#b03a6e", "#3d7a3d", "#a05a2c"];

export function paintCollectionColors(collections: { name: string }[]): void {
  Object.keys(COL_COLORS).forEach((k) => delete COL_COLORS[k]);
  collections.forEach((c, i) => { COL_COLORS[c.name] = PALETTE[i % PALETTE.length]; });
}

export function getCollectionColor(name: string): string {
  return COL_COLORS[name] ?? "#999";
}

export function cardHtml(p: CatalogPost, state: UserState): string {
  const cap = p.caption ? esc(p.caption) : "";

  const chips = [
    ...p.collections.map((c) => `<span class="chip"><span class="cdot" style="background:${getCollectionColor(c)}"></span>${esc(c)}</span>`),
    ...(state.tags[p.id] ?? []).map((t) => `<span class="chip custom">#${esc(t)}</span>`),
  ].join("");

  const profileHref = esc(igProfile(p.owner_username, p.owner_url));
  const inTrash = !!state.trash[p.id];

  const trashAction = inTrash
    ? `<button class="act" data-restore="${esc(p.id)}"><svg viewBox="0 0 24 24"><path d="M3 7v6h6"/><path d="M3 13a9 9 0 1 0 3-7.7L3 7"/></svg>Restore</button>`
    : `<button class="act" data-discard="${esc(p.id)}"><svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 15h10l1-15"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>Discard</button>`;

  return `<div class="card${state.done[p.id] ? " done" : ""}" data-id="${esc(p.id)}" data-open="${esc(p.id)}">
    <div class="card-top">
      <span class="tagbadge ${esc(p.type)}">${esc(p.type)}</span>
      <span class="date">${fmtDate(p.timestamp)}</span>
      <button class="star-btn ${state.fav[p.id] ? "on" : ""}" data-fav="${esc(p.id)}"><svg viewBox="0 0 24 24"><path d="M12 17.3 6.16 20.5l1.12-6.5L2.5 9.4l6.54-.95L12 2.5l2.96 5.95 6.54.95-4.78 4.6 1.12 6.5z"/></svg></button>
    </div>
    <div class="owner">
      <span class="ava">${initial(p.owner_name, p.owner_username)}</span>
      <div style="overflow:hidden">
        <a href="${profileHref}" target="_blank" rel="noopener noreferrer" data-noopen>${esc(p.owner_name || p.owner_username || "Unknown")}</a>
        ${p.owner_username ? `<div class="uname">@${esc(p.owner_username)}</div>` : ""}
      </div>
    </div>
    ${cap
      ? `<div class="caplabel">Caption</div><div class="cap">${cap}</div>`
      : `<div class="cap empty">No caption on this post.</div>`
    }
    ${chips ? `<div class="chips">${chips}</div>` : ""}
    <div class="card-actions">
      <button class="act ${state.done[p.id] ? "on" : ""}" data-done="${esc(p.id)}"><svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>Watched</button>
      ${trashAction}
    </div>
  </div>`;
}

import type { Catalog, UserState } from "../types.js";
import { esc, fmtDate, initial, igProfile, safeHref } from "../utils.js";
import { getCollectionColor } from "./card.js";

let modalId: string | null = null;

export function getModalId(): string | null {
  return modalId;
}

export function openModal(id: string, catalog: Catalog, state: UserState): void {
  const p = catalog.posts.find((x) => x.id === id);
  if (!p) return;
  modalId = id;

  const tagOpts = state.customTags
    .map((t) => `<span class="tag-opt ${(state.tags[id] ?? []).includes(t) ? "sel" : ""}" data-toggletag="${esc(t)}">#${esc(t)}</span>`)
    .join("");

  const profileHref = esc(igProfile(p.owner_username, p.owner_url));

  document.getElementById("modal")!.innerHTML = `
    <div class="modal-head">
      <div class="mh-l">
        <span class="ava">${initial(p.owner_name, p.owner_username)}</span>
        <div>
          <div class="nm">${esc(p.owner_name || p.owner_username || "Unknown")}</div>
          ${p.owner_username ? `<a class="un" href="${profileHref}" target="_blank" rel="noopener noreferrer">@${esc(p.owner_username)} ↗</a>` : ""}
        </div>
      </div>
      <button class="xbtn" data-close>×</button>
    </div>
    <div class="modal-body">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <span class="tagbadge ${esc(p.type)}">${esc(p.type)}</span>
        <span class="date" style="margin-left:auto">saved ${fmtDate(p.timestamp)}</span>
      </div>
      <div class="mlabel">Full caption</div>
      <div class="full-cap">${p.caption ? esc(p.caption) : '<em style="color:var(--muted)">No caption.</em>'}</div>
      ${p.collections.length
        ? `<div class="mlabel">In collections</div><div class="tag-picker">${p.collections.map((c) => `<span class="tag-opt sel" style="background:${getCollectionColor(c)};border-color:${getCollectionColor(c)};color:#fff;cursor:default">${esc(c)}</span>`).join("")}</div>`
        : ""
      }
      <div class="mlabel">My tags ${state.customTags.length ? "" : "— create tags in the sidebar first"}</div>
      <div class="tag-picker">${tagOpts || '<span style="color:var(--muted);font-size:13px;font-style:italic">none yet</span>'}</div>
      <div class="mlabel">Notes</div>
      <textarea class="notes" id="notebox" placeholder="Why did you save this? What do you want to do with it?">${esc(state.notes[id] ?? "")}</textarea>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:18px">
        <a class="openig" href="${esc(safeHref(p.url))}" target="_blank" rel="noopener noreferrer">Open on Instagram ↗</a>
      </div>
    </div>`;

  document.getElementById("overlay")!.classList.add("show");
}

export function closeModal(): void {
  document.getElementById("overlay")?.classList.remove("show");
  modalId = null;
}

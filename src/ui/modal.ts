import type { Catalog, UserState } from "../types.js";
import { esc, fmtDate, igProfile, safeHref } from "../utils.js";
import { getCollectionColor } from "./card.js";
import { renderEmbed } from "./embed.js";
import { mountTagCombobox, closeTagCombobox } from "./tagCombobox.js";

let modalId: string | null = null;
let modalOnChange: () => void = () => {};

export function getModalId(): string | null {
  return modalId;
}

export function openModal(id: string, catalog: Catalog, state: UserState, onChange: () => void = modalOnChange): void {
  const p = catalog.posts.find((x) => x.id === id);
  if (!p) return;
  modalId = id;
  modalOnChange = onChange;

  const profileHref = esc(igProfile(p.owner_username, p.owner_url));

  document.getElementById("modal")!.innerHTML = `
    <div class="modal-split">
      <div class="modal-media" id="modal-media"></div>
      <div class="modal-info">
        <div class="modal-head">
          <span class="tagbadge ${esc(p.type)}">${esc(p.type)}</span>
          <span class="date">${fmtDate(p.timestamp)}</span>
          <button class="star-btn ${state.fav[id] ? "on" : ""}" data-fav="${esc(id)}"><svg viewBox="0 0 24 24"><path d="M12 17.3 6.16 20.5l1.12-6.5L2.5 9.4l6.54-.95L12 2.5l2.96 5.95 6.54.95-4.78 4.6 1.12 6.5z"/></svg></button>
        </div>
        <div class="modal-body">
          <div class="modal-owner">
            <div>
              <div class="nm">${esc(p.owner_name || p.owner_username || "Unknown")}</div>
              ${p.owner_username ? `<a class="un" href="${profileHref}" target="_blank" rel="noopener noreferrer">@${esc(p.owner_username)} ↗</a>` : ""}
            </div>
          </div>
          <div class="full-cap">${p.caption ? esc(p.caption) : '<em style="color:var(--muted)">No caption.</em>'}</div>
          ${p.collections.length
            ? `<div class="mlabel">In collections</div><div class="tag-picker">${p.collections.map((c) => `<span class="tag-opt sel" style="background:${getCollectionColor(c)};border-color:${getCollectionColor(c)};color:#fff;cursor:default">${esc(c)}</span>`).join("")}</div>`
            : ""
          }
          <div class="mlabel">Tags</div>
          <div class="tagcombo" id="tagcombo"></div>
          <div class="mlabel">Notes</div>
          <textarea class="notes" id="notebox" placeholder="Why did you save this? What do you want to do with it?">${esc(state.notes[id] ?? "")}</textarea>
          <div class="modal-actions">
            <button type="button" class="modal-secondary ${state.done[id] ? "on" : ""}" data-done="${esc(id)}"><svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>Watched</button>
            <button type="button" class="modal-tertiary" data-discard="${esc(id)}"><svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 15h10l1-15"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>Discard</button>
          </div>
        </div>
      </div>
    </div>`;

  document.getElementById("overlay")!.classList.add("show");

  const mediaEl = document.getElementById("modal-media");
  if (mediaEl) renderEmbed(mediaEl, safeHref(p.url));

  const comboEl = document.getElementById("tagcombo");
  if (comboEl) mountTagCombobox(comboEl, state, id, () => modalOnChange());
}

export function closeModal(): void {
  document.getElementById("overlay")?.classList.remove("show");
  modalId = null;
  closeTagCombobox();
}

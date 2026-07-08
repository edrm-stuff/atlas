import type { Catalog, UserState } from "../types.js";
import { esc, fmtDate, initial, igProfile } from "../utils.js";
import { getCollectionColor } from "./card.js";

export let modalId: string | null = null;

export function openModal(id: string, catalog: Catalog, state: UserState): void {
  const p = catalog.posts.find((x) => x.id === id);
  if (!p) return;
  modalId = id;

  const tagOpts = state.customTags
    .map((t) => `<span class="tag-opt ${(state.tags[id] ?? []).includes(t) ? "sel" : ""}" data-toggletag="${esc(t)}">#${esc(t)}</span>`)
    .join("");

  const profileHref = esc(igProfile(p.owner_username, p.owner_url));
  const isAiGenerated = p.ai?.status === "done";

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
        ${(p.captionTags ?? []).map((t) => `<span class="stag" data-stag="${esc(t)}" style="font-size:11px">#${esc(t)}</span>`).join("")}
        ${(p.suggestedTags ?? []).map((t) => `<span class="stag ai-tag" data-stag="${esc(t)}" style="font-size:11px" title="AI suggested">✨${esc(t)}</span>`).join("")}
        <span class="date" style="margin-left:auto">saved ${fmtDate(p.timestamp)}</span>
      </div>
      <div class="mlabel">${isAiGenerated ? "✨ AI TL;DR" : "TL;DR"}</div>
      <div style="font-size:15px;line-height:1.55;color:var(--ink);font-weight:500">${esc(p.tldr ?? "")}</div>
      ${p.ai?.status === "error" ? `<div style="font-size:12px;color:var(--accent);margin-top:4px">AI error: ${esc(p.ai.error ?? "")}</div>` : ""}
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
        <a class="openig" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">Open on Instagram ↗</a>
        <button class="toolbtn ghost" data-generate-single="${esc(id)}" style="font-size:11px">✨ Generate AI summary</button>
      </div>
    </div>`;

  document.getElementById("overlay")!.classList.add("show");
}

export function closeModal(): void {
  document.getElementById("overlay")?.classList.remove("show");
  modalId = null;
}

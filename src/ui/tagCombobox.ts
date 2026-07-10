import { esc } from "../utils.js";
import { getTagColor, tintedChipStyle, createTag } from "../tagColors.js";
import type { UserState } from "../types.js";

interface Ctx {
  state: UserState;
  postId: string;
  onChange: () => void;
}

let dropEl: HTMLElement | null = null;
let fieldEl: HTMLElement | null = null;
let query = "";
let onDocDown: ((e: MouseEvent) => void) | null = null;
let onKeydown: ((e: KeyboardEvent) => void) | null = null;

function selectedTags(ctx: Ctx): string[] {
  return ctx.state.tags[ctx.postId] ?? (ctx.state.tags[ctx.postId] = []);
}

function closeDropdown(): void {
  if (dropEl) { dropEl.remove(); dropEl = null; }
  if (onDocDown) { document.removeEventListener("mousedown", onDocDown, true); onDocDown = null; }
  if (onKeydown) { document.removeEventListener("keydown", onKeydown, true); onKeydown = null; }
  query = "";
}

function chipHtml(state: UserState, tag: string): string {
  const hex = getTagColor(state, tag);
  const { background, color } = tintedChipStyle(hex);
  return `<span class="tagcombo-chip" style="background:${background};color:${color}">
    <span class="tagcombo-chip-dot" style="background:${hex}"></span>${esc(tag)}
    <button type="button" class="tagcombo-chip-x" data-combo-remove="${esc(tag)}" aria-label="Remove ${esc(tag)}">×</button>
  </span>`;
}

function renderField(container: HTMLElement, ctx: Ctx): void {
  const selected = selectedTags(ctx);
  const chips = selected.map((t) => chipHtml(ctx.state, t)).join("");
  const field = container.querySelector("#tagcombo-field")!;
  field.innerHTML = `${chips}<span class="tagcombo-ph">${selected.length ? "" : "Add tags…"}</span>
    <svg class="tagcombo-caret" viewBox="0 0 24 24" width="14" height="14"><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function rowsHtml(ctx: Ctx): string {
  const selected = new Set(selectedTags(ctx));
  const q = query.trim().toLowerCase();
  const filtered = ctx.state.customTags.filter((t) => t.toLowerCase().includes(q));
  const exact = ctx.state.customTags.some((t) => t.toLowerCase() === q);
  const createRow = q && !exact
    ? `<button type="button" class="tagcombo-create" data-combo-create="${esc(query.trim())}">+ Create "${esc(query.trim())}"</button>`
    : "";
  const rows = filtered.length
    ? filtered
        .map((t) => {
          const hex = getTagColor(ctx.state, t);
          const sel = selected.has(t);
          return `<button type="button" class="tagcombo-row${sel ? " sel" : ""}" data-combo-toggle="${esc(t)}">
            <span class="tagcombo-swatch" style="background:${hex}"></span>
            <span class="tagcombo-rowname">${esc(t)}</span>
            ${sel ? '<span class="tagcombo-rowcheck">✓</span>' : ""}
          </button>`;
        })
        .join("")
    : `<div class="tagcombo-empty">${q ? "No matching tags" : "No tags yet"}</div>`;
  return createRow + rows;
}

function positionDrop(drop: HTMLElement, anchor: HTMLElement): void {
  const rect = anchor.getBoundingClientRect();
  const dropRect = drop.getBoundingClientRect();
  let left = rect.left;
  let top = rect.bottom + 6;
  if (left + dropRect.width > window.innerWidth - 8) left = window.innerWidth - dropRect.width - 8;
  if (top + dropRect.height > window.innerHeight - 8) top = rect.top - dropRect.height - 6;
  drop.style.left = `${Math.max(8, left)}px`;
  drop.style.width = `${Math.max(rect.width, 220)}px`;
  drop.style.top = `${Math.max(8, top)}px`;
}

function openDropdown(container: HTMLElement, ctx: Ctx): void {
  closeDropdown();

  const drop = document.createElement("div");
  drop.className = "tagcombo-drop";
  drop.innerHTML = `
    <div class="tagcombo-search">
      <input type="text" id="tagcombo-search-input" placeholder="Search or create…" autocomplete="off" />
      <button type="button" class="tagcombo-clear" id="tagcombo-clear" style="display:none">×</button>
    </div>
    <div class="tagcombo-rows" id="tagcombo-rows">${rowsHtml(ctx)}</div>`;
  document.body.appendChild(drop);
  dropEl = drop;
  positionDrop(drop, fieldEl!);

  const searchInput = drop.querySelector("#tagcombo-search-input") as HTMLInputElement;
  const clearBtn = drop.querySelector("#tagcombo-clear") as HTMLElement;
  searchInput.focus();

  const refreshRows = () => {
    drop.querySelector("#tagcombo-rows")!.innerHTML = rowsHtml(ctx);
    clearBtn.style.display = query ? "" : "none";
  };

  const commitCreate = (raw: string) => {
    const name = createTag(ctx.state, raw);
    if (!name) return;
    const sel = selectedTags(ctx);
    if (!sel.includes(name)) sel.push(name);
    query = "";
    searchInput.value = "";
    renderField(container, ctx);
    refreshRows();
    ctx.onChange();
  };

  const toggleTag = (tag: string) => {
    const sel = selectedTags(ctx);
    const i = sel.indexOf(tag);
    if (i >= 0) sel.splice(i, 1); else sel.push(tag);
    renderField(container, ctx);
    refreshRows();
    ctx.onChange();
  };

  searchInput.addEventListener("input", () => { query = searchInput.value; refreshRows(); });
  clearBtn.addEventListener("click", () => { query = ""; searchInput.value = ""; searchInput.focus(); refreshRows(); });

  drop.addEventListener("click", (e) => {
    const createBtn = (e.target as HTMLElement).closest("[data-combo-create]") as HTMLElement | null;
    if (createBtn) { commitCreate(createBtn.dataset.comboCreate!); searchInput.focus(); return; }
    const rowBtn = (e.target as HTMLElement).closest("[data-combo-toggle]") as HTMLElement | null;
    if (rowBtn) { toggleTag(rowBtn.dataset.comboToggle!); searchInput.focus(); return; }
  });

  onDocDown = (e: MouseEvent) => {
    const target = e.target as Node;
    if (dropEl?.contains(target) || fieldEl?.contains(target)) return;
    closeDropdown();
  };
  onKeydown = (e: KeyboardEvent) => {
    if (e.key === "Escape") { e.stopPropagation(); closeDropdown(); return; }
    if (e.key === "Enter") {
      const trimmed = searchInput.value.trim();
      if (!trimmed) return;
      const exact = ctx.state.customTags.find((t) => t.toLowerCase() === trimmed.toLowerCase());
      if (exact) toggleTag(exact); else commitCreate(trimmed);
    }
  };
  document.addEventListener("mousedown", onDocDown, true);
  document.addEventListener("keydown", onKeydown, true);
}

export function closeTagCombobox(): void {
  closeDropdown();
}

export function mountTagCombobox(container: HTMLElement, state: UserState, postId: string, onChange: () => void): void {
  closeDropdown();
  const ctx: Ctx = { state, postId, onChange };

  container.innerHTML = `<div class="tagcombo-field" id="tagcombo-field" tabindex="0"></div>`;
  fieldEl = container.querySelector("#tagcombo-field") as HTMLElement;
  renderField(container, ctx);

  container.addEventListener("click", (e) => {
    const removeBtn = (e.target as HTMLElement).closest("[data-combo-remove]") as HTMLElement | null;
    if (removeBtn) {
      const sel = selectedTags(ctx);
      const i = sel.indexOf(removeBtn.dataset.comboRemove!);
      if (i >= 0) sel.splice(i, 1);
      renderField(container, ctx);
      ctx.onChange();
      if (dropEl) dropEl.querySelector("#tagcombo-rows")!.innerHTML = rowsHtml(ctx);
      return;
    }
    if ((e.target as HTMLElement).closest("#tagcombo-field")) {
      if (dropEl) closeDropdown(); else openDropdown(container, ctx);
    }
  });
}

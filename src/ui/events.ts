import type { Catalog, UserState, ViewState } from "../types.js";
import { saveUserState, replacePosts, putPosts, putCollections, deletePosts } from "../storage/db.js";
import { openModal, closeModal, getModalId } from "./modal.js";
import { renderNav, renderGrid, renderStats, extendGrid, updateCardInGrid } from "./render.js";
import { normalizeImportedData, parseImportedText } from "../import/index.js";
import { mergeCatalog, rebuildCollections } from "../import/merge.js";
import { paintCollectionColors } from "./card.js";
import { getTagColor, DEFAULT_COLOR, createTag } from "../tagColors.js";
import { openColorPopover } from "./colorPopover.js";

function emptyState(): UserState {
  return { fav: {}, done: {}, notes: {}, tags: {}, customTags: [], tagColors: {}, trash: {}, purged: {} };
}

let _catalog: Catalog = { posts: [], collections: [] };
let _state: UserState = emptyState();
let _view: ViewState = { scope: "all", type: "all", q: "", sort: "new" };
let _saveTimer: ReturnType<typeof setTimeout> | null = null;
let _searchTimer: ReturnType<typeof setTimeout> | null = null;

export function init(catalog: Catalog, state: UserState): void {
  _catalog = catalog;
  _state = state;
}

export function getCatalog(): Catalog { return _catalog; }
export function getState(): UserState { return _state; }
export function getView(): ViewState { return _view; }

function rerender(): void {
  renderStats(_catalog, _state);
  renderNav(_catalog, _state, _view);
  renderGrid(_catalog, _state, _view);
}

function queueSave(): void {
  const msg = document.getElementById("savemsg");
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(async () => {
    await saveUserState(_state);
    if (msg) msg.textContent = "All changes saved";
  }, 350);
  if (msg) msg.textContent = "Saving…";
}

function setSavemsg(text: string): void {
  const msg = document.getElementById("savemsg");
  if (msg) msg.textContent = text;
}

export function wireEvents(): void {
  // Delegated click handler
  document.addEventListener("click", async (e) => {
    const t = e.target as HTMLElement;


    // Tag color dot → open color popover (must not switch scope)
    const colorDotEl = t.closest("[data-colordot]") as HTMLElement | null;
    if (colorDotEl) {
      e.stopPropagation();
      const tag = colorDotEl.dataset.colordot!;
      const current = getTagColor(_state, tag);
      openColorPopover(colorDotEl, current, DEFAULT_COLOR, (hex) => {
        _state.tagColors[tag] = hex;
        queueSave();
        renderNav(_catalog, _state, _view);
        renderGrid(_catalog, _state, _view);
        const modalId = getModalId();
        if (modalId) openModal(modalId, _catalog, _state);
      });
      return;
    }

    // Nav scope
    const scopeBtn = t.closest("[data-scope]") as HTMLElement | null;
    if (scopeBtn && !t.closest("[data-deltag]") && !t.closest("[data-colordot]")) {
      _view.scope = scopeBtn.dataset.scope!;
      renderNav(_catalog, _state, _view);
      renderGrid(_catalog, _state, _view);
      return;
    }

    // Delete tag
    const delTagEl = t.closest("[data-deltag]") as HTMLElement | null;
    if (delTagEl) {
      const tag = delTagEl.dataset.deltag!;
      if (confirm(`Delete tag "${tag}"? It will be removed from all posts.`)) {
        _state.customTags = _state.customTags.filter((x) => x !== tag);
        Object.keys(_state.tags).forEach((k) => { _state.tags[k] = _state.tags[k].filter((x) => x !== tag); });
        if (_view.scope === "tag:" + tag) _view.scope = "all";
        queueSave();
        renderNav(_catalog, _state, _view);
        renderGrid(_catalog, _state, _view);
      }
      return;
    }

    // Fav toggle — update every matching star button (card grid + modal), not a full re-render
    const favEl = t.closest("[data-fav]") as HTMLElement | null;
    if (favEl) {
      const id = favEl.dataset.fav!;
      _state.fav[id] = !_state.fav[id];
      queueSave();
      document.querySelectorAll(`[data-fav="${CSS.escape(id)}"]`).forEach((btn) => {
        btn.classList.toggle("on", !!_state.fav[id]);
        const svg = btn.querySelector("svg path");
        if (svg) (svg as HTMLElement).style.fill = _state.fav[id] ? "var(--accent)" : "";
      });
      renderNav(_catalog, _state, _view);
      renderStats(_catalog, _state);
      return;
    }

    // Done/watched toggle — update every matching button (card grid + modal)
    const doneEl = t.closest("[data-done]") as HTMLElement | null;
    if (doneEl) {
      const id = doneEl.dataset.done!;
      _state.done[id] = !_state.done[id];
      queueSave();
      const card = document.querySelector(`.card[data-id="${CSS.escape(id)}"]`) as HTMLElement | null;
      card?.classList.toggle("done", !!_state.done[id]);
      document.querySelectorAll(`[data-done="${CSS.escape(id)}"]`).forEach((btn) => btn.classList.toggle("on", !!_state.done[id]));
      renderNav(_catalog, _state, _view);
      renderStats(_catalog, _state);
      return;
    }

    // Discard → trash
    const discardEl = t.closest("[data-discard]") as HTMLElement | null;
    if (discardEl) {
      const id = discardEl.dataset.discard!;
      _state.trash[id] = true;
      queueSave();
      if (getModalId() === id) closeModal();
      rerender();
      return;
    }

    // Restore from trash
    const restoreEl = t.closest("[data-restore]") as HTMLElement | null;
    if (restoreEl) {
      const id = restoreEl.dataset.restore!;
      delete _state.trash[id];
      queueSave();
      rerender();
      return;
    }

    // Empty trash
    if (t.id === "empty-trash-btn") { await handleEmptyTrash(); return; }

    // Open modal (skip if the click originated on an element that opts out, e.g. the owner link)
    if (t.closest("[data-noopen]")) return;
    const openEl = t.closest("[data-open]") as HTMLElement | null;
    if (openEl) {
      const id = openEl.dataset.open!;
      openModal(id, _catalog, _state, () => {
        queueSave();
        renderNav(_catalog, _state, _view);
        updateCardInGrid(id, _state);
      });
      return;
    }

    // Close modal
    if (t.id === "overlay") { closeModal(); return; }

    // Import
    if (t.id === "import-btn") { document.getElementById("import-file")?.click(); return; }

    // Reset
    if (t.id === "reset-btn") { await handleReset(); return; }
  });

  // Input handlers
  document.addEventListener("input", (e) => {
    const t = e.target as HTMLInputElement | HTMLTextAreaElement;

    if (t.id === "search") {
      if (_searchTimer) clearTimeout(_searchTimer);
      _searchTimer = setTimeout(() => {
        _view.q = (t as HTMLInputElement).value.trim();
        renderGrid(_catalog, _state, _view);
      }, 150);
    }
  });

  // Notebox
  document.addEventListener("input", (e) => {
    if ((e.target as HTMLElement).id !== "notebox") return;
    const modalId = getModalId();
    if (modalId) { _state.notes[modalId] = (e.target as HTMLTextAreaElement).value; queueSave(); }
  });

  // Type segment
  document.getElementById("typeseg")?.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest("button") as HTMLElement | null;
    if (!b) return;
    _view.type = b.dataset.type!;
    document.querySelectorAll("#typeseg button").forEach((x) => x.classList.toggle("active", x === b));
    renderGrid(_catalog, _state, _view);
  });

  // Sort
  document.getElementById("sort")?.addEventListener("change", (e) => {
    _view.sort = (e.target as HTMLSelectElement).value as ViewState["sort"];
    renderGrid(_catalog, _state, _view);
  });

  // File import
  document.getElementById("import-file")?.addEventListener("change", async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) await handleImport(file);
  });

  // Add tag
  const addTagFn = () => {
    const inp = document.getElementById("newtag") as HTMLInputElement;
    if (!createTag(_state, inp.value)) return;
    inp.value = "";
    queueSave();
    renderNav(_catalog, _state, _view);
  };
  document.getElementById("addtag-btn")?.addEventListener("click", addTagFn);
  document.getElementById("newtag")?.addEventListener("keydown", (e) => { if (e.key === "Enter") addTagFn(); });

  // ESC key (the tag combobox dropdown handles its own Escape and stops it there)
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !document.querySelector(".tagcombo-drop")) closeModal();
  });

  // Lazy grid extension
  const sentinel = document.getElementById("grid-sentinel");
  if (sentinel) {
    new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) extendGrid(_state);
    }, { rootMargin: "200px" }).observe(sentinel);
  }

  // Overlay click to close
  document.getElementById("overlay")?.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).id === "overlay") closeModal();
  });
}

async function handleImport(file: File): Promise<void> {
  setSavemsg("Importing…");
  try {
    const text = await file.text();
    const raw = parseImportedText(text, file.name);
    const { catalog: incoming, warning } = normalizeImportedData(raw, file.name);
    const { catalog, added, updated } = mergeCatalog(_catalog, incoming, _state.purged);
    _catalog = catalog;
    paintCollectionColors(_catalog.collections);
    await putPosts(_catalog.posts);
    await putCollections(_catalog.collections);
    rerender();
    setSavemsg(`Imported ${added} new · refreshed ${updated} existing`);
    if (warning) alert(warning);
  } catch (err) {
    setSavemsg("Import failed");
    alert((err as Error).message ?? "Import failed.");
  } finally {
    const input = document.getElementById("import-file") as HTMLInputElement | null;
    if (input) input.value = "";
  }
}

async function handleReset(): Promise<void> {
  if (!confirm("Reset catalog data in this browser? This removes imported items, notes, tags, favorites, and watched status.")) return;
  _catalog = { posts: [], collections: [] };
  _state = emptyState();
  _view = { scope: "all", type: "all", q: "", sort: "new" };
  resetViewControls();
  await replacePosts([]);
  await putCollections([]);
  await saveUserState(_state);
  rerender();
  setSavemsg("Catalog reset");
}

async function handleEmptyTrash(): Promise<void> {
  const ids = Object.keys(_state.trash).filter((id) => _state.trash[id]);
  if (!ids.length) return;
  if (!confirm(`Permanently delete ${ids.length} item${ids.length === 1 ? "" : "s"} from Trash? This cannot be undone.`)) return;

  ids.forEach((id) => { _state.purged[id] = true; delete _state.trash[id]; delete _state.fav[id]; delete _state.done[id]; delete _state.notes[id]; delete _state.tags[id]; });
  _catalog.posts = _catalog.posts.filter((p) => !ids.includes(p.id));
  _catalog.collections = rebuildCollections(_catalog.posts, _catalog.collections);

  await deletePosts(ids);
  await putCollections(_catalog.collections);
  queueSave();
  if (_view.scope === "trash") _view.scope = "all";
  rerender();
  setSavemsg(`Emptied ${ids.length} item${ids.length === 1 ? "" : "s"} from trash`);
}

function resetViewControls(): void {
  const search = document.getElementById("search") as HTMLInputElement | null;
  const sort = document.getElementById("sort") as HTMLSelectElement | null;
  if (search) search.value = "";
  if (sort) sort.value = "new";
  document.querySelectorAll("#typeseg button").forEach((x) =>
    x.classList.toggle("active", (x as HTMLElement).dataset.type === "all")
  );
  closeModal();
}

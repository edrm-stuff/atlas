import type { Catalog, UserState, ViewState } from "../types.js";
import { saveUserState, replacePosts, putPosts, putCollections, deletePosts } from "../storage/db.js";
import { openModal, closeModal, getModalId } from "./modal.js";
import { renderNav, renderGrid, renderStats, extendGrid } from "./render.js";
import { normalizeImportedData, parseImportedText } from "../import/index.js";
import { mergeCatalog } from "../import/merge.js";
import { paintCollectionColors } from "./card.js";

function emptyState(): UserState {
  return { fav: {}, done: {}, notes: {}, tags: {}, customTags: [], trash: {}, purged: {} };
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
    if (msg) msg.textContent = "all changes saved";
  }, 350);
  if (msg) msg.textContent = "saving…";
}

function setSavemsg(text: string): void {
  const msg = document.getElementById("savemsg");
  if (msg) msg.textContent = text;
}

export function wireEvents(): void {
  // Delegated click handler
  document.addEventListener("click", async (e) => {
    const t = e.target as HTMLElement;

    // Smart tag / AI tag click → filter
    const stagEl = t.closest("[data-stag]") as HTMLElement | null;
    if (stagEl) {
      const tag = stagEl.dataset.stag!;
      closeModal();
      const searchEl = document.getElementById("search") as HTMLInputElement | null;
      if (searchEl) searchEl.value = tag;
      _view.q = tag.toLowerCase();
      renderGrid(_catalog, _state, _view);
      document.querySelector("main")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    // Nav scope
    const scopeBtn = t.closest("[data-scope]") as HTMLElement | null;
    if (scopeBtn && !t.closest("[data-deltag]")) {
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

    // Fav toggle — update single card, not full grid
    const favEl = t.closest("[data-fav]") as HTMLElement | null;
    if (favEl) {
      const id = favEl.dataset.fav!;
      _state.fav[id] = !_state.fav[id];
      queueSave();
      const card = document.querySelector(`.card[data-id="${CSS.escape(id)}"]`) as HTMLElement | null;
      if (card) {
        const btn = card.querySelector("[data-fav]");
        btn?.classList.toggle("on", !!_state.fav[id]);
        const svg = btn?.querySelector("svg path");
        if (svg) (svg as HTMLElement).style.fill = _state.fav[id] ? "var(--accent)" : "";
      }
      renderNav(_catalog, _state, _view);
      renderStats(_catalog, _state);
      return;
    }

    // Done/watched toggle — update single card
    const doneEl = t.closest("[data-done]") as HTMLElement | null;
    if (doneEl) {
      const id = doneEl.dataset.done!;
      _state.done[id] = !_state.done[id];
      queueSave();
      const card = document.querySelector(`.card[data-id="${CSS.escape(id)}"]`) as HTMLElement | null;
      if (card) {
        card.classList.toggle("done", !!_state.done[id]);
        const btn = card.querySelector("[data-done]");
        btn?.classList.toggle("on", !!_state.done[id]);
      }
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

    // Open modal
    const openEl = t.closest("[data-open]") as HTMLElement | null;
    if (openEl) { openModal(openEl.dataset.open!, _catalog, _state); return; }

    // Close modal
    if (t.closest("[data-close]") || t.id === "overlay") { closeModal(); return; }

    // Toggle tag in modal
    const toggleTagEl = t.closest("[data-toggletag]") as HTMLElement | null;
    if (toggleTagEl) {
      const modalId = getModalId();
      if (!modalId) return;
      const tag = toggleTagEl.dataset.toggletag!;
      const arr = _state.tags[modalId] ?? (_state.tags[modalId] = []);
      const i = arr.indexOf(tag);
      if (i >= 0) arr.splice(i, 1); else arr.push(tag);
      queueSave();
      toggleTagEl.classList.toggle("sel");
      renderNav(_catalog, _state, _view);
      renderGrid(_catalog, _state, _view);
      return;
    }

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
    const v = inp.value.trim().replace(/^#/, "");
    if (!v) return;
    if (!_state.customTags.includes(v)) _state.customTags.push(v);
    inp.value = "";
    queueSave();
    renderNav(_catalog, _state, _view);
  };
  document.getElementById("addtag-btn")?.addEventListener("click", addTagFn);
  document.getElementById("newtag")?.addEventListener("keydown", (e) => { if (e.key === "Enter") addTagFn(); });

  // ESC key
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeModal(); } });

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
  setSavemsg("importing…");
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
    setSavemsg(`imported ${added} new · refreshed ${updated} existing`);
    if (warning) alert(warning);
  } catch (err) {
    setSavemsg("import failed");
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
  setSavemsg("catalog reset");
}

async function handleEmptyTrash(): Promise<void> {
  const ids = Object.keys(_state.trash).filter((id) => _state.trash[id]);
  if (!ids.length) return;
  if (!confirm(`Permanently delete ${ids.length} item${ids.length === 1 ? "" : "s"} from Trash? This cannot be undone.`)) return;

  ids.forEach((id) => { _state.purged[id] = true; delete _state.trash[id]; delete _state.fav[id]; delete _state.done[id]; delete _state.notes[id]; delete _state.tags[id]; });
  _catalog.posts = _catalog.posts.filter((p) => !ids.includes(p.id));

  const names: string[] = [];
  _catalog.posts.forEach((p) => p.collections.forEach((n) => { if (n && !names.includes(n)) names.push(n); }));
  _catalog.collections = names.map((name) => {
    const inCollection = _catalog.posts.filter((p) => p.collections.includes(name));
    const original = _catalog.collections.find((c) => c.name === name);
    return {
      name,
      count: inCollection.length,
      updated: original?.updated ?? (Math.max(0, ...inCollection.map((p) => p.timestamp ?? 0)) || null),
    };
  });

  await deletePosts(ids);
  await putCollections(_catalog.collections);
  queueSave();
  if (_view.scope === "trash") _view.scope = "all";
  rerender();
  setSavemsg(`emptied ${ids.length} item${ids.length === 1 ? "" : "s"} from trash`);
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

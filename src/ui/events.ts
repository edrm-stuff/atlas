import type { Catalog, UserState, ViewState } from "../types.js";
import { saveUserState, putPosts, putCollections } from "../storage/db.js";
import { openModal, closeModal } from "./modal.js";
import { openSettings, closeSettings, loadAiSettings } from "./settings.js";
import { renderNav, renderGrid, renderStats, extendGrid, updateCardInGrid } from "./render.js";
import { normalizeImportedData, parseImportedText } from "../import/index.js";
import { AnthropicProvider } from "../ai/anthropic.js";
import { OpenAiProvider } from "../ai/openai.js";
import { generateBatch, cancelGeneration } from "../ai/generate.js";
import { currentSet } from "../filter.js";
import { paintCollectionColors } from "./card.js";

let _catalog: Catalog = { posts: [], collections: [] };
let _state: UserState = { fav: {}, done: {}, notes: {}, tags: {}, customTags: [] };
let _view: ViewState = { scope: "all", type: "all", q: "", sort: "new" };
let _saveTimer: ReturnType<typeof setTimeout> | null = null;
let _searchTimer: ReturnType<typeof setTimeout> | null = null;
let _generating = false;

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

    // Open modal
    const openEl = t.closest("[data-open]") as HTMLElement | null;
    if (openEl) { openModal(openEl.dataset.open!, _catalog, _state); return; }

    // Close modal
    if (t.closest("[data-close]") || t.id === "overlay") { closeModal(); return; }

    // Toggle tag in modal
    const toggleTagEl = t.closest("[data-toggletag]") as HTMLElement | null;
    if (toggleTagEl) {
      const { modalId } = await import("./modal.js");
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

    // Settings close
    if (t.closest("[data-close-settings]") || t.id === "settings-overlay") { closeSettings(); return; }

    // Settings open
    if (t.id === "settings-btn") { openSettings(); return; }

    // Import
    if (t.id === "import-btn") { document.getElementById("import-file")?.click(); return; }

    // Reset
    if (t.id === "reset-btn") { await handleReset(); return; }

    // AI button
    if (t.id === "ai-btn") { await handleAiBatch("all-missing"); return; }

    // Generate single from modal
    const genSingleEl = t.closest("[data-generate-single]") as HTMLElement | null;
    if (genSingleEl) { await handleAiBatch("single", genSingleEl.dataset.generateSingle); return; }

    // Cancel AI
    if (t.id === "ai-cancel-btn") { cancelGeneration(); return; }
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

  // Actually wire notebox by re-reading modalId from module
  document.addEventListener("input", async (e) => {
    if ((e.target as HTMLElement).id !== "notebox") return;
    const { modalId } = await import("./modal.js");
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
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeModal(); closeSettings(); } });

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
  document.getElementById("settings-overlay")?.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).id === "settings-overlay") closeSettings();
  });
}

async function handleImport(file: File): Promise<void> {
  if (_catalog.posts.length && !confirm("Importing replaces the catalog stored in this browser. Continue?")) return;
  setSavemsg("importing…");
  try {
    const text = await file.text();
    const raw = parseImportedText(text, file.name);
    const catalog = normalizeImportedData(raw, file.name);
    _catalog = catalog;
    _state = { fav: {}, done: {}, notes: {}, tags: {}, customTags: [] };
    _view = { scope: "all", type: "all", q: "", sort: "new" };
    resetViewControls();
    paintCollectionColors(_catalog.collections);
    await putPosts(_catalog.posts);
    await putCollections(_catalog.collections);
    await saveUserState(_state);
    rerender();
    setSavemsg(`imported ${_catalog.posts.length} items`);
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
  _state = { fav: {}, done: {}, notes: {}, tags: {}, customTags: [] };
  _view = { scope: "all", type: "all", q: "", sort: "new" };
  resetViewControls();
  await putPosts([]);
  await putCollections([]);
  await saveUserState(_state);
  rerender();
  setSavemsg("catalog reset");
}

async function handleAiBatch(mode: "all-missing" | "single" | "visible", singleId?: string): Promise<void> {
  if (_generating) return;
  const settings = loadAiSettings();
  if (!settings) { openSettings(); return; }

  let posts = _catalog.posts;
  if (mode === "all-missing") posts = posts.filter((p) => !p.ai || p.ai.status !== "done");
  else if (mode === "visible") posts = currentSet(_catalog, _state, _view).filter((p) => !p.ai || p.ai.status !== "done");
  else if (mode === "single" && singleId) posts = _catalog.posts.filter((p) => p.id === singleId);

  if (!posts.length) { alert("No posts need AI summaries."); return; }

  const provider = settings.provider === "anthropic"
    ? new AnthropicProvider(settings.apiKey, settings.model)
    : new OpenAiProvider(settings.apiKey, settings.model);

  _generating = true;
  showProgressBar(true);

  await generateBatch(
    posts,
    provider,
    settings.model,
    (progress) => {
      updateProgressBar(progress.current, progress.total, progress.cancelled);
      if (progress.done || progress.cancelled) {
        _generating = false;
        setTimeout(() => showProgressBar(false), 2000);
      }
    },
    (updated) => {
      // Patch catalog in-memory
      const idx = _catalog.posts.findIndex((p) => p.id === updated.id);
      if (idx >= 0) _catalog.posts[idx] = updated;
      // Update card if visible
      updateCardInGrid(updated.id, _state);
    }
  );
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

function showProgressBar(show: boolean): void {
  const bar = document.getElementById("ai-progress-bar");
  if (bar) bar.style.display = show ? "block" : "none";
}

function updateProgressBar(current: number, total: number, cancelled: boolean): void {
  const inner = document.getElementById("ai-progress-inner");
  if (!inner) return;
  const pct = total ? Math.round((current / total) * 100) : 0;
  inner.style.width = pct + "%";
  inner.textContent = cancelled ? "Cancelled" : `${current} / ${total}`;
}

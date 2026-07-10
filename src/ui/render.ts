import type { Catalog, UserState, ViewState } from "../types.js";
import { esc } from "../utils.js";
import { currentSet, computeCounts } from "../filter.js";
import { cardHtml, paintCollectionColors } from "./card.js";
import { getTagColor } from "../tagColors.js";

const PAGE_SIZE = 100;
let _renderedCount = 0;
let _currentList: ReturnType<typeof currentSet> = [];

export function renderStats(catalog: Catalog, state: UserState): void {
  const active = catalog.posts.filter((p) => !state.trash[p.id]);
  const total = active.length;
  const reels = active.filter((p) => p.type === "reel").length;
  const creators = new Set(active.map((p) => p.owner_username || p.owner_name)).size;
  const fav = Object.values(state.fav).filter(Boolean).length;
  const done = Object.values(state.done).filter(Boolean).length;

  const items: [number, string][] = [
    [total, "Total saved"], [reels, "Reels"],
    [catalog.collections.length, "Collections"], [creators, "Creators"],
    [fav, "Favorites"], [done, "Watched"],
  ];

  const el = document.getElementById("stats");
  if (el) el.innerHTML = items.map(([n, l]) => `<div class="stat"><div class="n">${n}</div><div class="l">${l}</div></div>`).join("");

  const ledeEl = document.getElementById("lede-n");
  if (ledeEl) ledeEl.textContent = `${total} items`;
}

function navBtn(scope: string, label: string, count: number, dot?: string, delTag?: string): string {
  const active = scope === _currentView?.scope ? " active" : "";
  const dotHtml = dot ? `<span class="dot" data-colordot="${esc(delTag ?? "")}" style="background:${dot}"></span>` : "";
  const del = delTag ? `<span class="tagchip-del" data-deltag="${esc(delTag)}" title="Delete tag">✕</span>` : "";
  return `<button class="navbtn${active}" data-scope="${esc(scope)}"><span class="nav-left">${dotHtml}<span>${esc(label)}</span>${del}</span><span class="badge">${count}</span></button>`;
}

let _currentView: ViewState | null = null;

export function renderNav(catalog: Catalog, state: UserState, view: ViewState): void {
  _currentView = view;
  paintCollectionColors(catalog.collections);
  const counts = computeCounts(catalog, state);

  const navCore = document.getElementById("nav-core");
  if (navCore) navCore.innerHTML =
    navBtn("all", "All Saves", counts.all) +
    navBtn("fav", "★ Favorites", counts.fav) +
    navBtn("done", "Watched", counts.done) +
    navBtn("uncat", "Untagged", counts.uncat);

  const navTags = document.getElementById("nav-tags");
  if (navTags) {
    const tags = state.customTags;
    navTags.innerHTML = tags.length
      ? tags.map((t) => navBtn("tag:" + t, t, counts.byTag.get(t) ?? 0, getTagColor(state, t), t)).join("")
      : `<div style="font-size:12px;color:var(--muted);padding:4px 9px;font-style:italic">No tags yet — make one below.</div>`;
  }

  const navTrash = document.getElementById("nav-trash");
  if (navTrash) navTrash.innerHTML = navBtn("trash", "Trash", counts.trash);
}

const TITLES: Record<string, string> = {
  all: "All Saves", fav: "★ Favorites", done: "Watched", uncat: "Untagged — no tags yet", trash: "Trash",
};

export function renderGrid(catalog: Catalog, state: UserState, view: ViewState): void {
  _currentList = currentSet(catalog, state, view);
  _renderedCount = 0;

  const title = TITLES[view.scope]
    ?? (view.scope.startsWith("col:") ? view.scope.slice(4)
      : view.scope.startsWith("tag:") ? "#" + view.scope.slice(4)
      : "Saves");

  const titleEl = document.getElementById("crumb-title");
  if (titleEl) titleEl.textContent = title;
  const countEl = document.getElementById("crumb-count");
  if (countEl) countEl.textContent = `[${_currentList.length}${_currentList.length === 1 ? " item]" : " items]"}`;

  const crumbEl = document.querySelector(".crumb");
  let emptyBtn = document.getElementById("empty-trash-btn");
  if (view.scope === "trash" && _currentList.length) {
    if (!emptyBtn) {
      emptyBtn = document.createElement("button");
      emptyBtn.id = "empty-trash-btn";
      emptyBtn.className = "toolbtn ghost";
      emptyBtn.textContent = "Empty Trash";
      crumbEl?.appendChild(emptyBtn);
    }
  } else if (emptyBtn) {
    emptyBtn.remove();
  }

  const g = document.getElementById("grid");
  if (!g) return;

  if (!_currentList.length) {
    g.innerHTML = `<div class="empty-state"><div class="big">empty shelf</div><p>nothing matches this filter</p></div>`;
    return;
  }

  const slice = _currentList.slice(0, PAGE_SIZE);
  g.innerHTML = slice.map((p) => cardHtml(p, state)).join("");
  _renderedCount = slice.length;
}

export function extendGrid(state: UserState): void {
  if (_renderedCount >= _currentList.length) return;
  const g = document.getElementById("grid");
  if (!g) return;
  const next = _currentList.slice(_renderedCount, _renderedCount + PAGE_SIZE);
  g.insertAdjacentHTML("beforeend", next.map((p) => cardHtml(p, state)).join(""));
  _renderedCount += next.length;
}

export function updateCardInGrid(postId: string, state: UserState): void {
  const post = _currentList.find((p) => p.id === postId);
  if (!post) return;
  const el = document.querySelector(`.card[data-id="${CSS.escape(postId)}"]`) as HTMLElement | null;
  if (!el) return;
  el.outerHTML = cardHtml(post, state);
}

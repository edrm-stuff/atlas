import { describe, it, expect } from "vitest";
import { currentSet, computeCounts } from "../src/filter.js";
import type { Catalog, CatalogPost, UserState, ViewState } from "../src/types.js";

function post(overrides: Partial<CatalogPost>): CatalogPost {
  return {
    id: "P1", url: "https://www.instagram.com/reel/P1/", caption: "", title: "",
    owner_username: "", owner_name: "Unknown", owner_url: "", timestamp: null,
    type: "reel", collections: [], saved: true, tldr: "", captionTags: [],
    ...overrides,
  };
}

function state(overrides: Partial<UserState> = {}): UserState {
  return { fav: {}, done: {}, notes: {}, tags: {}, customTags: [], trash: {}, purged: {}, ...overrides };
}

function view(overrides: Partial<ViewState> = {}): ViewState {
  return { scope: "all", type: "all", q: "", sort: "new", ...overrides };
}

describe("currentSet trash scoping", () => {
  const catalog: Catalog = {
    posts: [post({ id: "A" }), post({ id: "B" }), post({ id: "C", collections: ["Col"] })],
    collections: [],
  };

  it("excludes trashed items from the 'all' scope", () => {
    const s = state({ trash: { A: true } });
    const list = currentSet(catalog, s, view({ scope: "all" }));
    expect(list.map((p) => p.id)).toEqual(expect.arrayContaining(["B", "C"]));
    expect(list.map((p) => p.id)).not.toContain("A");
  });

  it("excludes trashed items from a collection scope", () => {
    const s = state({ trash: { C: true } });
    const list = currentSet(catalog, s, view({ scope: "col:Col" }));
    expect(list).toHaveLength(0);
  });

  it("shows only trashed items in the trash scope", () => {
    const s = state({ trash: { A: true, C: true } });
    const list = currentSet(catalog, s, view({ scope: "trash" }));
    expect(list.map((p) => p.id).sort()).toEqual(["A", "C"]);
  });
});

describe("computeCounts trash exclusion", () => {
  it("excludes trashed posts from all/fav/done/uncat/collection counts and reports a trash count", () => {
    const catalog: Catalog = {
      posts: [
        post({ id: "A", collections: ["Col"] }),
        post({ id: "B", collections: ["Col"] }),
      ],
      collections: [],
    };
    const s = state({ fav: { A: true, B: true }, trash: { A: true } });
    const counts = computeCounts(catalog, s);
    expect(counts.all).toBe(1);
    expect(counts.fav).toBe(1);
    expect(counts.trash).toBe(1);
    expect(counts.byCollection.get("Col")).toBe(1);
  });
});

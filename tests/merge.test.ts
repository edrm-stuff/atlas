import { describe, it, expect } from "vitest";
import { mergeCatalog } from "../src/import/merge.js";
import type { Catalog, CatalogPost } from "../src/types.js";

function post(overrides: Partial<CatalogPost>): CatalogPost {
  return {
    id: "P1", url: "https://www.instagram.com/reel/P1/", caption: "", title: "",
    owner_username: "", owner_name: "Unknown", owner_url: "", timestamp: null,
    type: "reel", collections: [], saved: true, tldr: "", captionTags: [],
    ...overrides,
  };
}

describe("mergeCatalog", () => {
  it("appends new posts not present in the existing catalog", () => {
    const existing: Catalog = { posts: [], collections: [] };
    const incoming: Catalog = { posts: [post({ id: "NEW1" })], collections: [] };
    const { catalog, added, updated } = mergeCatalog(existing, incoming, {});
    expect(added).toBe(1);
    expect(updated).toBe(0);
    expect(catalog.posts.map((p) => p.id)).toEqual(["NEW1"]);
  });

  it("refreshes metadata on existing posts while preserving ai/tldr/suggestedTags", () => {
    const existing: Catalog = {
      posts: [post({ id: "P1", caption: "old caption", tldr: "kept tldr", suggestedTags: ["kept"], ai: { status: "done" } })],
      collections: [],
    };
    const incoming: Catalog = { posts: [post({ id: "P1", caption: "new caption", owner_name: "New Owner" })], collections: [] };
    const { catalog, added, updated } = mergeCatalog(existing, incoming, {});
    expect(added).toBe(0);
    expect(updated).toBe(1);
    const merged = catalog.posts[0];
    expect(merged.caption).toBe("new caption");
    expect(merged.owner_name).toBe("New Owner");
    expect(merged.tldr).toBe("kept tldr");
    expect(merged.suggestedTags).toEqual(["kept"]);
    expect(merged.ai).toEqual({ status: "done" });
  });

  it("keeps existing metadata when the incoming post has none", () => {
    const existing: Catalog = { posts: [post({ caption: "kept", owner_username: "ana", timestamp: 5 })], collections: [] };
    const incoming: Catalog = { posts: [post({ owner_name: "" })], collections: [] };
    const merged = mergeCatalog(existing, incoming, {}).catalog.posts[0];
    expect(merged).toMatchObject({ caption: "kept", owner_username: "ana", owner_name: "Unknown", timestamp: 5 });
  });

  it("unions collections instead of overwriting them", () => {
    const existing: Catalog = { posts: [post({ id: "P1", collections: ["A"] })], collections: [] };
    const incoming: Catalog = { posts: [post({ id: "P1", collections: ["B"] })], collections: [] };
    const { catalog } = mergeCatalog(existing, incoming, {});
    expect(catalog.posts[0].collections).toEqual(expect.arrayContaining(["A", "B"]));
  });

  it("skips posts whose id has been purged", () => {
    const existing: Catalog = { posts: [], collections: [] };
    const incoming: Catalog = { posts: [post({ id: "GONE" })], collections: [] };
    const { catalog, added } = mergeCatalog(existing, incoming, { GONE: true });
    expect(added).toBe(0);
    expect(catalog.posts).toHaveLength(0);
  });
});

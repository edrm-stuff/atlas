import { describe, it, expect, beforeEach, vi } from "vitest";
import { normalizeCatalog } from "../src/import/normalize.js";

// Migration logic test (without IndexedDB — just test the normalization of legacy data)
describe("Legacy localStorage data migration", () => {
  it("migrates stags field to captionTags", () => {
    const legacyData = {
      posts: [
        {
          id: "LEGACY1",
          url: "https://www.instagram.com/reel/LEGACY1/",
          caption: "A post",
          owner_username: "user1",
          type: "reel",
          stags: ["design", "inspiration"],
          collections: [],
        },
      ],
      collections: [],
    };

    const catalog = normalizeCatalog(legacyData);
    expect(catalog.posts[0].captionTags).toContain("design");
    expect(catalog.posts[0].captionTags).toContain("inspiration");
  });

  it("prefers captionTags over stags when both present", () => {
    const data = {
      posts: [
        {
          id: "BOTH1",
          url: "https://www.instagram.com/p/BOTH1/",
          caption: "",
          stags: ["old-tag"],
          captionTags: ["new-tag"],
          collections: [],
        },
      ],
      collections: [],
    };

    const catalog = normalizeCatalog(data);
    expect(catalog.posts[0].captionTags).toContain("new-tag");
    expect(catalog.posts[0].captionTags).not.toContain("old-tag");
  });

  it("builds captionTags from caption when neither stags nor captionTags present", () => {
    const data = {
      posts: [
        {
          id: "BUILD1",
          url: "https://www.instagram.com/reel/BUILD1/",
          caption: "Check out this AI tool! #aitools #productivity",
          type: "reel",
          collections: ["Tech"],
        },
      ],
      collections: [],
    };

    const catalog = normalizeCatalog(data);
    const tags = catalog.posts[0].captionTags;
    expect(tags).toContain("reel");
    expect(tags).toContain("tech");
  });

  it("preserves tldr from legacy data", () => {
    const data = {
      posts: [
        {
          id: "TLDR1",
          url: "https://www.instagram.com/p/TLDR1/",
          caption: "A long caption that would normally be truncated",
          tldr: "Custom preserved tldr",
          stags: [],
          collections: [],
        },
      ],
      collections: [],
    };

    const catalog = normalizeCatalog(data);
    expect(catalog.posts[0].tldr).toBe("Custom preserved tldr");
  });
});

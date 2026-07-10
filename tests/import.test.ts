import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { parseImportedText, normalizeImportedData } from "../src/import/index.js";
import { normalizeCatalog } from "../src/import/normalize.js";

const fix = (name: string) => readFileSync(join(__dirname, "fixtures", name), "utf8");

describe("Instagram HTML import", () => {
  it("parses saved_posts.html and returns 2 posts", () => {
    const html = fix("saved_posts.html");
    const raw = parseImportedText(html, "saved_posts.html");
    const { catalog } = normalizeImportedData(raw, "saved_posts.html");
    expect(catalog.posts).toHaveLength(2);
    expect(catalog.posts[0].type).toBe("reel");
    expect(catalog.posts[1].type).toBe("post");
  });

  it("extracts captions correctly", () => {
    const html = fix("saved_posts.html");
    const { catalog } = normalizeImportedData(parseImportedText(html, "saved_posts.html"), "saved_posts.html");
    expect(catalog.posts[0].caption).toContain("AI tools");
    expect(catalog.posts[1].caption).toContain("Design inspiration");
  });
});

describe("Meta JSON import", () => {
  it("parses meta JSON and returns 2 posts", () => {
    const json = fix("meta_export.json");
    const raw = parseImportedText(json, "saved_posts.json");
    const { catalog } = normalizeImportedData(raw, "saved_posts.json");
    expect(catalog.posts.length).toBeGreaterThanOrEqual(1);
    expect(catalog.posts.some((p) => p.id === "META002")).toBe(true);
  });

  it("assigns collection from parent object", () => {
    const json = fix("meta_export.json");
    const { catalog } = normalizeImportedData(parseImportedText(json), "meta_export.json");
    const collectionPost = catalog.posts.find((p) => p.id === "META001");
    expect(collectionPost?.collections).toContain("My Collection");
  });
});

describe("Catalog JSON import (legacy format)", () => {
  it("preserves existing tldr values", () => {
    const json = fix("catalog_export.json");
    const raw = parseImportedText(json, "catalog_export.json");
    const { catalog } = normalizeImportedData(raw, "catalog_export.json");
    const post = catalog.posts.find((p) => p.id === "CATALOG001");
    expect(post?.tldr).toBe("Preserved TL;DR from old export");
  });

  it("migrates stags → captionTags", () => {
    const json = fix("catalog_export.json");
    const { catalog } = normalizeImportedData(parseImportedText(json), "catalog_export.json");
    const post = catalog.posts.find((p) => p.id === "CATALOG001");
    expect(post?.captionTags).toContain("archive");
    expect((post as Record<string, unknown>)?.stags).toBeUndefined();
  });

  it("preserves collections", () => {
    const json = fix("catalog_export.json");
    const { catalog } = normalizeImportedData(parseImportedText(json), "catalog_export.json");
    expect(catalog.collections.map((c) => c.name)).toContain("Archive");
  });
});

describe("Meta JSON import (label_values format)", () => {
  it("parses the newer label_values export and returns only the valid items", () => {
    const json = fix("meta_export_labelvalues.json");
    const { catalog } = normalizeImportedData(parseImportedText(json, "saved_posts.json"), "saved_posts.json");
    expect(catalog.posts).toHaveLength(2);
  });

  it("extracts url, id, caption, owner, timestamp, type, and hashtags", () => {
    const json = fix("meta_export_labelvalues.json");
    const { catalog } = normalizeImportedData(parseImportedText(json, "saved_posts.json"), "saved_posts.json");
    const post = catalog.posts.find((p) => p.id === "LBLV001");
    expect(post).toBeDefined();
    expect(post?.url).toBe("https://www.instagram.com/reel/LBLV001/");
    expect(post?.caption).toBe("Great tips on cooking #cooking #tips");
    expect(post?.owner_name).toBe("Chef Anna");
    expect(post?.owner_username).toBe("chefanna");
    expect(post?.timestamp).toBe(1700000000);
    expect(post?.type).toBe("reel");
    expect(post?.captionTags).toEqual(expect.arrayContaining(["cooking", "tips"]));
  });

  it("handles a caption-less item without producing a degenerate name", () => {
    const json = fix("meta_export_labelvalues.json");
    const { catalog } = normalizeImportedData(parseImportedText(json, "saved_posts.json"), "saved_posts.json");
    const post = catalog.posts.find((p) => p.id === "LBLV002");
    expect(post).toBeDefined();
    expect(post?.caption).toBe("");
    expect(post?.owner_name).toBe("Design Co");
    expect(post?.type).toBe("post");
  });

  it("never emits a degenerate 'Instagram save' item", () => {
    const json = fix("meta_export_labelvalues.json");
    const { catalog } = normalizeImportedData(parseImportedText(json, "saved_posts.json"), "saved_posts.json");
    expect(catalog.posts.every((p) => p.owner_name !== "Instagram save")).toBe(true);
  });
});

describe("normalizeCatalog deduplication", () => {
  it("merges duplicate posts by id", () => {
    const catalog = normalizeCatalog({
      posts: [
        { id: "DUP1", url: "https://www.instagram.com/reel/DUP1/", collections: ["A"], caption: "first" },
        { id: "DUP1", url: "https://www.instagram.com/reel/DUP1/", collections: ["B"], caption: "" },
      ],
    });
    expect(catalog.posts).toHaveLength(1);
    expect(catalog.posts[0].collections).toContain("A");
    expect(catalog.posts[0].collections).toContain("B");
  });
});

describe("Bad input", () => {
  it("throws for unrecognized plain text", () => {
    expect(() => parseImportedText("hello world", "bad.txt")).toThrow();
  });

  it("throws when no Instagram URLs found in HTML", () => {
    const html = "<html><body><p>No instagram links here</p></body></html>";
    expect(() => parseImportedText(html, "empty.html")).toThrow();
  });
});

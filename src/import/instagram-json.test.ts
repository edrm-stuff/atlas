import { describe, it, expect } from "vitest";
import { collectInstagramItems, fixMojibake, newImportDiagnostics } from "./instagram-json.js";
import { normalizeImportedData } from "./index.js";
import type { CatalogPost } from "../types.js";

// Labels as they appear after JSON.parse of a Portuguese export
// ("TÃ­tulo" → "TÃ­tulo" mojibake for "Título").
const ptEntry = {
  timestamp: 1776170805,
  media: [],
  label_values: [
    { label: "URL", value: "https://www.instagram.com/reel/DWUncqvGfbf/", href: "https://www.instagram.com/reel/DWUncqvGfbf/" },
    { label: "Legenda", value: "Aplique texturas nas suas impressÃµes 3D.\n\n#3dprinting" },
    { label: "TÃ­tulo", value: "" },
    {
      dict: [{ dict: [{ label: "Nome", value: "bambulab" }], title: "" }],
      title: "Hashtags",
    },
    {
      dict: [
        {
          dict: [
            { label: "URL", value: "http://unipedia3d.com.br" },
            { label: "Nome", value: "Uni | ImpressÃµes 3D" },
            { label: "Nome de usuÃ¡rio", value: "unipedia3d" },
          ],
          title: "",
        },
      ],
      title: "Dono",
    },
  ],
  fbid: "18070473866279525",
};

describe("fixMojibake", () => {
  it("decodes UTF-8 bytes read as Latin-1", () => {
    expect(fixMojibake("impressÃµes")).toBe("impressões");
    expect(fixMojibake("TÃ­tulo")).toBe("Título");
  });

  it("leaves plain text untouched", () => {
    expect(fixMojibake("hello world")).toBe("hello world");
    expect(fixMojibake("emoji 🎬 stays")).toBe("emoji 🎬 stays");
  });
});

describe("collectInstagramItems (Portuguese export)", () => {
  it("extracts caption, owner, and hashtags from localized labels", () => {
    const out: CatalogPost[] = [];
    collectInstagramItems([ptEntry], "", out);
    expect(out).toHaveLength(1);
    const p = out[0];
    expect(p.url).toBe("https://www.instagram.com/reel/DWUncqvGfbf/");
    expect(p.caption).toContain("impressões 3D");
    expect(p.owner_name).toBe("Uni | Impressões 3D");
    expect(p.owner_username).toBe("unipedia3d");
    expect(p.captionTags).toContain("bambulab");
    expect(p.timestamp).toBe(1776170805);
  });
});

describe("unsupported language diagnostics", () => {
  const koreanEntry = {
    timestamp: 123,
    label_values: [
      { label: "URL", value: "https://www.instagram.com/p/XYZ789/", href: "https://www.instagram.com/p/XYZ789/" },
      { label: "캡션", value: "안녕하세요" },
      { label: "제목", value: "" },
      { dict: [{ dict: [{ label: "이름", value: "누군가" }], title: "" }], title: "소유자" },
    ],
  };

  it("counts posts whose labels were not recognized", () => {
    const out: CatalogPost[] = [];
    const diag = newImportDiagnostics();
    collectInstagramItems([koreanEntry], "", out, diag);
    expect(out).toHaveLength(1);
    expect(out[0].url).toBe("https://www.instagram.com/p/XYZ789/");
    expect(diag.postsMissingMetadata).toBe(1);
    expect(diag.unknownLabels).toContain("캡션");
  });

  it("surfaces a warning from normalizeImportedData", () => {
    const { catalog, warning } = normalizeImportedData([koreanEntry]);
    expect(catalog.posts).toHaveLength(1);
    expect(warning).toContain("language we don't fully support yet");
  });

  it("does not warn for supported languages", () => {
    const { warning } = normalizeImportedData([ptEntry]);
    expect(warning).toBeUndefined();
  });
});

describe("collectInstagramItems (English export)", () => {
  it("still parses English labels", () => {
    const out: CatalogPost[] = [];
    collectInstagramItems([{
      timestamp: 123,
      label_values: [
        { label: "URL", value: "https://www.instagram.com/p/ABC123/", href: "https://www.instagram.com/p/ABC123/" },
        { label: "Caption", value: "hello" },
        { label: "Title", value: "" },
        { dict: [{ dict: [{ label: "Name", value: "Some One" }, { label: "Username", value: "someone" }], title: "" }], title: "Owner" },
      ],
    }], "", out);
    expect(out).toHaveLength(1);
    expect(out[0].caption).toBe("hello");
    expect(out[0].owner_name).toBe("Some One");
    expect(out[0].owner_username).toBe("someone");
  });
});

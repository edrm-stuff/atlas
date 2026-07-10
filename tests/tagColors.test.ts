import { describe, it, expect } from "vitest";
import { assignTagColor, backfillTagColors, contrastRatio, tintedChipStyle, TAG_PALETTE } from "../src/tagColors.js";
import type { UserState } from "../src/types.js";

function emptyState(): UserState {
  return { fav: {}, done: {}, notes: {}, tags: {}, customTags: [], tagColors: {}, trash: {}, purged: {} };
}

describe("assignTagColor", () => {
  it("assigns distinct colors as more tags are created", () => {
    const used: string[] = [];
    for (let i = 0; i < TAG_PALETTE.length + 3; i++) {
      const color = assignTagColor(used);
      expect(used).not.toContain(color);
      used.push(color);
    }
    expect(new Set(used).size).toBe(used.length);
  });
});

describe("backfillTagColors", () => {
  it("assigns a color to every custom tag missing one", () => {
    const state = emptyState();
    state.customTags = ["design", "travel", "recipes", "work"];
    const changed = backfillTagColors(state);
    expect(changed).toBe(true);
    for (const tag of state.customTags) {
      expect(state.tagColors[tag]).toBeTruthy();
    }
  });

  it("assigns distinct colors to distinct tags", () => {
    const state = emptyState();
    state.customTags = ["a", "b", "c", "d", "e"];
    backfillTagColors(state);
    const colors = state.customTags.map((t) => state.tagColors[t]);
    expect(new Set(colors).size).toBe(colors.length);
  });

  it("leaves already-colored tags untouched and is idempotent", () => {
    const state = emptyState();
    state.customTags = ["design"];
    backfillTagColors(state);
    const first = state.tagColors.design;
    const changed = backfillTagColors(state);
    expect(changed).toBe(false);
    expect(state.tagColors.design).toBe(first);
  });
});

describe("tintedChipStyle contrast", () => {
  it("meets WCAG AA (4.5:1) text-on-background contrast for every palette color", () => {
    for (const { hex } of TAG_PALETTE) {
      const { background, color } = tintedChipStyle(hex);
      expect(background).toBeTruthy();
      // approximate the actual composited background (rgba over the card color) for the ratio check
      const rgbaMatch = background.match(/rgba\((\d+),(\d+),(\d+),([\d.]+)\)/);
      expect(rgbaMatch).toBeTruthy();
      const [, r, g, b, a] = rgbaMatch!;
      const alpha = parseFloat(a);
      const cardBg: [number, number, number] = [0xf8, 0xf4, 0xea];
      const blended = [Number(r), Number(g), Number(b)].map((c, idx) => c * alpha + cardBg[idx] * (1 - alpha));
      const toHex = (n: number) => Math.round(n).toString(16).padStart(2, "0");
      const bgHex = `#${toHex(blended[0])}${toHex(blended[1])}${toHex(blended[2])}`;
      expect(contrastRatio(color, bgHex)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

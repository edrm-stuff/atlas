import type { UserState } from "./types.js";

export interface TagColorDef {
  name: string;
  hex: string;
}

export const TAG_PALETTE: TagColorDef[] = [
  { name: "Gray", hex: "#787774" },
  { name: "Brown", hex: "#9F6B53" },
  { name: "Orange", hex: "#D9730D" },
  { name: "Yellow", hex: "#CB912F" },
  { name: "Green", hex: "#448361" },
  { name: "Blue", hex: "#337EA9" },
  { name: "Purple", hex: "#9065B0" },
  { name: "Pink", hex: "#C14C8A" },
  { name: "Red", hex: "#D44C47" },
];

export const DEFAULT_COLOR = TAG_PALETTE[0].hex;

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

function rgbToHsl([r, g, b]: [number, number, number]): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r: h = ((g - b) / d) % 6; break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4; break;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, s * 100, l * 100];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/** Picks a new tag color: an unused palette swatch, or (once exhausted) a
 *  generated hue placed as far as possible from every hue already in use. */
export function assignTagColor(usedColors: string[]): string {
  const used = new Set(usedColors.map((c) => c.toLowerCase()));
  const free = TAG_PALETTE.filter((c) => !used.has(c.hex.toLowerCase()));
  if (free.length) return free[Math.floor(Math.random() * free.length)].hex;

  const usedHues = usedColors.map((c) => rgbToHsl(hexToRgb(c))[0]);
  let bestHue = 0;
  let bestDist = -1;
  for (let h = 0; h < 360; h += 5) {
    const dist = usedHues.length ? Math.min(...usedHues.map((u) => hueDistance(h, u))) : 360;
    if (dist > bestDist) { bestDist = dist; bestHue = h; }
  }
  return rgbToHex(hslToRgb(bestHue, 45, 45));
}

/** Ensures every custom tag has an assigned color, mutating state.tagColors in place. */
export function backfillTagColors(state: UserState): boolean {
  state.tagColors ??= {};
  let changed = false;
  for (const tag of state.customTags) {
    if (!state.tagColors[tag]) {
      state.tagColors[tag] = assignTagColor(Object.values(state.tagColors));
      changed = true;
    }
  }
  return changed;
}

export function getTagColor(state: UserState, tag: string): string {
  return state.tagColors?.[tag] ?? DEFAULT_COLOR;
}

/** Registers a new custom tag (if not already present) and assigns it a color.
 *  Returns the normalized tag name, or "" if the input was blank. */
export function createTag(state: UserState, name: string): string {
  const v = name.trim().replace(/^#/, "");
  if (!v) return v;
  if (!state.customTags.includes(v)) state.customTags.push(v);
  if (!state.tagColors[v]) state.tagColors[v] = assignTagColor(Object.values(state.tagColors));
  return v;
}

function srgbToLinear(c: number): number {
  const cs = c / 255;
  return cs <= 0.04045 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
}

function relativeLuminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map(srgbToLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(hexA: string, hexB: string): number {
  const lA = relativeLuminance(hexToRgb(hexA));
  const lB = relativeLuminance(hexToRgb(hexB));
  const lighter = Math.max(lA, lB);
  const darker = Math.min(lA, lB);
  return (lighter + 0.05) / (darker + 0.05);
}

function alphaBlend(fgHex: string, alpha: number, bgHex: string): string {
  const fg = hexToRgb(fgHex);
  const bg = hexToRgb(bgHex);
  const blended: [number, number, number] = [
    fg[0] * alpha + bg[0] * (1 - alpha),
    fg[1] * alpha + bg[1] * (1 - alpha),
    fg[2] * alpha + bg[2] * (1 - alpha),
  ];
  return rgbToHex(blended);
}

const CARD_BG = "#f8f4ea";
const CHIP_ALPHA = 0.14;
const MIN_CONTRAST = 4.5;

/** Tinted-background chip style for a tag color: pale wash of the hue behind
 *  darkened text of the same hue, darkened until it clears WCAG AA against
 *  the wash (as actually composited over the card background). */
export function tintedChipStyle(hex: string): { background: string; color: string } {
  const background = `rgba(${hexToRgb(hex).join(",")},${CHIP_ALPHA})`;
  const effectiveBg = alphaBlend(hex, CHIP_ALPHA, CARD_BG);

  let [h, s, l] = rgbToHsl(hexToRgb(hex));
  let color = rgbToHex(hslToRgb(h, s, l));
  for (let i = 0; i < 20 && contrastRatio(color, effectiveBg) < MIN_CONTRAST && l > 5; i++) {
    l = Math.max(5, l - 5);
    color = rgbToHex(hslToRgb(h, Math.min(100, s + 2), l));
  }
  return { background, color };
}

/** Best readable text color (white or ink) for a solid-fill chip/pill. */
export function readableTextOn(bgHex: string): string {
  const white = "#ffffff";
  const ink = "#1c1814";
  return contrastRatio(white, bgHex) >= contrastRatio(ink, bgHex) ? white : ink;
}

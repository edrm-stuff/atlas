import { TAG_PALETTE } from "../tagColors.js";
import { esc } from "../utils.js";

let popEl: HTMLElement | null = null;
let onDocDown: ((e: MouseEvent) => void) | null = null;
let onKeydown: ((e: KeyboardEvent) => void) | null = null;

export function closeColorPopover(): void {
  if (!popEl) return;
  popEl.remove();
  popEl = null;
  if (onDocDown) { document.removeEventListener("mousedown", onDocDown, true); onDocDown = null; }
  if (onKeydown) { document.removeEventListener("keydown", onKeydown); onKeydown = null; }
}

export function openColorPopover(
  anchor: HTMLElement,
  currentColor: string,
  defaultColor: string,
  onPick: (hex: string) => void
): void {
  closeColorPopover();

  const items = [...TAG_PALETTE, { name: "Default", hex: defaultColor }];
  const html = items
    .map((c) => {
      const sel = c.hex.toLowerCase() === currentColor.toLowerCase();
      return `<button type="button" class="color-pop-item${sel ? " sel" : ""}" data-pick="${esc(c.hex)}">
        <span class="color-pop-swatch" style="background:${esc(c.hex)}"></span>
        <span class="color-pop-name">${esc(c.name)}</span>
        ${sel ? '<span class="color-pop-check">✓</span>' : ""}
      </button>`;
    })
    .join("");

  const el = document.createElement("div");
  el.className = "color-pop";
  el.innerHTML = html;
  document.body.appendChild(el);
  popEl = el;

  const rect = anchor.getBoundingClientRect();
  const popRect = el.getBoundingClientRect();
  let left = rect.left;
  let top = rect.bottom + 6;
  if (left + popRect.width > window.innerWidth - 8) left = window.innerWidth - popRect.width - 8;
  if (top + popRect.height > window.innerHeight - 8) top = rect.top - popRect.height - 6;
  el.style.left = `${Math.max(8, left)}px`;
  el.style.top = `${Math.max(8, top)}px`;

  el.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest("[data-pick]") as HTMLElement | null;
    if (!btn) return;
    onPick(btn.dataset.pick!);
    closeColorPopover();
  });

  onDocDown = (e: MouseEvent) => {
    if (!popEl) return;
    const target = e.target as Node;
    if (popEl.contains(target) || anchor.contains(target)) return;
    closeColorPopover();
  };
  onKeydown = (e: KeyboardEvent) => { if (e.key === "Escape") closeColorPopover(); };
  document.addEventListener("mousedown", onDocDown, true);
  document.addEventListener("keydown", onKeydown);
}

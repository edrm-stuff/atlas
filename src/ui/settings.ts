import { esc } from "../utils.js";
import { ANTHROPIC_MODELS, OPENAI_MODELS, type AiProviderName } from "../ai/provider.js";

const LS_PROVIDER = "atlas_ai_provider";
const LS_MODEL = "atlas_ai_model";
const LS_ANTHROPIC_KEY = "atlas_anthropic_key";
const LS_OPENAI_KEY = "atlas_openai_key";

export interface AiSettings {
  provider: AiProviderName;
  model: string;
  apiKey: string;
}

export function loadAiSettings(): AiSettings | null {
  try {
    const provider = (localStorage.getItem(LS_PROVIDER) ?? "anthropic") as AiProviderName;
    const model = localStorage.getItem(LS_MODEL) ?? getDefaultModel(provider);
    const keyStore = provider === "anthropic" ? LS_ANTHROPIC_KEY : LS_OPENAI_KEY;
    const apiKey = localStorage.getItem(keyStore) ?? "";
    if (!apiKey) return null;
    return { provider, model, apiKey };
  } catch {
    return null;
  }
}

export function saveAiSettings(provider: AiProviderName, model: string, apiKey: string): void {
  localStorage.setItem(LS_PROVIDER, provider);
  localStorage.setItem(LS_MODEL, model);
  const keyStore = provider === "anthropic" ? LS_ANTHROPIC_KEY : LS_OPENAI_KEY;
  if (apiKey) localStorage.setItem(keyStore, apiKey);
}

export function removeAiKey(provider: AiProviderName): void {
  const keyStore = provider === "anthropic" ? LS_ANTHROPIC_KEY : LS_OPENAI_KEY;
  localStorage.removeItem(keyStore);
}

function getDefaultModel(provider: AiProviderName): string {
  return provider === "anthropic" ? "claude-haiku-4-5" : "gpt-4o-mini";
}

export function openSettings(): void {
  const savedProvider = (localStorage.getItem(LS_PROVIDER) ?? "anthropic") as AiProviderName;
  const savedModel = localStorage.getItem(LS_MODEL) ?? getDefaultModel(savedProvider);
  const anthropicKey = localStorage.getItem(LS_ANTHROPIC_KEY) ?? "";
  const openaiKey = localStorage.getItem(LS_OPENAI_KEY) ?? "";

  const anthropicModels = ANTHROPIC_MODELS.map(
    (m) => `<option value="${esc(m.id)}" ${savedProvider === "anthropic" && savedModel === m.id ? "selected" : ""}>${esc(m.label)}</option>`
  ).join("");
  const openaiModels = OPENAI_MODELS.map(
    (m) => `<option value="${esc(m.id)}" ${savedProvider === "openai" && savedModel === m.id ? "selected" : ""}>${esc(m.label)}</option>`
  ).join("");

  document.getElementById("settings-modal")!.innerHTML = `
    <div class="modal-head">
      <div class="mh-l"><div class="nm">Settings</div></div>
      <button class="xbtn" data-close-settings>×</button>
    </div>
    <div class="modal-body">
      <div class="mlabel">AI Provider</div>
      <div class="seg" id="provider-seg" style="width:fit-content">
        <button data-provider="anthropic" class="${savedProvider === "anthropic" ? "active" : ""}">Anthropic</button>
        <button data-provider="openai" class="${savedProvider === "openai" ? "active" : ""}">OpenAI</button>
      </div>

      <div id="anthropic-section" style="${savedProvider !== "anthropic" ? "display:none" : ""}">
        <div class="mlabel">Anthropic API Key</div>
        <input type="password" id="anthropic-key" class="notes" style="min-height:auto;padding:10px 12px;font-family:inherit;font-size:13px"
          placeholder="sk-ant-..." value="${esc(anthropicKey)}" autocomplete="off">
        <div class="mlabel">Model</div>
        <select class="sort" id="anthropic-model" style="width:100%">${anthropicModels}</select>
        ${anthropicKey ? `<button class="toolbtn ghost" id="remove-anthropic-key" style="margin-top:12px;font-size:10px">Remove Anthropic key</button>` : ""}
      </div>

      <div id="openai-section" style="${savedProvider !== "openai" ? "display:none" : ""}">
        <div class="mlabel">OpenAI API Key</div>
        <input type="password" id="openai-key" class="notes" style="min-height:auto;padding:10px 12px;font-family:inherit;font-size:13px"
          placeholder="sk-..." value="${esc(openaiKey)}" autocomplete="off">
        <div class="mlabel">Model</div>
        <select class="sort" id="openai-model" style="width:100%">${openaiModels}</select>
        ${openaiKey ? `<button class="toolbtn ghost" id="remove-openai-key" style="margin-top:12px;font-size:10px">Remove OpenAI key</button>` : ""}
      </div>

      <p style="font-size:12px;color:var(--muted);margin-top:18px;line-height:1.6">
        Your API key is stored only in this browser's localStorage and is sent directly to the provider.
        It never touches any server. <strong>You are billed directly by the provider.</strong>
      </p>

      <div style="display:flex;gap:10px;margin-top:22px">
        <button class="toolbtn" id="save-settings-btn">Save settings</button>
      </div>
    </div>`;

  document.getElementById("settings-overlay")!.classList.add("show");

  // Wire provider toggle inside settings modal
  document.getElementById("provider-seg")?.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest("[data-provider]") as HTMLElement | null;
    if (!btn) return;
    const p = btn.dataset.provider as AiProviderName;
    document.querySelectorAll("#provider-seg button").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("anthropic-section")!.style.display = p === "anthropic" ? "" : "none";
    document.getElementById("openai-section")!.style.display = p === "openai" ? "" : "none";
  });

  document.getElementById("save-settings-btn")?.addEventListener("click", () => {
    const activeProviderBtn = document.querySelector("#provider-seg button.active") as HTMLElement | null;
    const provider = (activeProviderBtn?.dataset.provider ?? "anthropic") as AiProviderName;
    const keyInput = provider === "anthropic"
      ? (document.getElementById("anthropic-key") as HTMLInputElement)
      : (document.getElementById("openai-key") as HTMLInputElement);
    const modelSelect = provider === "anthropic"
      ? (document.getElementById("anthropic-model") as HTMLSelectElement)
      : (document.getElementById("openai-model") as HTMLSelectElement);
    saveAiSettings(provider, modelSelect.value, keyInput.value.trim());
    closeSettings();
  });

  document.getElementById("remove-anthropic-key")?.addEventListener("click", () => {
    removeAiKey("anthropic");
    closeSettings();
  });
  document.getElementById("remove-openai-key")?.addEventListener("click", () => {
    removeAiKey("openai");
    closeSettings();
  });
}

export function closeSettings(): void {
  document.getElementById("settings-overlay")?.classList.remove("show");
}

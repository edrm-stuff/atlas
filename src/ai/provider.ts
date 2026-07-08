import type { CatalogPost } from "../types.js";
import type { AiOutput } from "./schema.js";

export interface AiProvider {
  generate(post: CatalogPost): Promise<AiOutput>;
}

export type AiProviderName = "anthropic" | "openai";

export const ANTHROPIC_MODELS = [
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5 (fast, cheap)" },
  { id: "claude-sonnet-5", label: "Claude Sonnet 5 (better quality)" },
  { id: "claude-opus-4-8", label: "Claude Opus 4.8 (best quality)" },
];

export const OPENAI_MODELS = [
  { id: "gpt-4o-mini", label: "GPT-4o mini (fast, cheap)" },
  { id: "gpt-4o", label: "GPT-4o (better quality)" },
  { id: "gpt-4.1-mini", label: "GPT-4.1 mini" },
];

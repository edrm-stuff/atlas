import { z } from "zod";

export const AiOutputSchema = z.object({
  tldr: z.string().max(200),
  suggestedTags: z.array(z.string().max(30)).max(6),
});

export type AiOutput = z.infer<typeof AiOutputSchema>;

export const AI_SYSTEM_PROMPT = `You are a concise cataloger for saved social media posts.
Given a post's caption, collections, and type, return:
- tldr: one sentence (≤ 120 chars) summarizing the core idea
- suggestedTags: 2–5 lowercase kebab-case topic tags (e.g. "ai-tools", "design", "fitness")

Respond only with valid JSON matching the schema. No prose.`;

export function buildPrompt(caption: string, collections: string[], type: string): string {
  return [
    `Type: ${type}`,
    collections.length ? `Collections: ${collections.join(", ")}` : null,
    caption ? `Caption:\n${caption.slice(0, 800)}` : "No caption.",
  ].filter(Boolean).join("\n");
}

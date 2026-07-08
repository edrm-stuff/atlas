import Anthropic from "@anthropic-ai/sdk";
import type { AiProvider } from "./provider.js";
import type { AiOutput } from "./schema.js";
import { AiOutputSchema, AI_SYSTEM_PROMPT, buildPrompt } from "./schema.js";
import type { CatalogPost } from "../types.js";

export class AnthropicProvider implements AiProvider {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model = "claude-haiku-4-5") {
    this.client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
    this.model = model;
  }

  async generate(post: CatalogPost): Promise<AiOutput> {
    const content = buildPrompt(post.caption, post.collections, post.type);
    const msg = await this.client.messages.create({
      model: this.model,
      max_tokens: 256,
      system: AI_SYSTEM_PROMPT,
      messages: [{ role: "user", content }],
    });

    const text = msg.content.find((b) => b.type === "text")?.text ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in Anthropic response");
    const parsed = JSON.parse(jsonMatch[0]);
    return AiOutputSchema.parse(parsed);
  }
}

import OpenAI from "openai";
import type { AiProvider } from "./provider.js";
import type { AiOutput } from "./schema.js";
import { AiOutputSchema, AI_SYSTEM_PROMPT, buildPrompt } from "./schema.js";
import type { CatalogPost } from "../types.js";

export class OpenAiProvider implements AiProvider {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model = "gpt-4o-mini") {
    this.client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
    this.model = model;
  }

  async generate(post: CatalogPost): Promise<AiOutput> {
    const content = buildPrompt(post.caption, post.collections, post.type);
    const res = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: 256,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "ai_output",
          strict: true,
          schema: {
            type: "object",
            properties: {
              tldr: { type: "string" },
              suggestedTags: { type: "array", items: { type: "string" } },
            },
            required: ["tldr", "suggestedTags"],
            additionalProperties: false,
          },
        },
      },
      messages: [
        { role: "system", content: AI_SYSTEM_PROMPT },
        { role: "user", content },
      ],
    });

    const text = res.choices[0]?.message?.content ?? "";
    const parsed = JSON.parse(text);
    return AiOutputSchema.parse(parsed);
  }
}

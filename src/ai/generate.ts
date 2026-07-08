import type { CatalogPost } from "../types.js";
import type { AiProvider } from "./provider.js";
import { putPost } from "../storage/db.js";

export type GenerateMode = "single" | "visible" | "all-missing";

export interface GenerateProgress {
  current: number;
  total: number;
  done: boolean;
  cancelled: boolean;
  error?: string;
}

export type ProgressCallback = (p: GenerateProgress) => void;

let _cancelled = false;

export function cancelGeneration(): void {
  _cancelled = true;
}

export async function generateBatch(
  posts: CatalogPost[],
  provider: AiProvider,
  modelId: string,
  onProgress: ProgressCallback,
  onPostUpdated: (post: CatalogPost) => void,
): Promise<void> {
  _cancelled = false;
  const total = posts.length;
  let current = 0;

  onProgress({ current, total, done: false, cancelled: false });

  for (const post of posts) {
    if (_cancelled) {
      onProgress({ current, total, done: false, cancelled: true });
      return;
    }
    try {
      const output = await provider.generate(post);
      const updated: CatalogPost = {
        ...post,
        tldr: output.tldr,
        suggestedTags: output.suggestedTags,
        ai: { status: "done", model: modelId, generatedAt: Math.floor(Date.now() / 1000) },
      };
      await putPost(updated);
      onPostUpdated(updated);
    } catch (err) {
      const updated: CatalogPost = {
        ...post,
        ai: { status: "error", model: modelId, error: String(err) },
      };
      await putPost(updated);
      onPostUpdated(updated);
    }
    current++;
    onProgress({ current, total, done: current === total, cancelled: false });
  }
}

export type PostType = "reel" | "post";

export interface AiStatus {
  status: "pending" | "done" | "error";
  model?: string;
  generatedAt?: number;
  error?: string;
}

export interface CatalogPost {
  id: string;
  url: string;
  caption: string;
  title: string;
  owner_username: string;
  owner_name: string;
  owner_url: string;
  timestamp: number | null;
  type: PostType;
  collections: string[];
  saved: boolean;
  tldr: string;
  captionTags: string[];
  suggestedTags?: string[];
  ai?: AiStatus;
}

export interface Collection {
  name: string;
  count: number;
  updated: number | null;
}

export interface Catalog {
  posts: CatalogPost[];
  collections: Collection[];
}

export interface UserState {
  fav: Record<string, boolean>;
  done: Record<string, boolean>;
  notes: Record<string, string>;
  tags: Record<string, string[]>;
  customTags: string[];
  trash: Record<string, boolean>;
  purged: Record<string, boolean>;
}

export interface ViewState {
  scope: string;
  type: string;
  q: string;
  sort: "new" | "old" | "owner";
}

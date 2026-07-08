import "@fontsource/fraunces/400.css";
import "@fontsource/fraunces/500-italic.css";
import "@fontsource/fraunces/900.css";
import "@fontsource/hanken-grotesk/400.css";
import "@fontsource/hanken-grotesk/500.css";
import "@fontsource/hanken-grotesk/600.css";
import "@fontsource/hanken-grotesk/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/700.css";
import "./styles.css";

import type { Catalog, UserState } from "./types.js";
import { openDb, getAllPosts, getAllCollections, loadUserState } from "./storage/db.js";
import { migrateFromLocalStorage } from "./storage/migrate.js";
import { paintCollectionColors } from "./ui/card.js";
import { renderStats, renderNav, renderGrid } from "./ui/render.js";
import { init, wireEvents } from "./ui/events.js";

async function boot(): Promise<void> {
  await openDb();

  let posts = await getAllPosts();
  let collections = await getAllCollections();

  // Migrate from localStorage if IndexedDB is empty
  if (!posts.length) {
    const migrated = await migrateFromLocalStorage();
    if (migrated) {
      posts = await getAllPosts();
      collections = await getAllCollections();
    }
  }

  const catalog: Catalog = { posts, collections };
  const state: UserState = (await loadUserState()) ?? {
    fav: {}, done: {}, notes: {}, tags: {}, customTags: [],
  };

  paintCollectionColors(catalog.collections);
  init(catalog, state);
  wireEvents();
  renderStats(catalog, state);
  renderNav(catalog, state, { scope: "all", type: "all", q: "", sort: "new" });
  renderGrid(catalog, state, { scope: "all", type: "all", q: "", sort: "new" });
}

boot().catch(console.error);

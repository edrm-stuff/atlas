import type { Catalog, UserState } from "../types.js";
import { normalizeCatalog } from "../import/normalize.js";
import { putPosts, putCollections, saveUserState } from "./db.js";

const LS_CATALOG = "saved_catalog_data_v1";
const LS_STATE = "saved_catalog_state_v1";

export async function migrateFromLocalStorage(): Promise<boolean> {
  try {
    const catalogRaw = localStorage.getItem(LS_CATALOG);
    if (!catalogRaw) return false;

    const parsed = JSON.parse(catalogRaw) as unknown;
    const catalog: Catalog = normalizeCatalog(parsed);
    await putPosts(catalog.posts);
    await putCollections(catalog.collections);

    const stateRaw = localStorage.getItem(LS_STATE);
    if (stateRaw) {
      const state = JSON.parse(stateRaw) as UserState;
      await saveUserState(state);
    }

    localStorage.removeItem(LS_CATALOG);
    localStorage.removeItem(LS_STATE);

    return true;
  } catch {
    return false;
  }
}

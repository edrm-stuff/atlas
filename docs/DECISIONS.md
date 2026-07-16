# Decisions

## Instagram import parser: dual format support
Meta's saved-posts export comes in two shapes. The older one nests fields inside
`string_map_data` (`{ "Caption": { "value": "..." } }`); the newer one uses a flat
`label_values` array (`{ label: "URL", href }`, plus `title: "Owner"` / `title: "Hashtags"`
blocks with nested `dict` arrays). `instagram-json.ts` only understood the old shape —
its recursive walker descended into `label_values`, matched the inner `{ label: "URL" }`
objects as generic Instagram links, and emitted degenerate items ("Instagram save", no
caption, no creator). The fix adds a dedicated `label_values` extractor and stops the
walker from recursing into that array once it's been consumed. Both formats are
supported going forward; existing tests for the old format are unchanged.

## AI layer detached, not deleted
The AI summary/tagging feature (`src/ai/*`, `src/ui/settings.ts`) is disconnected from
the UI — no AI button, no Settings button, no TL;DR or suggested-tag rendering — but the
code stays in the repo unreferenced. The data fields (`tldr`, `suggestedTags`, `ai`) stay
on `CatalogPost` so existing generated data isn't lost if the feature is reconnected
later.

## Trash: restorable, tombstoned purge
Discarding a post sets `state.trash[id] = true` and hides it from every other view,
search, and stat — it isn't deleted. The Trash view lists trashed items with a Restore
action. "Empty Trash" is the only destructive step: it deletes the posts from storage
and records their ids in `state.purged`, a tombstone set. Re-importing the same export
never resurrects a purged id, even though the id (an Instagram shortcode) would
otherwise match.

## col: scope and byCollection kept in filter.ts
The Collections nav was removed from the sidebar (commit 1482e74), but the
`col:` scope filter and `byCollection` count map in `filter.ts`/`render.ts`
are retained deliberately. Posts still carry `collections[]` data, the
`rebuildCollections` helper keeps the count accurate, and the filter logic has
existing tests. No UI path sets `col:` today, but the infrastructure is kept
so Collections can be re-added without re-deriving it.

## Import is a merge, not a replace
Importing no longer wipes the catalog. Posts are matched by id (Instagram shortcode);
existing posts get their metadata refreshed (caption, owner, timestamp, type,
collections unioned) while AI-related fields and all user state (stars, watched, notes,
tags, trash) are left untouched. New posts are appended. Purged ids are skipped. `Reset`
remains the explicit full wipe, including trash/purged.

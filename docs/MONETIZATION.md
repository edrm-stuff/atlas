# Atlas — Monetization Strategy

*Drafted 2026-07-10. Working document — nothing here is committed scope.*

## 1. Where Atlas is today (the baseline we'd monetize)

Atlas is a **local-first, zero-backend** web app: users export their Instagram data from
Meta, drop the saved-posts file in, and get a searchable, taggable catalog (stars, watched,
notes, per-tag colors, trash with tombstones, merge-on-reimport). Storage is IndexedDB in
the browser. An AI enrichment layer (TL;DR + suggested tags via Anthropic/OpenAI, BYO API
key) exists in the repo but is detached from the UI (`docs/DECISIONS.md`).

Three properties matter for monetization:

1. **No Instagram API dependency.** Meta killed the Basic Display API in Dec 2024 and
   locked third-party consumer apps out of user content. Competitors that scraped or
   piggy-backed on the API died or live in ToS gray zones. Atlas's import path — the
   official Meta data export, which is the *user's own data* under GDPR/DMA portability —
   is the one channel Meta cannot close. This is a genuine moat, not a workaround.
2. **All user value is client-side today.** There is nothing to charge for yet: no account,
   no sync, no server. Monetizing means adding the first server-side surface.
3. **Data is small.** A catalog is thousands of JSON records, no media files (we link to
   Instagram, we don't rehost). Per-user storage cost is effectively zero unless we add
   media backup.

## 2. Market check — people do pay for this

| Product | Model | Price |
|---|---|---|
| mymind | Subscription, AI-organized "everything" inbox | $6.99–12.99/mo |
| Raindrop.io | Freemium bookmark manager | Free tier + Pro $3/mo ($28/yr) |
| Dewey | Instagram saves backup/organizer | Subscription |
| Sorti / Vestron | AI-sorted saves | Free, affiliate-monetized |

Takeaways:

- **The willingness-to-pay band for "organize my saved stuff" is ~$3–8/mo.** mymind proves
  the top of the band when AI does the organizing for you; Raindrop anchors the bottom.
- **A generous free tier is table stakes** (Raindrop's free tier is why it wins comparisons).
  Atlas already *is* a great free tier — keep the local-only app free forever.
- **The Instagram-specific niche is underserved and post-API-shutdown competitors are
  fragile.** Export-based import + genuinely good organization is a defensible position.

## 3. Monetization models, ranked

### Recommended: Freemium subscription (Free local / Pro cloud+AI)

- **Free (forever):** exactly today's app. Local-only, import, tag, search, notes. This is
  the top of funnel and the trust story ("your data never leaves your device — until you
  ask it to").
- **Pro — ~$4/mo or $36/yr:**
  - **Account + cloud sync** — use Atlas on phone and laptop, survive a cleared browser.
    This alone is the #1 conversion driver; IndexedDB-only means one lost browser profile
    = lost catalog, and users feel that risk.
  - **AI auto-organization** — reattach the existing AI layer, but server-side on *our*
    key with a quota (e.g. 2,000 enrichments/mo). TL;DR + suggested tags + auto-categories
    on import. The "it sorted 3,000 saves for me in one click" demo is the marketing.
  - **Automatic backups / export** (JSON/CSV), version history.
  - Later: TikTok/Pinterest/YouTube export import, link-rot detection ("this reel was
    deleted — here's your cached caption"), shared/public collections.

Why subscription and not one-time: the paid features have recurring COGS (storage, AI
tokens, sync traffic). A one-time price with ongoing AI cost is an unbounded liability.

### Worth adding alongside

- **Lifetime deal at launch** (e.g. $79, capped quantity) — indie-app classic; funds
  development, creates evangelists, and caps your AI exposure via the same quota.
- **BYO-API-key tier stays free** — power users bring their own Anthropic/OpenAI key and
  run enrichment locally (the code already supports this). Costs us nothing, builds
  goodwill, and those users rarely would have paid anyway.
- **Affiliate revenue (later, optional)** — saved posts are heavily commercial intent
  (recipes → ingredients, fashion → products, travel → bookings). Sorti monetizes this
  way. Only with explicit opt-in; it's a trust product.

### Rejected

- **Ads** — poisons the privacy positioning that is the core differentiator.
- **Selling insights/data** — same, fatally.
- **Pure one-time purchase** — see COGS argument above.

## 4. Unit economics of the AI layer

Enrichment = caption + metadata in, TL;DR + tags out. Using Claude Haiku 4.5
(~$1/MTok in, $5/MTok out), a post is roughly ~500 input + ~150 output tokens:

- **~$0.001–0.002 per post** → a 3,000-post catalog costs **$3–6 to enrich once**.
- Enrichment is mostly a **one-time cost per catalog** (new saves trickle in afterwards —
  tens per month, i.e. pennies).
- At $4/mo, month one may be break-even-ish on a huge catalog; every later month is
  ~95%+ margin on AI. Batch API (50% discount) and prompt caching push cost down further.
- The monthly quota (e.g. 2,000/mo) is the safety valve: a 10k-post catalog just takes a
  few months to fully enrich on the base plan, or we sell a one-time "enrich everything
  now" top-up ($5–10).

## 5. Infrastructure plan

Keep the philosophy: **local-first, sync as an enhancement**. The app must keep working
offline and free; the server is an optional replica. This matches the existing IndexedDB
architecture instead of fighting it.

| Concern | Choice | Est. cost at <1k users |
|---|---|---|
| Hosting | Vercel (already the deploy target) — Vite SPA + API routes as Vercel Functions (Fluid Compute), or migrate shell to Next.js later | $0–20/mo |
| Auth | Clerk (Vercel Marketplace, native integration) — email + Google sign-in, free to 10k MAU | $0 |
| Database | Neon Postgres (Vercel Marketplace). Tables: `users`, `posts` (jsonb payload, per-user), `user_state`, `sync_log` | $0–19/mo |
| Billing | **Merchant of record** — Paddle or Lemon Squeezy — handles EU VAT/invoicing for an individual seller; Stripe direct means doing VAT MOSS yourself | ~5% + fees |
| AI | Vercel AI Gateway → Haiku-class model, server-side key, per-user quota tracked in Postgres | usage (see §4) |
| Rate limiting / abuse | Upstash Redis or simple Postgres counters | $0 |
| Email (receipts, magic links) | Resend | $0 |

**Fixed floor before revenue: roughly $0–40/mo.** Nothing here requires committing before
there are paying users.

### Sync design (keep it simple)

Data volume is tiny and conflicts are rare (one human, two devices). Don't reach for
Replicache/CRDTs yet:

1. Add `updatedAt` (and a device id) to `CatalogPost` and to each `UserState` sub-record.
2. Client pushes dirty records, pulls records newer than its last sync cursor.
3. **Last-write-wins per record**, with two domain-specific rules reusing logic that
   already exists: merge imports server-side with the same union semantics as
   `src/import/merge.ts`, and let `purged` tombstones win over everything (already the
   local rule).
4. Sync endpoint is one Vercel Function; IndexedDB remains the source the UI reads from.

## 6. Implementation order

### Phase 0 — Validate before building (1–2 weeks, ~$0)
1. Landing page with the pitch + email waitlist ("Pro: sync + AI auto-sort, $4/mo — want it?").
2. Add privacy-respecting analytics (Plausible/Vercel Analytics) to the free app: imports
   completed, catalog sizes, return visits. This tells us if retention justifies Pro.
3. Ship the free app publicly (it's already deployable) and post it where the pain lives:
   r/Instagram, r/DataHoarder, TikTok/IG creators complaining about the saved-posts mess.
   The tutorial page (already built) is the activation funnel.
4. **Gate:** ~100+ waitlist emails or clear retention signal before writing backend code.

### Phase 1 — Accounts + cloud sync (the first paid feature)
1. Clerk auth (optional sign-in; app stays fully usable anonymous/local).
2. Neon Postgres schema + sync endpoint (§5). Encrypt payloads at rest.
3. "Enable sync" upsell moments: after a big import, and a gentle "your catalog only
   lives in this browser" nudge.
4. Multi-device works end-to-end; free users get sync *trial* (14 days) then read-only
   cloud copy — never take away local functionality.

### Phase 2 — Billing
1. Paddle/Lemon Squeezy checkout, webhook → `users.plan` in Postgres.
2. Plans: Free / Pro monthly $4 / Pro yearly $36 / launch lifetime $79 (limited).
3. Feature flags read `plan` server-side (sync quota, AI quota).

### Phase 3 — Reattach the AI layer, server-side
1. The provider abstraction (`src/ai/provider.ts`, `schema.ts`) already exists — add a
   third provider that calls *our* `/api/enrich` endpoint instead of Anthropic/OpenAI
   directly. BYO-key local path stays for free users.
2. Server: AI Gateway + Haiku-class model, batch where possible, per-user monthly quota,
   idempotent per post id (the `ai` status field already models pending/done/error).
3. UI: restore the generate button/settings (`src/ui/settings.ts` is still in the repo),
   plus "auto-enrich on import" toggle for Pro.
4. This is the marketing moment: "AI sorts your 3,000 Instagram saves" demo video.

### Phase 4 — Growth
- Browser extension: "save to Atlas" from any site (competes with Raindrop, feeds daily
  habit rather than one-time import).
- TikTok / Pinterest / YouTube data-export importers (same normalize→merge pipeline;
  `src/import/` is already structured for multiple sources).
- Public/shared collections (shareable link = organic acquisition loop).
- Affiliate experiments (opt-in) once traffic justifies it.

## 7. Risks & honest caveats

- **One-shot usage pattern:** many users import once, feel organized, and leave. Sync +
  extension + new-saves trickle are the retention counterweights; Phase 0 analytics
  exists to measure this *before* we build the backend.
- **Niche size:** "people who export their Instagram data" is a subset of "people annoyed
  by saved posts." The tutorial reduces that friction but it's real. Multi-platform
  import (Phase 4) widens the funnel.
- **Meta risk is low but nonzero:** export format changes regularly (we already handle two
  shapes — see `docs/DECISIONS.md`); parser maintenance is an ongoing tax. Meta cannot
  block export itself (GDPR/DMA), which is why this approach outlives API-based rivals.
- **Trust is the brand:** the moment Atlas is a cloud product, privacy policy, encryption
  at rest, easy export, and easy delete are product features, not legal chores.

## 8. TL;DR decision

Free local-first app forever (funnel + trust) → **Pro subscription at $4/mo / $36/yr** for
cloud sync + server-side AI auto-organization → validate with a waitlist before building →
Vercel + Clerk + Neon + Paddle + AI Gateway, ~$0–40/mo fixed cost, ~$0.002/post AI COGS.
First milestone is not code: it's 100 waitlist signups.

---

### Sources
- [Raindrop.io Pro pricing](https://raindrop.io/pro/buy) · [Raindrop review/pricing](https://toolradar.com/tools/raindrop)
- [mymind alternatives & pricing](https://www.kosmik.app/blog/mymind-alternatives) · [toolfinder on mymind](https://toolfinder.com/alternatives/mymind)
- [Dewey — Instagram saves manager](https://getdewey.co/instagram/) · [Sorti vs Vestron comparison](https://letitsorti.com/compare/vestron) · [Top saved-content apps 2026](https://letitsorti.com/journal/compare-top-5-apps-organize-saved-links-screenshots)
- [TechCrunch: Instagram locks out third-party consumer apps (Dec 2024)](https://techcrunch.com/2024/12/06/instagram-locks-out-developers-of-third-party-consumer-apps/) · [Meta Instagram API overview](https://developers.facebook.com/docs/instagram-platform/overview/)
- [TechCrunch: best bookmarking apps](https://techcrunch.com/2025/04/27/best-bookmarking-apps-to-help-organize-and-declutter-your-digital-life/)

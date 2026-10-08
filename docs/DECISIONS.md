# Material Decisions Register

Approval status values:
- **Proceeding:** being built under the owner's 2026-10-08 instruction to build.
- **Proposed:** awaiting approval.
- **Approved:** explicitly signed off.

| # | Decision | Reason | Benefit | Trade-offs | Phase | Status |
|---|---|---|---|---|---|---|
| D1 | Build a new application; do not port the original | Owner instruction | No inherited architectural debt | Legacy projects can't be imported until D17 | 0 | Approved (owner) |
| D2 | React 19, TypeScript, Vite, SPA | Mainstream, fast, and an editor needs no SSR | Maintainable, quick iteration | SEO pages, if ever needed, would be a separate site | 1 | Proceeding |
| D3 | Flow layout (stack/row/column) instead of absolute positioning | Email HTML is table-based, so absolute layouts cannot survive Outlook or Gmail | What you design is what recipients get | No free-form overlapping; image effects are baked into images instead | 1 | Proceeding |
| D4 | Single pure renderer: the canvas shows the real email HTML (annotated) in Shadow DOM, with an interaction overlay | Removes editor/export drift entirely | Every control affects the export; previews are trustworthy | Overlay maths must track zoom; the canvas re-renders the whole HTML on each change (cheap at signature scale) | 1 | Proceeding |
| D5 | Zustand + Immer snapshot history, with coalescing keys and explicit transactions | Reliable undo for drags and grouped edits | A drag or slider scrub is one undo step | Snapshot memory is bounded at 200 steps | 1 | Proceeding |
| D6 | Profile-connected `field` nodes, with detach and reattach | One source of truth for identity | Change the title once and it updates everywhere | Users must understand the "connected" badge (made explicit in the inspector) | 1 | Proceeding |
| D7 | Theme tokens (`$ink`, `$accent`, `$display` and others) resolved at render time | Global theming plus local overrides | Palette and font presets restyle a whole design instantly | One more concept, hidden behind swatches in Simple Mode | 1 | Proceeding |
| D8 | Bake crop, zoom, shape and radius into hosted PNG derivatives | Outlook ignores border-radius and object-fit | Identical rendering across clients | The image must be re-published after an edit (automatic) | 4 | Proceeding |
| D9 | Content-addressed, immutable image URLs (`s/<sha256>.png`) with anonymous fetch verification before Ready | The original's image-hosting failures | No false "Ready"; deduplication; no PII in object paths | Needs a host deployment to reach Ready | 4 | Proceeding |
| D10 | Cloudflare R2 + Worker as the recommended host, behind an `AssetHost` adapter | Supabase free tier pauses on inactivity; egress costs | Durable, cheap, migratable through a custom domain | A Cloudflare account and domain are required; the Worker is shipped but not deployed | 4 | Proposed (deployment) |
| D11 | Social icons rendered on the fly from bundled SVGs into the chosen colour and style, then published | Unlimited style and colour combinations without a static icon CDN | Custom brand-coloured icons, still hosted and verified | First copy publishes a few small PNGs | 4 | Proceeding |
| D12 | Font library with declared email fallbacks, plus an "As recipients see it" toggle | Webfonts rarely render in recipients' clients | Honest previews | Webfont choice can be disappointing in the inbox, so it is surfaced up front | 3 | Proceeding |
| D13 | Guided copy-and-paste Gmail wizard as the primary install path | It is the only supported way to set named signatures and the separate defaults | Works for every account; no restricted scopes | Manual paste step remains | 4 | Proceeding |
| D14 | OAuth `sendAs.patch` one-click install | Convenience | One click for single-signature users | Restricted scope, Google verification and security assessment cost; cannot set Full/Reply defaults | Future | Proposed |
| D15 | Local-first persistence in IndexedDB, no account required | Users can begin immediately | Zero-friction start, offline | Data is per-browser until cloud sync exists | 1 | Proceeding |
| D16 | Supabase Auth + Postgres (RLS, `revision` optimistic concurrency, `project_revisions`), with images on R2 | Mature auth and row-level security; images decoupled from database liveness | Cross-device projects, conflict safety | Extra service to operate | 5 | Proposed |
| D17 | One-way importer for legacy Signature Studio formats | Continuity for existing users | Keeps old work | Needs real export samples; deferred by owner direction | 5 | Proposed |
| D18 | Local named versions (snapshots) in this release; cloud history in Phase 5 | Recovery without an account | Safe experimentation | Local only until cloud | 2 | Proceeding |
| D19 | Brand colour extraction from an uploaded logo (client-side quantisation) | Faster on-brand setup | One click to a matching palette | Heuristic results; always editable | 3 | Proceeding |
| D20 | No AI features in 2.0 | No proven user value yet; privacy considerations | Simpler, private product | Fewer marketing hooks | — | Proposed |
| D21 | Billing and plans proposed separately; entitlement checks isolated behind a `features` module | Spec instruction | Can monetise later without refactoring | — | Future | Proposed |

# Signature Studio 3.0 — implementation plan

Date: 11 October 2026  
Branch: `codex/signature-studio-3`  
Starting revision: `ba4f912150b32e05cbc14c2546baedce2b8c8ffb`

## Product outcome and release boundary

Make it substantially easier to create a signature, compare real designs, repair layout problems, edit several components, and check the result before installing it. Serve individual professionals, Modern Gentlemen's internal users, small teams, and agencies through the same reliable editor foundation.

The first release is a local editor milestone. The complete 3.0 program also includes shared branding, agency workflows, cloud recovery, deployment, and campaigns. Those require separate services and provider authorization; they remain in this plan with explicit gates. A browser preview, copied signature, and installed signature must have distinct statuses.

Existing capabilities are retained and extended: forty personalized templates; guided and advanced modes; Full/Reply variants; crop controls; fallback font previews; profile bindings; reusable components and brand kits; named versions; project import/export; and verified image publishing. These are not counted as newly invented features.

## Work order

1. Close import security and data-loss defects. Add regression coverage before broadening the editor.
2. Establish normalized multi-selection and pure proposal transformations. Keep project identity and save lifecycle independent from design history.
3. Ship visual template audition, structural layout fixes, bulk controls, and preview diagnostics.
4. Add reviewed contact import, guided quick-add controls, visual version comparison, and searchable image inspection.
5. Validate existing and new flows on desktop and mobile, then publish a preview release for review.
6. Complete the remaining editor capabilities below, followed by cloud, shared branding, deployment, and agency milestones.

## Prerequisite fixes: every review finding

| ID | Failure found | Required implementation | Acceptance evidence |
|---|---|---|---|
| F01 | Imported IDs/styles can inject markup or executable content | Typed, bounded recursive validation; safe ID/font/colour/value allowlists; strip unknown properties; escape renderer attributes; rasterize imported images | Malicious ID, CSS breakout, malformed image input rejected; ordinary templates round-trip |
| F02 | Undo after a cross-tab conflict returns to the original project ID | Preserve active identity across undo/redo and rebase all history when forking | Conflict creates a separate copy; repeated undo/redo and saves cannot overwrite the other tab |
| F03 | A failed save followed by switching loses edits | Save returns success/failure; serialize pending writes; block project replacement until saved; retain error state | Inject a storage failure, attempt Open/New, verify current edits remain |
| F04 | Clicking a signature link navigates away while editing | Cancel link navigation inside the edit canvas and comparison previews | Clicking email, website, button and image links leaves the editor open |
| F05 | Failed re-verification leaves images copy-ready | Invalidate failed/stale published cache; only use sufficiently recent verification; guard asynchronous work against project changes | A previously ready image fails verification and install/export become unavailable |
| F06 | Import reuses original asset IDs and overwrites another project's blobs | Allocate fresh IDs and remap image/social references; clear public derivative cache | Import same file twice and import a deliberately colliding ID; original image bytes remain unchanged |
| F07 | Closing one dialog immediately closes the next | Ignore programmatic close events belonging to a dialog that is no longer active | Export → Prepare, settings transitions and preview → layout fix remain open |
| F08 | Saved image components omit source metadata | Bundle metadata and source blobs; remap IDs on import; insert referenced metadata into recipient project | Save, export, import and insert an image component into another project |
| F09 | Permissive schema admits invalid trees | Require node-specific props, row/column rules, unique IDs, finite bounded values, bounded depth and node count | Reject malformed props, illegal children, duplicate IDs and excessive nesting without crashing |
| F10 | Keep Custom loses detached field text | Treat detached fields as custom content and preserve them in Extras | Audition and apply another template, find original detached text, undo correctly |
| F11 | Drop into a container containing only hidden children crashes | Resolve an empty visible list explicitly | Drop into a hidden-only section with ghosts disabled |
| F12 | Deleting a dirty project causes autosave resurrection | Cancel debounce, finish queued writes, detach current editor state before deletion | Dirty active project stays deleted after timers and reload |
| F13 | Duplicate misses unsaved edits | Duplicate the current in-memory snapshot | Edit and immediately duplicate before debounce; copied project contains latest text |
| F14 | No-op inline website editing shortens the actual target | Compare presentation text before writing back; preserve underlying URL | Enter/blur unchanged displayed website retains protocol, path and query |
| F15 | Enter hijacks focused toolbar buttons | Preserve native control activation; scope shortcuts outside dialogs and typing fields | Focus a toolbar button and press Enter; activate it once without starting inline edit |

Changes to image publishing also require a project identity guard: asynchronous results from one project must not write into the project opened subsequently.

## First editor release: detailed specifications

### E01 — template comparison

Flow: shortlist up to three layouts → open comparison → see current design and candidates with the actual profile/images/custom content → toggle Full/Reply, Keep Look and Keep Custom → choose one → apply once or cancel.

Implementation: build each candidate from a cloned project with the existing template mapping; isolate previews from edit state; measure rendered widths; show overflow, matching image counts and Extras impact. Candidate IDs are transient editor state. Applying uses one history step.

Acceptance: opening, toggling, choosing and cancelling do not alter document/history; detached values survive Keep Custom; one Undo restores the exact prior design; images and social sources render consistently. Next editor iteration adds fit-ranked suggestions, a custom-component tray, explicit field mapping and per-candidate long-profile checks.

### E02 — smarter layout fixes

Flow: open Fix Layout → review before/after → choose compact spacing, wrap contacts, rebalance columns, or stack vertically → check measured width → apply one proposal. Allow sequential proposals where one repair is insufficient.

Rules: preserve content and font size; respect locked sections; keep IDs and reading order; avoid silently removing contact data; explain that stacking removes column-divider decoration. Current global Auto-Fit remains available as an explicitly labelled scale operation.

Implementation: pure proposal functions operating on cloned documents, plus a shared preview frame. Column sizing considers content length and removes explicit column widths. Proposals do not promise to fit until measured in the browser.

Acceptance: no document changes before Apply; all leaf content remains; locked sections stay intact; transformed trees satisfy schema; one Undo per proposal. Next iteration ranks candidates by actual measurements, crop constraints and least-change score, and offers combinations with explanations.

### E03 — multi-select editing

Flow: Shift/Control/Command-click canvas or use layer checkboxes → inspect count and primary component → change common typography, padding and visibility → copy primary format, select similar types, group adjacent components, duplicate, delete or move as a set.

Implementation: normalized selection ID array plus a primary ID. If an ancestor is selected, exclude its descendants from duplicate processing. Mixed values must be labelled rather than guessed. Bulk commands commit once; invalid destinations must be rejected before removal. Multi-drag preserves document reading order; adjacent grouping avoids moving unselected siblings. Locked components/ancestors are excluded from edits.

Acceptance: mixed-value controls work without replacing content; delete and duplicate are atomic and undoable; moving cannot create cycles or illegal column structures; keyboard commands respect inputs and dialogs. Next iteration adds marquee selection, richer alignment/distribution guides and saved format presets.

### E04 — expanded preview lab

Include: actual details; long name/title/company fixture; missing optional details; multilingual fixture; Full/Reply comparison; light/dark backgrounds; images blocked; original/fallback fonts; 320/375/480px layout probes; measured overflow badges; selectable design checks.

Implementation: clone fixtures without changing the saved profile; reuse the signature renderer; isolate output in shadow roots; suppress links; preserve image geometry when blocked. Clearly label browser diagnostics. Dark background does not simulate client colour inversion; changing target width is a layout probe, not evidence that fixed exported HTML responds automatically.

Acceptance: no fixture or preview setting changes profile/history; blocked-image previews show alternative text; narrow overflow is visible; checks select the correct component. Actual Gmail/Outlook/Apple Mail screenshots and test-email capture need a separately configured service and test accounts.

### E05 — actionable quality checks

Resolve inherited colour, background, size and weight; check normal/large-text contrast; identify unreadable scaled text, missing image/QR alternative text, inadequate cropped source resolution, unsafe or empty link targets, oversized HTML and missing assets. Ignore content hidden in the selected variant. Link each warning to its component and explain the cause.

First milestone provides diagnostic warnings and selection. Follow-up supplies previewable targeted fixes with a change summary: choose readable colour, restore minimum type size, wrap contact value, fill functional alternative text, remove empty row or choose appropriate derivative. Never mark a diagnostic-only result as “verified in Gmail.”

### E06 — guided creation and contact import

Allow adding a logo, photo, booking button and social block from Simple mode. Keep uploads/crop and connected profile editing available without requiring Advanced mode. Offer conservative local parsing of labelled contact text or vCard, show detected/current values, let users exclude fields, then apply once.

Next iteration: repeated contact values, better separators/labels, conditional fallbacks and empty-row collapse; edit-scope explanation (shared profile versus local override); per-variant typography/spacing overrides; tap-based mobile reorder and explicit touch gestures. Screenshot/business-card/old HTML extraction comes later with a reviewable field-mapping step.

### E07 — image library and history

First milestone: search uploaded names, light/dark image inspection, and visual current-versus-version comparison before restoring; keep the automatic before-restore snapshot.

Next iteration: asset tags/favourites, transparent-padding trim, retained original plus derivative, focal point, replacement impact list, optional background removal; history thumbnails, change summaries, selective style/content restore, and design branches. An image still used by a project, saved component or version cannot be garbage-collected.

## Remaining editor features from the research

| Feature | Implementation approach | Dependency / release gate |
|---|---|---|
| Named text and spacing styles | Versioned style tokens referenced by nodes, explicit overrides and detach | Schema migration, resolved-renderer tests, export compatibility |
| Linked reusable blocks | Component identity/version, update-impact preview, independent-copy option, rollback | Stable library records and asset ownership; no silent cross-project updates |
| Template mapping and Extras tray | Expose matching rules and unplaced content before Apply; allow explicit relocation | Audition foundation and safe atomic tree edits |
| Content-aware recommendation engine | Measure candidates with current and stress profiles; rank fit, readability and smallest change | Preview measurement and deterministic repair proposals |
| Per-variant overrides | Resolve Full/Reply text/box styles without duplicating profile data | Versioned schema and migration preserving v1 exports |
| Advanced image cleanup | Trim/background removal as new derivatives, keep source, confirm replacement footprint | Asset ownership, image-processing service if remote |
| Existing signature migration | Parse safe HTML/text/vCard; later OCR of business card/screenshot; explicit field mapping | Sanitizer, parser limits, extraction evaluation and user review |
| Scoped AI editing | Structured commands only; diff + before/after + undo; explain uncertain extraction | Server-side key handling, consent, bounded schema actions, evaluation set |
| Review links and comments | Bind comments to immutable design revision; approve that revision; revoke guest access | Tenant authentication, access control and hosted snapshots |
| Richer visual history | Thumbnails, branches, comparison, selective restoration | Stable version IDs and ownership-aware asset retention |
| Accessibility/mobile polish | Keyboard selection, announced mixed state, touch reorder, readable contrast, focus recovery | Desktop/mobile browser QA and assistive-technology pass |

## Complete 3.0 program beyond the editor

| Milestone | Features retained from the earlier roadmap | Build order and acceptance |
|---|---|---|
| P1 — installation confidence | Destination-specific instructions; plain-text export; test-email checklist; image/link health; distinguish copied, user-confirmed, provider read-back and delivery-tested states | Expand current Gmail flow and support matrix first. A “Copy” success must never imply deployment. Validate real email rendering before declaring supported clients. |
| P2 — professional continuity | Optional accounts, cloud backup, cross-device editing, multiple professional identities | Establish authentication, ownership, export/delete, recovery, concurrency and conflict merge. Local work remains usable without an account. Confirm recovery across two devices and failed sync. |
| P3 — contact experiences | Hosted contact card, synchronized vCard/QR/booking, later Wallet pass | Immutable signature points to revocable hosted card. Validate privacy, correct update scope and offboarding; QR must retain a useful text alternative. |
| P4 — Modern Gentlemen / small teams | Shared brand templates, inherited/locked blocks, field ownership, self-service profile updates, draft review, published releases, rollback | Create organization/role model, versioned templates and publishing boundary. Preview every affected member before releasing. Locking in UI is backed by service-side authorization. |
| P5 — roster and lifecycle | CSV people import, field mapping, groups, onboarding/offboarding, assignment rules, audit log | Validate roster before commit, detect duplicates, provision/deprovision idempotently, report per-person outcomes. Preserve personal overrides according to explicit policy. |
| P6 — agency operations | Isolated client workspaces, branded intake, revision-bound guest comments/approvals, handoff/install pages, portfolio exports, ownership transfer, revocable guests | Tenant isolation first, then client workflows. Test that one client can never read another client's data/assets. Transfer ownership without losing history or public image longevity. |
| P7 — managed deployment | Personal Gmail installation; separately authorized Google Workspace admin deployment; Outlook compose add-in; rollout tracking, backup, retry and rollback | Pick Modern Gentlemen's actual provider before prioritizing connector. Prototype restricted OAuth/admin consent and client-version behavior; use evidence-backed deployment statuses. No simulated connector buttons. |
| P8 — signature campaigns | Immutable banner/CTA releases, targeting, schedule/expiry/fallback, UTM, explicit click events, later conversion and A/B tests | Requires shared publishing and reliable provider update route. Expired campaigns restore fallback. Separate actual clicks from inferred image opens; do not claim trustworthy open rates from image loading. |
| P9 — commercial and advanced integrations | Professional/team/agency packaging, usage reporting, CRM/HRIS/PSA integrations, SSO/SCIM, optional mail relay | Ship baseline security/export/backup across packages. Add costly integrations after demand and proof-of-concept; mail relay is a separate infrastructure/security program. |

Brand extraction from a website or screenshot is part of the reviewed AI/migration workflow. Analytics should expose known/unknown status and auditable events; browser-local guesses are not deployment evidence.

## Architecture and migrations

- Preserve one renderer for canvas, diagnostic previews and email export. Do not introduce arbitrary HTML/CSS authoring into the core model.
- Keep the project schema at v1 for compatible editor additions. Introduce an explicit v2 migration only when linked styles, overrides or hosted ownership need persistent fields.
- Keep selection, shortlist, fixtures and dialogs outside the saved document.
- Serialize save writes and protect transitions. Keep identity/created time/public verification cache outside design undo history. Use browser locks where available and optimistic conflict copies otherwise.
- Store components with complete asset dependencies. Re-key imported assets; public URLs remain derived and re-verified.
- For cloud expansion, split personal project ownership from organization/template membership, revisions, assets, releases, installations and audit events. Introduce real services with authorization tests, never placeholders that suggest a completed integration.

## Validation and release gates

Automated: existing model/render/history suite; all template migrations; malicious import and malformed tree corpus; pure layout transforms; selection normalization; bulk move/duplicate/delete; storage failure/conflict races; cache invalidation; local parser fixtures; browser dialog transitions and keyboard behavior.

Browser: full onboarding → edit → audition/cancel/apply/undo → multi-select → repair → preview fixtures → save/reload → duplicate/delete/import/export → install preparation. Include hidden-only drops, invalid targets, network/storage failure, desktop and phone-sized screens.

Email acceptance: retained export invariants (table layout, inline styles, safe links, public image URLs), Full/Reply outputs, image hosting anonymous verification, and real send/receive tests. Client integrations and actual-client screenshots are separate gates requiring accounts/services.

Release only after build/typecheck/unit/browser checks pass and known limitations are recorded. The first implementation report must state which features are shipped, partial, or still planned; this document is a roadmap, not a completion claim.

## Research references and competitor inspiration

Prior research favoured creation quality and dependable editing over adding template count alone. Exclaimer and CodeTwo inform centralized branding/deployment and preview workflows; WiseStamp and MySignature inform professional creation and app-like extras; Newoldstamp and Opensense inform campaign/governance workflows; Bybrand and Gimmio inform reusable designs and controlled customization.

Official reference pages for continuing validation:
- [Exclaimer email signature management](https://exclaimer.com/email-signature-management/)
- [CodeTwo Email Signatures 365](https://www.codetwo.com/email-signatures/)
- [WiseStamp email signature generator](https://www.wisestamp.com/email-signature-generator/)
- [MySignature](https://mysignature.io/)
- [Newoldstamp](https://newoldstamp.com/)
- [Opensense](https://www.opensense.com/)
- [Bybrand](https://www.bybrand.io/)
- [Gimmio](https://gimm.io/)
- [Google Gmail SendAs resource](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.settings.sendAs)
- [Google Gmail OAuth scopes](https://developers.google.com/workspace/gmail/api/auth/scopes)
- [Microsoft Outlook setSignatureAsync](https://learn.microsoft.com/en-us/javascript/api/outlook/office.body?view=outlook-js-preview)
- [Microsoft event-based activation](https://learn.microsoft.com/en-us/office/dev/add-ins/develop/event-based-activation)

Provider limitations must be revalidated during connector implementation. Gmail SendAs, named signatures/Reply defaults and Workspace authorization are distinct capabilities. Outlook compose APIs depend on supported requirement sets and clients. A real-client compatibility claim must be supported by an installed/sent test, not marketing language.

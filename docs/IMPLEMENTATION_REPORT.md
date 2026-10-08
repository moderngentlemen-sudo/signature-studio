# Implementation report: Signature Studio 2.0 (alpha 1)

Date: 2026-10-08 · Branch: `claude/signature-studio-2-remake-jmzvj4`

The owner directed a clean build from the specification, not a port of the original app. The proposal ([`PROPOSAL.md`](PROPOSAL.md)) and decision register ([`DECISIONS.md`](DECISIONS.md)) were written first. This release implements Phases 1–4 of the roadmap. Phase 5 (accounts and cloud sync) and later phases still need approval.

## Features implemented

**Editor**
* Simple Mode (guided: details → style → logo and photo → socials → install) and Advanced Mode share one document.
* Canvas built on the real email HTML in Shadow DOM, with an overlay that provides:
  * hover and selection outlines;
  * a floating toolbar (parent, move, duplicate, visibility, lock, delete);
  * drag-to-move;
  * drop indicators;
  * "drop beside", which creates columns;
  * an image corner handle, a width handle, and column gutters;
  * snapping to a 4px or 8px grid and to sibling image widths, with Alt for no snap.
* Inline text editing (double-click or Enter) with plain-text paste, Escape to cancel and Enter to commit.
* Drag and drop from the component library, within the canvas, and in the layers panel. Every drag also has click or keyboard alternatives.
* Undo and redo with coalescing: typing, slider scrubs and drag gestures each count as one step.
* Keyboard shortcuts, with a shortcut sheet behind `?`.
* Zoom, fit to screen, preview mode, a Full / Reply / Compare switch, ghosts for components hidden in the current variant, and an "As recipients see it" font-fallback view.
* Contextual inspector for each component type, with typography, box and spacing, visibility, rename, save as component and reset style. With nothing selected it shows document settings: target width, scale, Auto-Fit, palette, fonts, spacing, alignment, background, and the compact Reply preset.

**Design system**
* 40 templates across 19 categories, with live previews using the user's own details, search, category filters, favourites, recently used, and profession suggestions.
* Safe template application:
  * profile, socials and images are always kept, and images go into slots by role;
  * stock template content is recognised, so it is not mistaken for user content;
  * edited same-name blocks move into the new layout;
  * other custom components go to "Extras";
  * the user can choose to keep their current look;
  * one undo step reverses it all.
* 38 library components built on 13 node types, plus saved components with import and export.
* 12 palettes and 10 type pairings. Brand kits can be saved and applied. A palette can be extracted from the logo.
* 21 curated fonts, each with a declared email fallback and an "Email-safe" marker.

**Identity and contact**
* Central profile with 14 fields and custom fields.
* Connected fields, with detach and reattach.
* Contact block with stacked, inline or grid layout; no, short or full labels; 6 separator options (including none); per-item visibility and order; and a no-wrap option.
* "No separator" still leaves readable spacing between items.

**Images**
* Upload validation: type, 15 MB limit, and decodability.
* SVG, GIF and WebP files, and very large images, are rasterised so user SVG markup is never rendered.
* Crop, zoom, pan (with keyboard support), frame aspect, shape and radius.
* Alt text is suggested automatically.
* Replace everywhere, duplicate detection, and usage counts.

**Social links**
* 12 platforms plus custom links, detected automatically from the pasted URL.
* 6 icon styles: circle, bare, outline, tile, letter and text.
* Colours, size, spacing, visibility per block, accessible labels, and custom icon uploads.

**Gmail pipeline**
* Each variant collects only the images it actually uses. Each image is:
  * derived at 2× with crop, shape and tint baked in;
  * hashed with SHA-256;
  * published to `s/<hash>.<ext>`;
  * verified anonymously: HTTPS, status 200, MIME type, decode, and dimensions.
* The final HTML is rendered with verified URLs only and then validated. The validator checks for `data:` and `blob:` images, non-public hosts, scripts, unsafe links and editor attributes, and enforces Gmail's 10,000-character limit.
* Copy, install and HTML download are blocked until the variant is ready.
* Install wizard:
  * readiness check with Retry and Show actions;
  * a consent step before images are published;
  * Copy Full and Copy Reply as rich `text/html`;
  * step-by-step Gmail paste instructions;
  * signature defaults, including per send-as address;
  * a verification checklist and troubleshooting.
* Cloudflare Worker and R2 host (`worker/`) with magic-byte checks, a size limit, hash-must-match-key, immutable caching, CORS, and no remote fetching.
* A local test host and a clearly labelled test-build mode.

**Projects**
* Local-first IndexedDB storage: multiple projects with debounced autosave and flush on page hide.
* Conflict detection across tabs: if another tab saved newer work, your edits are saved as a separate copy rather than overwriting it.
* Rename, duplicate and delete.
* Project file export and import. The export embeds the original images. Import validates against the schema and always creates a new project.
* Versions: named and automatic snapshots, with restore. The current state is snapshotted before a restore.
* Export formats: HTML (gated on readiness), source HTML copy, PNG at 2×, and the project JSON.

**Design assistance:** Auto-Fit with a 10px readability floor and an honest report when it can't fit, overflow detection, contrast warnings, missing-alt warnings, and web-font fallback notices.

**Robustness**
* Every href goes through an allow-list of http(s), mailto and tel. All text is escaped.
* A damaged component renders as "Damaged component" without breaking the signature.
* The undo history excludes the verified-image cache.

## Architecture (as built)

* React 19 + TypeScript + Vite, Zustand + Immer, zod, idb-keyval, lucide-react, html-to-image (lazy-loaded), qrcode-generator, and hand-written CSS with design tokens.
* `renderSignature(project, {variant, mode})` is the only renderer. Its three modes:
  * `edit`: annotated, with ghosts and placeholders;
  * `preview`: local images;
  * `email`: verified URLs only.

## Tests performed

| Suite | Result |
|---|---|
| Unit (Vitest): 30 tests covering every template in both variants (validator-clean, under the Gmail limit), literal visibility, connected and detached fields, separator spacing, escaping and unsafe links, scale, tree operations (move, illegal moves, duplicate, group, ungroup), template application (images, Extras, keep look, no tint on uploads), project file round-trip and rejection, URL sanitisation, platform detection, crop maths, phone formatting, history (undo/redo, coalescing, gestures), and draft-safe edits | **30 / 30 passed** |
| End-to-end (Playwright, headless Chromium): 17 tests covering onboarding, inline editing of connected fields, library drag-drop with undo and redo, click-insert, duplicate and delete, Full/Reply visibility, template switch with Extras, layers drag reorder, autosave across reload, text-only rich copy, image readiness gating and publishing (built-in and uploaded), rejection of unsupported uploads, project export and import, damaged-import refusal, PNG export, mobile editing without horizontal overflow, and accessible button names | **17 / 17 passed** |
| `tsc -b` typecheck | Passed |
| Production build | Passed (≈187 KB gzipped main bundle) |

**Not yet performed:** live Gmail, Outlook and Apple Mail acceptance. This needs a deployed Worker and real accounts; the protocol is in [`GMAIL_ACCEPTANCE.md`](GMAIL_ACCEPTANCE.md). The end-to-end tests use a local *test* host on `localhost` and are **not** live integrations.

## Bugs found and fixed during testing

* Deep-cloning Immer drafts with `structuredClone` threw an error, which broke Duplicate and template switching. This is now handled by a draft-aware clone, and a regression test was added.
* Applying a template counted the template's own disclaimer as user content. This is fixed by recognising stock content.
* Vite inlined the small logo SVG as a data URL with single quotes, which broke CSS mask previews. Assets are no longer inlined, and URLs are quoted safely.
* Dragging started a text selection across the page. Selection is now suppressed while dragging.

## Known limitations

* No accounts or cloud sync yet (Phase 5, awaiting approval). Data lives in one browser until the user exports a project file.
* Uploads to the image host use a single shared upload key, which suits a single workspace, not a public SaaS.
* The PNG export of tinted built-in artwork relies on CSS masks, which html-to-image may not render in every browser. The email PNG pipeline is unaffected.
* Dragging is not built for touch beyond basic pointer support. Phone use focuses on content editing, preview and copying.
* Layer multi-select, alignment guides between unrelated components, and per-component Auto-Fit are not implemented.
* The main bundle is about 600 KB before compression. Code-splitting the dialogs would reduce it.
* Gmail's 10,000-character limit is enforced, but very complex designs can come close to it.

## Deferred, needing approval

Cloud accounts and sync with optimistic concurrency (D16), legacy importer (D17), OAuth `sendAs` install (D14), browser extension, billing and plans (D21), AI features (D20), and deployment of the image Worker to a Modern Gentlemen domain (D10).

## Deployment

1. `npm ci && npm run build`, then deploy `dist/` to any static host (Cloudflare Pages recommended).
2. Deploy `worker/` (see `worker/README.md`). Set `ALLOWED_ORIGINS` to the app's origin and a custom domain for the images.
3. Optionally build with `VITE_ASSET_HOST=https://img.your-domain.com`.
4. Run the manual acceptance protocol and record the results.

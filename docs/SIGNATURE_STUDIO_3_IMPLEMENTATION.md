# Signature Studio 3.0 — first editor implementation

This branch implements the first local editor milestone. It is a 3.0 alpha, not the completed cloud/team/agency product.

## Implemented

- Full-size comparison of the current signature and up to three templates using actual profile, images and retained custom content. Shortlist candidates, switch Full/Reply, preserve colours/fonts, apply once or cancel.
- Previewable layout repairs: compact spacing, wrap contacts, rebalance columns and stack columns. Preserve content/type sizes; respect locked sections; apply one undoable proposal.
- Canvas modifier-click and layer checkbox multi-selection. Bulk typography, padding, visibility, primary-format copying, similar-type selection, adjacent grouping, atomic move/duplicate/delete and keyboard reorder.
- Preview lab: light/dark backgrounds, blocked images, fallback/original fonts, Full/Reply, narrow width probes and long/missing/multilingual content fixtures.
- Quality diagnostics for inherited contrast, unreadable scaled text, contact labels, missing functional alternative text, source crop resolution, invalid links, missing assets and HTML size; select an affected component.
- Reviewed local vCard/contact-text import with field selection and one-step undo.
- Simple-mode logo/photo/social/booking quick-add; image-name search and light/dark inspection; visual version comparison.
- Strict import validation, typed styles/props, bounded trees, unique IDs, escaped renderer attributes, safe image ingestion and fresh imported asset IDs.
- Save failure protection, serialized writes, conflict-history identity rebasing, dirty project deletion protection, latest-state duplication, and project guards around asynchronous operations.
- Failed/stale image verification removes readiness. Saved components include source metadata/blobs, and insertion transfers metadata into the recipient project.
- Safe edit-canvas links, safe dialog handoffs, hidden-only drops, preserved no-op website targets and native toolbar Enter activation.
- Version metadata updated to 3.0.0-alpha.1; production vendor chunks split for independent caching.

## Validation

- 62 unit/regression tests pass: original model/render/history tests plus import security, all template migrations, layout proposals, multi-selection, contact parsing, storage failure/conflicts, duplicate/delete/import lifecycle and image verification.
- 13 focused browser scenarios pass in Microsoft Edge on desktop and a 390px phone viewport, with no page errors. These cover audition cancellation, repair and undo, multi-selection, preview fixtures and dialog handoff, native Enter, contact review/undo, link navigation suppression, malicious import rejection, real source-image isolation, portable saved images, hidden-only drops, visual versions and phone guided creation.
- Type checking and the production build pass.
- Production app chunk is approximately 314KB, with separate React (222KB) and schema (93KB) chunks before gzip. Vendor splitting changes caching boundaries; it does not remove the need to load those dependencies.
- The browser smoke script is committed as `scripts/verify-studio3.mjs`. It uses a local development server and an isolated browser context. Fonts are blocked during those checks so they do not depend on external font delivery.
- Build output includes benign annotation warnings from the installed Zod dependency; the bundler strips those comments.

## Remaining work and honest preview limits

Browser diagnostics are simulations. Dark background does not reproduce email-client colour inversion, and narrow target probes do not prove exported signatures are responsive. Real Gmail/Outlook/Apple Mail send/receive acceptance has not been completed in this change.

This milestone provides diagnostic selection, rather than automatic targeted repairs for every warning. Marquee selection, conditional/repeated contacts, per-variant styling overrides, named linked styles/components, template mapping trays, fit ranking, advanced asset cleanup/tags, richer visual history, OCR/AI assistance, cloud backup, guest review, team/agency workspaces, hosted contact cards, campaigns, analytics and managed deployment remain in the complete implementation plan with prerequisites and release gates. No external services or provider integrations are simulated as completed.

All fifteen earlier review findings have corresponding fixes. Test scope differs by finding: browser coverage exercises the actual DOM/image paths, while failure and conflict injection uses the repository interface in unit tests.

See [the complete implementation plan](SIGNATURE_STUDIO_3_PLAN.md).

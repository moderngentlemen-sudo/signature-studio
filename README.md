# Signature Studio 3.0

The 3.0 editor preview adds template comparison with real content, reviewable layout repairs, multi-selection editing, expanded preview diagnostics, and reviewed contact import. See [the implementation plan](docs/SIGNATURE_STUDIO_3_PLAN.md) for release gates and the complete roadmap.

The refreshed interface adds a live welcome preview, visible field labels, separate workspace and editing controls, keyboard panel navigation, and accessible phone panels. History, export, settings and advanced editing remain available through **More tools** on smaller screens. The interface uses teal, ivory, serif headings and larger controls; exported signatures keep their own design settings.

To run the focused browser checks, start the development server on port 5182 and run `node scripts/verify-studio3.mjs`. Set `BROWSER_EXECUTABLE_PATH` when using a system browser and `QA_OUTPUT` to save a screenshot and results. Unit tests also run with `npm test -- --pool=threads` where process isolation prevents access to temporary caches.

A premium email-signature design studio with **Gmail installation that actually works**. You design once and get a Full signature and a Reply signature. Every image is published to a verified public URL before you are allowed to copy.

* **Simple and Advanced modes** on one document: a guided four-step flow, or full design control. Advanced mode adds the layers panel, inspector, drag and drop, resize handles, snapping, undo and redo, and keyboard shortcuts.
* **40 templates** across 19 categories. Switching layouts keeps your profile, social links, images and custom components.
* **One profile, connected everywhere.** Editing your title once updates every component that shows it. A component can be detached when it needs independent text.
* **Full and Reply visibility** per component (Both / Full / Reply / Hidden), with a side-by-side compare view and a one-click "Make Reply compact" option.
* **The canvas uses the email HTML renderer.** The editor previews the same table-based markup used for export. An "As recipients see it" mode shows fallback fonts. Email clients can render the markup differently; send a test email to check the installed result.
* **Images you can trust:**
  * crop, shape, radius and tint are baked into a 2× PNG;
  * each image is stored at a content-addressed, immutable URL;
  * each URL is fetched back anonymously and decoded before the signature counts as ready.
* **Local-first.** Projects, images, saved components, brand kits and named versions are stored in your browser, and no account is needed. Projects can be exported and imported as files.

See [`docs/PROPOSAL.md`](docs/PROPOSAL.md) for the product, UX and architecture proposal, [`docs/DECISIONS.md`](docs/DECISIONS.md) for the decision register, and [`docs/IMPLEMENTATION_REPORT.md`](docs/IMPLEMENTATION_REPORT.md) for what has been built and tested.

## Run it

```sh
npm install
npm run dev            # http://localhost:5173
```

### Image hosting

A signature that contains images can be installed only after those images are published to a public host:

* **Production:** deploy the Cloudflare Worker and R2 bucket in [`worker/`](worker/README.md). Then enter the host address and upload key in **More tools → Settings**. Set `VITE_ASSET_HOST` at build time to pre-fill the address. Never put the upload key in the build.
* **Local testing:** run `npm run dev:host`, which starts a test host on `http://localhost:8787` with upload key `dev-key`. Then start the app with `VITE_TEST_HOST=1 npm run dev`. A red **Test image host** badge in the status bar marks this mode. Images published to the test host are **not** visible to real recipients.

Text-only signatures need no hosting.

### Public editor preview

The 3.0 preview is published at **[Signature Studio](https://moderngentlemen-sudo.github.io/signature-studio/)** using GitHub Pages. Projects stay in each visitor's browser; sharing this address shares the editor. Use project export/import to move a design between browsers or people. Images in installed email signatures still need the public image host described above.

To update the preview, commit and push the source branch, then run `npm run deploy:preview` with your GitHub login available to Git. The command checks the source revision, builds with relative asset URLs, and publishes only the static build to `gh-pages` using a regular push. It rejects the local test image host and refuses to replace an unrelated Pages deployment. `/version.json` records the published source revision. GitHub Pages must be configured to publish from `gh-pages`, directory `/`; publication may take a few minutes.

## Test

```sh
npm test               # unit tests (Vitest): model, renderer, validator, templates, history
npm run e2e            # end-to-end tests (Playwright): starts the app plus the test image host
npm run typecheck
npm run build
```

## Project layout

```
src/
  model/       document schema, tree operations, profile, fonts, social platforms, presets, migration
  render/      renderSignature (edit / preview / email), email-HTML validator, icons and QR codes
  publish/     derive → hash → publish → verify pipeline, host adapter
  templates/   template library, safe template application, starter projects
  state/       editor store (undo/redo), projects and autosave, assets, preferences
  storage/     IndexedDB repositories
  editor/      canvas, inspector, panels, dialogs, drag and drop, shortcuts, design assistance
  ui/          shared controls
worker/        Cloudflare Worker + R2 image host
scripts/       local test image host
tests/e2e/     Playwright specs
docs/          proposal, decisions, acceptance protocol, implementation report
```

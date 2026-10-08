# Signature Studio image host

A tiny Cloudflare Worker in front of an R2 bucket. It publishes email-ready signature images at permanent, public, content-addressed URLs.

## Why this design

* **It never pauses.** R2 and Workers have no inactivity pausing, so signatures already sent keep their images.
* **Immutable URLs.** `https://img.your-domain.com/s/<sha256>.png` never changes. Because the URL is served from your own domain, the storage behind it can be swapped later without breaking any signature.
* **No personal data in paths.** Object keys are hashes of the image bytes.
* **Hardened uploads:**
  * a bearer key is required;
  * only PNG, JPEG and GIF are accepted, checked by magic bytes;
  * uploads are limited to 1 MB;
  * the body must hash to its key;
  * nothing is ever overwritten.
* **No SSRF.** The Worker never fetches remote URLs.
* **Cheap.** R2 charges no egress fees, and a signature image is typically 5–40 KB.

## Deploy

```sh
cd worker
npm i -g wrangler
wrangler r2 bucket create signature-studio-images
wrangler secret put UPLOAD_KEY          # generate with: openssl rand -hex 32
# edit wrangler.toml: ALLOWED_ORIGINS and (recommended) a custom domain route
wrangler deploy
```

Then, in Signature Studio, open **Settings** (gear icon) and set:
* **Image host address**: `https://img.your-domain.com`
* **Upload key**: the `UPLOAD_KEY` you generated

Alternatively, set `VITE_ASSET_HOST` at build time so the address is pre-filled. Never put the upload key in a build variable.

## Before accounts exist

The upload key is a single shared secret for one workspace, such as Modern Gentlemen's own deployment. Once accounts exist (Phase 5), uploads will require a signed-in session token instead and the shared key will be retired.

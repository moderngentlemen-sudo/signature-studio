/**
 * Signature Studio image host — Cloudflare Worker + R2.
 *
 *   PUT  /s/<sha256>.<png|jpg|gif>   upload (Authorization: Bearer <UPLOAD_KEY>)
 *   GET  /s/<sha256>.<ext>           public, immutable, CORS-enabled
 *   HEAD /s/<sha256>.<ext>
 *
 * Guarantees:
 *  - Keys are content hashes: the body must hash to the key, so objects are
 *    immutable and deduplicated, and paths carry no personal data.
 *  - Only PNG / JPEG / GIF (verified by magic bytes), max 1 MB.
 *  - The Worker never fetches remote URLs (no SSRF surface).
 *  - Nothing is ever deleted or overwritten by uploads.
 */

export interface Env {
  IMAGES: R2Bucket;
  UPLOAD_KEY: string;
  /** Comma-separated origins allowed to upload (e.g. https://studio.example.com). */
  ALLOWED_ORIGINS?: string;
}

const MAX_BYTES = 1024 * 1024;
const PATH = /^\/s\/([0-9a-f]{64})\.(png|jpg|gif)$/;
const MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", gif: "image/gif" };

function sniff(bytes: Uint8Array): string | null {
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (bytes.length > 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return "gif";
  return null;
}

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function cors(req: Request, env: Env, write = false): Record<string, string> {
  if (!write) return { "Access-Control-Allow-Origin": "*" };
  const origin = req.headers.get("Origin") ?? "";
  const allowed = (env.ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return {
    "Access-Control-Allow-Origin": allowed.includes(origin) ? origin : allowed[0] ?? "null",
    "Access-Control-Allow-Methods": "GET, HEAD, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const m = PATH.exec(url.pathname);

    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req, env, true) });
    if (!m) return new Response("Not found", { status: 404 });
    const [, hash, ext] = m;
    const key = `s/${hash}.${ext}`;

    if (req.method === "GET" || req.method === "HEAD") {
      const obj = await env.IMAGES.get(key);
      if (!obj) return new Response("Not found", { status: 404, headers: cors(req, env) });
      const headers = {
        ...cors(req, env),
        "Content-Type": MIME[ext],
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'",
        ETag: `"${hash}"`,
      };
      return new Response(req.method === "HEAD" ? null : obj.body, { headers });
    }

    if (req.method !== "PUT") return new Response("Method not allowed", { status: 405 });
    const auth = req.headers.get("Authorization") ?? "";
    if (!env.UPLOAD_KEY || !timingSafeEqual(auth, `Bearer ${env.UPLOAD_KEY}`)) {
      return new Response("Unauthorized", { status: 401, headers: cors(req, env, true) });
    }
    const len = Number(req.headers.get("Content-Length") ?? "0");
    if (len > MAX_BYTES) return new Response("Too large", { status: 413, headers: cors(req, env, true) });
    const buf = await req.arrayBuffer();
    if (buf.byteLength === 0 || buf.byteLength > MAX_BYTES) return new Response("Bad size", { status: 413, headers: cors(req, env, true) });
    const kind = sniff(new Uint8Array(buf, 0, Math.min(16, buf.byteLength)));
    if (kind !== ext) return new Response("Unsupported or mismatched image type", { status: 415, headers: cors(req, env, true) });
    if ((await sha256Hex(buf)) !== hash) return new Response("Hash mismatch", { status: 422, headers: cors(req, env, true) });

    const publicUrl = `${url.origin}/${key}`;
    const existing = await env.IMAGES.head(key);
    if (!existing) await env.IMAGES.put(key, buf, { httpMetadata: { contentType: MIME[ext], cacheControl: "public, max-age=31536000, immutable" } });
    return Response.json({ url: publicUrl, existed: !!existing }, { status: existing ? 200 : 201, headers: cors(req, env, true) });
  },
};

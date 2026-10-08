// Local test image host implementing the same API as worker/.
// Serves http://localhost:8787 — NOT public. Signature Studio only accepts
// it when built with VITE_TEST_HOST=1 and labels everything "test only".
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DIR = join(process.cwd(), ".dev-host");
const PORT = Number(process.env.PORT ?? 8787);
const KEY = process.env.UPLOAD_KEY ?? "dev-key";
mkdirSync(DIR, { recursive: true });
const PATH = /^\/s\/([0-9a-f]{64})\.(png|jpg|gif)$/;
const MIME = { png: "image/png", jpg: "image/jpeg", gif: "image/gif" };
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, HEAD, PUT, OPTIONS", "Access-Control-Allow-Headers": "Authorization, Content-Type" };

createServer((req, res) => {
  const m = PATH.exec(new URL(req.url, "http://x").pathname);
  if (req.method === "OPTIONS") return res.writeHead(204, CORS).end();
  if (!m) return res.writeHead(404, CORS).end("Not found");
  const [, hash, ext] = m;
  const file = join(DIR, `${hash}.${ext}`);
  if (req.method === "GET" || req.method === "HEAD") {
    if (!existsSync(file)) return res.writeHead(404, CORS).end();
    res.writeHead(200, { ...CORS, "Content-Type": MIME[ext], "Cache-Control": "public, max-age=31536000, immutable" });
    return res.end(req.method === "HEAD" ? undefined : readFileSync(file));
  }
  if (req.method !== "PUT") return res.writeHead(405, CORS).end();
  if (req.headers.authorization !== `Bearer ${KEY}`) return res.writeHead(401, CORS).end("Unauthorized");
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    const buf = Buffer.concat(chunks);
    if (createHash("sha256").update(buf).digest("hex") !== hash) return res.writeHead(422, CORS).end("Hash mismatch");
    writeFileSync(file, buf);
    res.writeHead(201, { ...CORS, "Content-Type": "application/json" }).end(JSON.stringify({ url: `http://localhost:${PORT}/s/${hash}.${ext}` }));
  });
}).listen(PORT, () => console.log(`Test image host on http://localhost:${PORT} (upload key: ${KEY})`));

/**
 * Image ingestion and in-memory object URLs for asset sources.
 *
 * Uploads are validated (type, size, decodability), SVGs are rasterised so
 * user SVG markup is never rendered, and very large images are downscaled
 * so they cannot degrade the editor.
 */
import { uid } from "../lib/id";
import { sha256Hex } from "../lib/hash";
import type { AssetMeta } from "../model/types";
import { assetStore } from "../storage/db";

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const MAX_EDGE = 2400;
const ACCEPTED = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"];
export const ACCEPT_ATTR = ACCEPTED.join(",");

const urls = new Map<string, string>();
const listeners = new Set<() => void>();

export function sourceUrl(assetId: string): string | null {
  return urls.get(assetId) ?? null;
}

export function onSourcesChange(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function register(id: string, blob: Blob) {
  const prev = urls.get(id);
  if (prev) URL.revokeObjectURL(prev);
  urls.set(id, URL.createObjectURL(blob));
  listeners.forEach((fn) => fn());
}

/** Ensure object URLs exist for the given asset ids (after loading a project). */
export async function hydrateSources(ids: string[]): Promise<string[]> {
  const missing: string[] = [];
  await Promise.all(
    ids.map(async (id) => {
      if (urls.has(id) || id.startsWith("builtin:")) return;
      const blob = await assetStore.get(id);
      if (blob) register(id, blob);
      else missing.push(id);
    }),
  );
  return missing;
}

export class UploadError extends Error {}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new UploadError("This image couldn't be read. It may be damaged or in an unsupported format."));
    img.src = src;
  });
}

async function rasterize(img: HTMLImageElement, w: number, h: number, mime: string): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, w, h);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new UploadError("Couldn't process this image."))), mime, 0.92));
}

/** Validate and store an uploaded file. Returns its asset metadata. */
export async function ingestFile(file: File | Blob, name = "image"): Promise<AssetMeta> {
  const type = file.type || "";
  if (!ACCEPTED.includes(type)) throw new UploadError("Please use a PNG, JPEG, WebP, GIF or SVG image.");
  if (file.size > MAX_UPLOAD_BYTES) throw new UploadError("That image is larger than 15 MB. Please use a smaller file.");
  const tempUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(tempUrl);
    let w = img.naturalWidth;
    let h = img.naturalHeight;
    if (type === "image/svg+xml" && (!w || !h)) {
      w = 1200;
      h = 1200;
    }
    if (!w || !h) throw new UploadError("This image has no dimensions.");
    let blob: Blob = file;
    let mime = type;
    const longEdge = Math.max(w, h);
    if (type === "image/svg+xml" || longEdge > MAX_EDGE || type === "image/gif" || type === "image/webp") {
      // SVGs and oversized/animated images become a safe, bounded PNG/JPEG.
      const scale = Math.min(1, (type === "image/svg+xml" ? 1600 : MAX_EDGE) / longEdge);
      w = Math.max(1, Math.round(w * scale));
      h = Math.max(1, Math.round(h * scale));
      mime = type === "image/jpeg" ? "image/jpeg" : "image/png";
      blob = await rasterize(img, w, h, mime);
    }
    const hash = await sha256Hex(blob);
    const id = uid("a");
    await assetStore.put(id, blob);
    register(id, blob);
    return { id, name: (file as File).name ?? name, mime, width: w, height: h, bytes: blob.size, hash, createdAt: Date.now() };
  } finally {
    URL.revokeObjectURL(tempUrl);
  }
}

/** Restore an asset from a data URL (project import). */
export async function ingestDataUrl(id: string, dataUrl: string): Promise<void> {
  const blob = await (await fetch(dataUrl)).blob();
  await assetStore.put(id, blob);
  register(id, blob);
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Dominant colours of an image, for brand-palette extraction. */
export async function extractColors(assetId: string, count = 5): Promise<string[]> {
  const src = sourceUrl(assetId);
  if (!src) return [];
  const img = await loadImage(src);
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, size, size);
  const data = ctx.getImageData(0, 0, size, size).data;
  const buckets = new Map<string, { r: number; g: number; b: number; pixels: number; score: number }>();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // Skip near-white backgrounds.
    if (Math.min(r, g, b) > 235) continue;
    const key = `${r >> 5},${g >> 5},${b >> 5}`;
    const e = buckets.get(key) ?? { r: 0, g: 0, b: 0, pixels: 0, score: 0 };
    e.r += r;
    e.g += g;
    e.b += b;
    e.pixels += 1;
    // Favour saturated colours slightly over greys.
    e.score += 1 + (Math.max(r, g, b) - Math.min(r, g, b)) / 64;
    buckets.set(key, e);
  }
  const hex = (v: number) => Math.round(v).toString(16).padStart(2, "0");
  return [...buckets.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map((e) => `#${hex(e.r / e.pixels)}${hex(e.g / e.pixels)}${hex(e.b / e.pixels)}`);
}

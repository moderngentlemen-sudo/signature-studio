/**
 * Produce the exact image bytes a recipient will download: crop, zoom,
 * shape, corner radius and tint are baked into a 2× PNG/JPEG so the result
 * looks identical in Gmail, Outlook and Apple Mail.
 */
import { BUILTINS } from "../model/builtins";
import type { ImageRequest } from "../render/email";
import { qrSvg, socialIconSvg, svgDataUrl } from "../render/icons";
import { sourceUrl } from "../state/assets";

export const DENSITY = 2;

export interface Derivative {
  blob: Blob;
  mime: "image/png" | "image/jpeg";
  ext: "png" | "jpg";
  width: number;
  height: number;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("The source image could not be loaded."));
    img.src = src;
  });
}

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  return { c, ctx };
}

function toBlob(c: HTMLCanvasElement, mime: Derivative["mime"]): Promise<Blob> {
  return new Promise((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't encode the image."))), mime, mime === "image/jpeg" ? 0.9 : undefined),
  );
}

function clipShape(ctx: CanvasRenderingContext2D, w: number, h: number, shape: string, radius: number) {
  ctx.beginPath();
  if (shape === "circle") ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  else if (shape === "rounded") ctx.roundRect(0, 0, w, h, radius);
  else ctx.rect(0, 0, w, h);
  ctx.clip();
}

export async function deriveImage(req: ImageRequest, mimeOf: (assetId: string) => string | undefined): Promise<Derivative> {
  if (req.kind === "asset" || (req.kind === "icon" && req.assetId)) {
    const assetId = req.assetId!;
    const src = BUILTINS[assetId]?.url ?? sourceUrl(assetId);
    if (!src) throw new Error("The original image is missing from this browser. Re-upload it.");
    const img = await loadImage(src);
    const isIcon = req.kind === "icon";
    const w = (isIcon ? req.size : req.width) * DENSITY;
    const h = (isIcon ? req.size : req.height) * DENSITY;
    const { c, ctx } = canvas(w, h);
    const shape = isIcon ? "circle" : req.shape;
    clipShape(ctx, w, h, shape, (isIcon ? 0 : req.radius) * DENSITY);
    const nat = { w: img.naturalWidth || BUILTINS[assetId]?.width || w, h: img.naturalHeight || BUILTINS[assetId]?.height || h };
    if (req.kind === "asset") {
      // crop rect is in the asset's recorded natural size; rescale if the
      // decoded image differs (e.g. SVG intrinsic size).
      const meta = BUILTINS[assetId];
      const kx = meta ? nat.w / meta.width : 1;
      const ky = meta ? nat.h / meta.height : 1;
      ctx.drawImage(img, req.crop.sx * kx, req.crop.sy * ky, req.crop.sw * kx, req.crop.sh * ky, 0, 0, w, h);
      if (req.tint) {
        ctx.globalCompositeOperation = "source-in";
        ctx.fillStyle = req.tint;
        ctx.fillRect(0, 0, w, h);
      }
    } else {
      const side = Math.min(nat.w, nat.h);
      ctx.drawImage(img, (nat.w - side) / 2, (nat.h - side) / 2, side, side, 0, 0, w, h);
    }
    const photo = req.kind === "asset" && req.shape === "rect" && !req.tint && mimeOf(assetId) === "image/jpeg";
    const mime = photo ? "image/jpeg" : "image/png";
    return { blob: await toBlob(c, mime), mime, ext: photo ? "jpg" : "png", width: w / DENSITY, height: h / DENSITY };
  }
  const size = req.size * DENSITY;
  const svg = req.kind === "icon" ? socialIconSvg(req.platform, req.style, size, req.color, req.background) : qrSvg(req.value, size, req.color, req.background);
  const img = await loadImage(svgDataUrl(svg));
  const { c, ctx } = canvas(size, size);
  if (req.kind === "qr") ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, size, size);
  return { blob: await toBlob(c, "image/png"), mime: "image/png", ext: "png", width: req.size, height: req.size };
}

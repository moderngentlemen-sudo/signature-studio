import type { ImageCrop } from "./types";

export interface Rect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

/**
 * Source rectangle for a "cover" crop of a natural image into a frame with
 * the given aspect ratio, with zoom (≥1) and pan (-1..1 on each axis).
 * Shared by the editor preview (CSS) and the publish pipeline (canvas) so the
 * two always agree.
 */
export function cropRect(naturalW: number, naturalH: number, frameAspect: number, crop: ImageCrop): Rect {
  const zoom = Math.max(1, crop.zoom || 1);
  const natAspect = naturalW / naturalH;
  let sw: number;
  let sh: number;
  if (natAspect > frameAspect) {
    sh = naturalH;
    sw = sh * frameAspect;
  } else {
    sw = naturalW;
    sh = sw / frameAspect;
  }
  sw /= zoom;
  sh /= zoom;
  const maxX = (naturalW - sw) / 2;
  const maxY = (naturalH - sh) / 2;
  const px = Math.max(-1, Math.min(1, crop.x || 0));
  const py = Math.max(-1, Math.min(1, crop.y || 0));
  return { sx: maxX + px * maxX, sy: maxY + py * maxY, sw, sh };
}

/** Frame size in display px for an image node. */
export function frameSize(width: number, aspect: number | undefined, naturalW: number, naturalH: number) {
  const a = aspect ?? naturalW / naturalH;
  return { w: Math.round(width), h: Math.max(1, Math.round(width / a)), aspect: a };
}

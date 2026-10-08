import qrcode from "qrcode-generator";
import { ICON_PATHS } from "../model/iconPaths";
import { PLATFORM_MAP } from "../model/social";
import type { SocialIconStyle, SocialPlatform } from "../model/types";
import { esc } from "../lib/escape";

/**
 * SVG for a social icon in a given style. Used directly (as a data URL) on
 * the editor canvas, and rasterised to PNG by the publish pipeline.
 */
export function socialIconSvg(platform: SocialPlatform, style: Exclude<SocialIconStyle, "text">, size: number, color: string, background: string): string {
  const path = ICON_PATHS[platform] ?? ICON_PATHS.custom;
  const s = size;
  const open = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 24 24">`;
  const glyph = (scale: number) => {
    const offset = (24 - 24 * scale) / 2;
    return `<path transform="translate(${offset} ${offset}) scale(${scale})" fill="${esc(color)}" d="${path}"/>`;
  };
  switch (style) {
    case "bare":
      return `${open}${glyph(1)}</svg>`;
    case "circle":
      return `${open}<circle cx="12" cy="12" r="12" fill="${esc(background)}"/>${glyph(0.5)}</svg>`;
    case "outline":
      return `${open}<circle cx="12" cy="12" r="11.1" fill="none" stroke="${esc(color)}" stroke-width="1.3"/>${glyph(0.48)}</svg>`;
    case "tile":
      return `${open}<rect width="24" height="24" rx="5" fill="${esc(background)}"/>${glyph(0.54)}</svg>`;
    case "letter": {
      const letter = PLATFORM_MAP[platform]?.letter ?? "•";
      return `${open}<circle cx="12" cy="12" r="12" fill="${esc(background)}"/><text x="12" y="12" dy=".36em" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="${letter.length > 1 ? 9 : 11}" fill="${esc(color)}">${esc(letter)}</text></svg>`;
    }
  }
}

export interface QrMatrix {
  count: number;
  dark: (r: number, c: number) => boolean;
}

export function qrMatrix(value: string): QrMatrix {
  const qr = qrcode(0, "M");
  qr.addData(value || " ");
  qr.make();
  return { count: qr.getModuleCount(), dark: (r, c) => qr.isDark(r, c) };
}

/** QR code as an SVG with a 2-module quiet zone. */
export function qrSvg(value: string, size: number, color: string, background: string): string {
  const m = qrMatrix(value);
  const quiet = 2;
  const n = m.count + quiet * 2;
  let d = "";
  for (let r = 0; r < m.count; r++) for (let c = 0; c < m.count; c++) if (m.dark(r, c)) d += `M${c + quiet} ${r + quiet}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="${esc(background)}"/><path fill="${esc(color)}" d="${d}"/></svg>`;
}

export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

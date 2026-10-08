/**
 * Design assistance: Auto-Fit, compact Reply preset and design checks.
 */
import { walk } from "../model/tree";
import { fontDef } from "../model/fonts";
import { resolveColor, resolveFont } from "../render/email";
import type { Project, SigNode, StackNode, Theme } from "../model/types";
import { useEditor } from "../state/store";

/** Smallest legible size (px) Auto-Fit will allow. */
export const MIN_READABLE = 10;

function smallestFont(project: Project): number {
  let min = project.theme.size;
  walk(project.root, ({ node }) => {
    if (node.text?.size) min = Math.min(min, node.text.size);
  });
  return min;
}

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

/**
 * Scale the whole signature so its rendered width fits the target width,
 * never letting the smallest text drop below MIN_READABLE px.
 */
export async function autoFit(): Promise<{ ok: boolean; message: string }> {
  const st = useEditor.getState();
  const project = st.project;
  if (!project) return { ok: false, message: "" };
  const target = project.theme.width;
  const floor = MIN_READABLE / smallestFont(project);
  st.beginGesture();
  let scale = project.theme.scale;
  for (let i = 0; i < 4; i++) {
    const measured = useEditor.getState().measuredWidth;
    if (!measured) break;
    const natural = measured / scale;
    let next = Math.min(1, target / natural);
    next = Math.floor(next * 100) / 100;
    if (next < floor) next = Math.ceil(floor * 100) / 100;
    if (Math.abs(next - scale) < 0.005) break;
    scale = next;
    useEditor.getState().editLive((d) => void (d.theme.scale = next));
    await nextFrame();
  }
  useEditor.getState().endGesture();
  const measured = useEditor.getState().measuredWidth;
  if (measured > target + 1) {
    return {
      ok: false,
      message: `Scaled to ${Math.round(scale * 100)}%, the smallest size that keeps text readable. It is still ${Math.round(measured - target)}px wider than the target. Try stacking columns or removing a contact item.`,
    };
  }
  return { ok: true, message: scale < 1 ? `Scaled to ${Math.round(scale * 100)}% to fit ${target}px.` : `Fits ${target}px at full size.` };
}

/**
 * Compact Reply preset: marks secondary components as Full-only. Every change
 * is an explicit, visible visibility setting (and one undo step).
 */
export function applyCompactReply(): number {
  let changed = 0;
  useEditor.getState().edit((d) => {
    walk(d.root as StackNode, ({ node }) => {
      if (node.visibility !== "both") return;
      const secondary =
        (node.type === "image" && (node.props.role === "banner" || node.props.role === "partner" || node.props.role === "artwork")) ||
        node.type === "social" ||
        node.type === "qr" ||
        node.type === "button" ||
        (node.type === "text" && (node.name === "Disclaimer" || (node.box?.background && node.props.text.length > 20))) ||
        (node.type === "field" && ["tagline", "intro", "address", "department", "booking"].includes(node.props.field));
      if (secondary) {
        node.visibility = "full";
        changed++;
      }
    });
  });
  return changed;
}

// --- Design checks ---------------------------------------------------------------

export interface Check {
  level: "warning" | "info";
  nodeId?: string;
  message: string;
}

function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return 1;
  const n = parseInt(m[1], 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

export function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

export function designChecks(project: Project, measuredWidth: number): Check[] {
  const checks: Check[] = [];
  const theme: Theme = project.theme;
  const bg = theme.background && theme.background !== "transparent" ? resolveColor(theme, theme.background) : "#ffffff";
  if (measuredWidth > theme.width + 1)
    checks.push({ level: "warning", message: `The signature is ${Math.round(measuredWidth)}px wide, more than the ${theme.width}px target. Try Auto-Fit.` });
  const fonts = new Set<string>([theme.fonts.display, theme.fonts.body]);
  walk(project.root, ({ node }) => {
    if (node.text?.font) fonts.add(resolveFont(theme, node.text.font));
    checkNode(node);
  });
  for (const f of fonts) {
    const def = fontDef(f);
    if (!def.safe) checks.push({ level: "info", message: `${def.label} is a web font. Most recipients will see ${def.seenAs}.` });
  }
  return checks;

  function checkNode(node: SigNode) {
    const size = (node.text?.size ?? theme.size) * theme.scale;
    if ((node.type === "field" || node.type === "text" || node.type === "contact") && size < MIN_READABLE)
      checks.push({ level: "warning", nodeId: node.id, message: `Some text is ${size.toFixed(1)}px, which is hard to read on phones.` });
    if (node.text?.color) {
      const fg = resolveColor(theme, node.text.color);
      const local = node.box?.background ? resolveColor(theme, node.box.background) : bg;
      const ratio = contrast(fg, local);
      if (ratio < 2) checks.push({ level: "warning", nodeId: node.id, message: "Very low text contrast. It may be unreadable." });
      else if (ratio < 3) checks.push({ level: "info", nodeId: node.id, message: "Some accent text has modest contrast; keep it short or large." });
    }
    if (node.type === "image" && node.props.assetId && !node.props.alt.trim())
      checks.push({ level: "warning", nodeId: node.id, message: "An image is missing alternative text." });
  }
}

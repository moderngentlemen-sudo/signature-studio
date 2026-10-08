/**
 * Pointer-based drag and drop shared by the component library, canvas and
 * layers panel. Surfaces register resolvers that map a pointer position to
 * a drop target plus a visual indicator; the first resolver that claims the
 * point wins.
 */
import { create } from "zustand";
import type { SigNode } from "../model/types";
import { insertNode, moveTo, type DropTarget } from "./actions";

export type DragSource = { kind: "new"; create: () => SigNode } | { kind: "move"; nodeId: string };

export interface Indicator {
  surface: "canvas" | "layers";
  /** For canvas: stage-relative unscaled px. For layers: row id + position. */
  line?: { x: number; y: number; length: number; vertical?: boolean };
  into?: { x: number; y: number; w: number; h: number };
  layer?: { id: string; pos: "before" | "after" | "into" };
}

export interface Resolution {
  target: DropTarget;
  indicator: Indicator;
}

export type Resolver = (clientX: number, clientY: number, source: DragSource) => Resolution | null;

interface DragState {
  source: DragSource | null;
  label: string;
  x: number;
  y: number;
  resolution: Resolution | null;
}

export const useDrag = create<DragState>(() => ({ source: null, label: "", x: 0, y: 0, resolution: null }));

const resolvers = new Set<Resolver>();

export function registerResolver(r: Resolver) {
  resolvers.add(r);
  return () => void resolvers.delete(r);
}

function resolve(x: number, y: number, source: DragSource): Resolution | null {
  for (const r of resolvers) {
    const res = r(x, y, source);
    if (res) return res;
  }
  return null;
}

const THRESHOLD = 4;

/**
 * Begin tracking a potential drag from a pointerdown. The drag only starts
 * after the pointer moves a few pixels, so plain clicks still work.
 */
export function armDrag(e: PointerEvent | React.PointerEvent, source: DragSource, label: string, onClick?: () => void) {
  const startX = e.clientX;
  const startY = e.clientY;
  let started = false;
  const move = (ev: PointerEvent) => {
    if (!started) {
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < THRESHOLD) return;
      started = true;
      document.body.classList.add("ss-dragging");
      window.getSelection()?.removeAllRanges();
      useDrag.setState({ source, label });
    }
    ev.preventDefault();
    useDrag.setState({ x: ev.clientX, y: ev.clientY, resolution: resolve(ev.clientX, ev.clientY, source) });
  };
  const end = (ev: PointerEvent) => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", end);
    window.removeEventListener("keydown", key);
    document.body.classList.remove("ss-dragging");
    if (!started) {
      onClick?.();
      return;
    }
    const res = ev.type === "pointerup" ? resolve(ev.clientX, ev.clientY, source) : null;
    useDrag.setState({ source: null, resolution: null });
    if (!res) return;
    if (source.kind === "new") insertNode(source.create(), res.target);
    else moveTo(source.nodeId, res.target);
  };
  const key = (ev: KeyboardEvent) => {
    if (ev.key === "Escape") {
      started = true;
      end(new PointerEvent("pointercancel"));
      useDrag.setState({ source: null, resolution: null });
    }
  };
  window.addEventListener("pointermove", move, { passive: false });
  window.addEventListener("pointerup", end);
  window.addEventListener("keydown", key);
}

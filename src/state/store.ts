/**
 * Editor store. A single Zustand store holds the open project plus editor UI
 * state. Every document change goes through `edit` (coalescing, undoable) or
 * a gesture (`beginGesture` → `editLive`* → `endGesture`), so a drag, resize
 * or slider scrub is one undo step.
 */
import { create } from "zustand";
import { produce, type Draft } from "immer";
import type { Project, Variant } from "../model/types";

const HISTORY_LIMIT = 200;
const COALESCE_MS = 900;

export type LeftPanel = "templates" | "add" | "layers" | "profile" | "brand" | "assets";
export type Dialog = null | "install" | "export" | "projects" | "shortcuts" | "image" | "versions" | "settings" | "applyTemplate";

export interface Toast {
  id: number;
  message: string;
  tone: "info" | "success" | "error";
  action?: { label: string; run: () => void };
}

export interface EditorState {
  project: Project | null;
  selection: string | null;
  hover: string | null;
  editingText: string | null;
  variant: Variant;
  compare: boolean;
  mode: "simple" | "advanced";
  zoom: number;
  preview: boolean;
  ghosts: boolean;
  fallbackFonts: boolean;
  grid: boolean;
  leftPanel: LeftPanel;
  mobileSheet: "left" | "right" | null;
  dialog: Dialog;
  dialogArg: string | null;
  past: Project[];
  future: Project[];
  lastKey: string | null;
  lastTime: number;
  gestureBase: Project | null;
  saveState: "saved" | "saving" | "unsaved" | "error";
  toasts: Toast[];
  /** Measured natural width of the rendered signature (px, unscaled by zoom). */
  measuredWidth: number;

  load(project: Project): void;
  edit(recipe: (draft: Draft<Project>) => void, key?: string): void;
  beginGesture(): void;
  editLive(recipe: (draft: Draft<Project>) => void): void;
  endGesture(): void;
  cancelGesture(): void;
  undo(): void;
  redo(): void;
  select(id: string | null): void;
  set(partial: Partial<EditorState>): void;
  openDialog(dialog: Dialog, arg?: string | null): void;
  toast(message: string, tone?: Toast["tone"], action?: Toast["action"]): void;
  dismissToast(id: number): void;
}

let toastSeq = 0;

export const useEditor = create<EditorState>((set, get) => ({
  project: null,
  selection: null,
  hover: null,
  editingText: null,
  variant: "full",
  compare: false,
  mode: "simple",
  zoom: 1,
  preview: false,
  ghosts: true,
  fallbackFonts: false,
  grid: false,
  leftPanel: "templates",
  mobileSheet: null,
  dialog: null,
  dialogArg: null,
  past: [],
  future: [],
  lastKey: null,
  lastTime: 0,
  gestureBase: null,
  saveState: "saved",
  toasts: [],
  measuredWidth: 0,

  load(project) {
    set({ project, selection: null, hover: null, past: [], future: [], lastKey: null, gestureBase: null, saveState: "saved" });
  },

  edit(recipe, key) {
    const { project, past, lastKey, lastTime } = get();
    if (!project) return;
    const next = produce(project, recipe);
    if (next === project) return;
    const now = Date.now();
    const coalesce = !!key && key === lastKey && now - lastTime < COALESCE_MS;
    set({
      project: next,
      past: coalesce ? past : [...past.slice(-HISTORY_LIMIT + 1), project],
      future: [],
      lastKey: key ?? null,
      lastTime: now,
      saveState: "unsaved",
    });
  },

  beginGesture() {
    const { project } = get();
    if (project) set({ gestureBase: project });
  },

  editLive(recipe) {
    const { project } = get();
    if (!project) return;
    const next = produce(project, recipe);
    if (next !== project) set({ project: next, saveState: "unsaved" });
  },

  endGesture() {
    const { gestureBase, project, past } = get();
    if (!gestureBase || !project) return set({ gestureBase: null });
    if (gestureBase === project) return set({ gestureBase: null });
    set({ gestureBase: null, past: [...past.slice(-HISTORY_LIMIT + 1), gestureBase], future: [], lastKey: null });
  },

  cancelGesture() {
    const { gestureBase } = get();
    if (gestureBase) set({ project: gestureBase, gestureBase: null });
  },

  undo() {
    const { past, future, project } = get();
    if (!past.length || !project) return;
    // The verified-image cache is not part of design history.
    const prev = { ...past[past.length - 1], published: project.published };
    set({ project: prev, past: past.slice(0, -1), future: [project, ...future], lastKey: null, saveState: "unsaved" });
    const sel = get().selection;
    if (sel && !JSON.stringify(prev.root).includes(`"${sel}"`)) set({ selection: null });
  },

  redo() {
    const { past, future, project } = get();
    if (!future.length || !project) return;
    const next = { ...future[0], published: project.published };
    set({ project: next, past: [...past, project], future: future.slice(1), lastKey: null, saveState: "unsaved" });
  },

  select(id) {
    if (get().selection !== id) set({ selection: id, editingText: null });
  },

  set(partial) {
    set(partial);
  },

  openDialog(dialog, arg = null) {
    set({ dialog, dialogArg: arg });
  },

  toast(message, tone = "info", action) {
    const id = ++toastSeq;
    set({ toasts: [...get().toasts.slice(-2), { id, message, tone, action }] });
    setTimeout(() => get().dismissToast(id), action ? 7000 : 3800);
  },

  dismissToast(id) {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },
}));

/** Convenience: edit outside React components. */
export const edit = (recipe: (draft: Draft<Project>) => void, key?: string) => useEditor.getState().edit(recipe, key);

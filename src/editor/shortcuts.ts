import { useEffect } from "react";
import { useEditor } from "../state/store";
import { findNode } from "../model/tree";
import { duplicateSelected, groupSelected, nudgeOrder, removeSelected, selectParent, toggleLock, ungroupSelected } from "./actions";

function isTyping(e: KeyboardEvent): boolean {
  const el = (e.composedPath()[0] ?? e.target) as HTMLElement;
  if (!el || !el.tagName) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

/** Global keyboard shortcuts consistent with professional design tools. */
export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = useEditor.getState();
      if (!st.project) return;
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      const dialogOpen = !!st.dialog;

      if (mod && k === "z" && !isTyping(e)) {
        e.preventDefault();
        if (e.shiftKey) st.redo();
        else st.undo();
        return;
      }
      if (mod && k === "y" && !isTyping(e)) {
        e.preventDefault();
        st.redo();
        return;
      }
      if (dialogOpen || isTyping(e)) return;

      if (mod && (k === "=" || k === "+")) {
        e.preventDefault();
        st.set({ zoom: Math.min(4, Math.round(st.zoom * 1.2 * 100) / 100) });
        return;
      }
      if (mod && k === "-") {
        e.preventDefault();
        st.set({ zoom: Math.max(0.25, Math.round((st.zoom / 1.2) * 100) / 100) });
        return;
      }
      if (e.shiftKey && (e.key === "!" || e.code === "Digit1")) {
        e.preventDefault();
        window.dispatchEvent(new Event("ss:fit"));
        return;
      }
      if (mod && k === "d") {
        e.preventDefault();
        duplicateSelected();
        return;
      }
      if (mod && k === "g") {
        e.preventDefault();
        if (e.shiftKey) ungroupSelected();
        else groupSelected();
        return;
      }
      if (mod && k === "l") {
        e.preventDefault();
        if (st.selection) toggleLock(st.selection);
        return;
      }
      if (mod) return;

      if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
        e.preventDefault();
        nudgeOrder(e.key === "ArrowUp" ? -1 : 1);
        return;
      }
      switch (e.key) {
        case "Backspace":
        case "Delete":
          if (st.selection) {
            e.preventDefault();
            removeSelected();
          }
          break;
        case "Escape":
          if (st.preview) st.set({ preview: false });
          else selectParent();
          break;
        case "Enter": {
          const node = st.selection ? findNode(st.project.root, st.selection) : null;
          if (!node) break;
          const host = document.querySelector<HTMLElement>("[data-testid=stage] .stage-host");
          const span = host?.shadowRoot?.querySelector<HTMLElement>(`[data-ss-text="${CSS.escape(node.id)}"]`);
          if (span) {
            e.preventDefault();
            span.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, composed: true }));
          }
          break;
        }
        case "r":
        case "R":
          st.set({ variant: st.variant === "full" ? "reply" : "full", compare: false });
          break;
        case "p":
        case "P":
          st.set({ preview: !st.preview, selection: null });
          break;
        case "?":
          st.openDialog("shortcuts");
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

/**
 * Editor commands shared by the canvas, layers panel, toolbar and keyboard
 * shortcuts. Each command is one undoable step.
 */
import { column, row } from "../model/factory";
import { canContain, cloneWithNewIds, duplicateNode, findNode, groupNode, isContainer, locate, moveNode, removeNode, ungroupNode } from "../model/tree";
import type { SigNode, StackNode, Visibility } from "../model/types";
import { useEditor } from "../state/store";

export type DropTarget =
  | { kind: "insert"; parentId: string; index: number }
  /** Place beside a leaf: wrap it and the new node in two columns. */
  | { kind: "beside"; targetId: string; side: "left" | "right" };

const st = () => useEditor.getState();

/** Where a click-inserted component should go, given the selection. */
export function defaultInsertTarget(): DropTarget {
  const { project, selection } = st();
  const root = project!.root;
  if (selection) {
    const loc = locate(root, selection);
    if (loc) {
      if ((loc.node.type === "stack" || loc.node.type === "column") && loc.node.id !== root.id)
        return { kind: "insert", parentId: loc.node.id, index: loc.node.children.length };
      if (loc.parent && loc.parent.type !== "row") return { kind: "insert", parentId: loc.parent.id, index: loc.index + 1 };
      if (loc.parent && loc.parent.type === "row") {
        const rowLoc = locate(root, loc.parent.id);
        if (rowLoc?.parent) return { kind: "insert", parentId: rowLoc.parent.id, index: rowLoc.index + 1 };
      }
    }
  }
  return { kind: "insert", parentId: root.id, index: root.children.length };
}

function place(root: StackNode, node: SigNode, target: DropTarget): boolean {
  if (target.kind === "insert") {
    const parent = findNode(root, target.parentId);
    if (!parent || !isContainer(parent)) return false;
    // Dropping a non-column into a row creates a new column for it.
    if (parent.type === "row" && node.type !== "column") {
      parent.children.splice(target.index, 0, column([node]));
      return true;
    }
    if (!canContain(parent, node)) return false;
    (parent.children as SigNode[]).splice(Math.min(target.index, parent.children.length), 0, node);
    return true;
  }
  const loc = locate(root, target.targetId);
  if (!loc || !loc.parent || node.type === "column") return false;
  if (loc.parent.type === "column") {
    // Already in columns: add a sibling column next to the containing column.
    const colLoc = locate(root, loc.parent.id);
    if (colLoc?.parent?.type === "row" && loc.parent.children.length === 1) {
      colLoc.parent.children.splice(colLoc.index + (target.side === "right" ? 1 : 0), 0, column([node]));
      return true;
    }
  }
  const pair = target.side === "left" ? [column([node]), column([loc.node])] : [column([loc.node]), column([node])];
  (loc.parent.children as SigNode[]).splice(loc.index, 1, row(pair, { gap: 18 }));
  return true;
}

export function insertNode(node: SigNode, target: DropTarget = defaultInsertTarget()) {
  const fresh = cloneWithNewIds(node);
  let ok = false;
  st().edit((d) => {
    ok = place(d.root as StackNode, fresh, target);
  });
  if (ok) st().select(fresh.id);
  return ok ? fresh.id : null;
}

export function moveTo(id: string, target: DropTarget) {
  let ok = false;
  const sourceParent = locate(st().project!.root, id)?.parent?.id ?? null;
  st().edit((d) => {
    const root = d.root as StackNode;
    if (target.kind === "insert") {
      const parent = findNode(root, target.parentId);
      const node = findNode(root, id);
      if (parent?.type === "row" && node && node.type !== "column") {
        // Move a leaf into a new column inside the row.
        const removed = removeNode(root, id);
        if (removed) ok = place(root, removed, target);
        return;
      }
      ok = moveNode(root, id, target.parentId, target.index);
      return;
    }
    if (target.targetId === id) return;
    const removed = removeNode(root, id);
    if (removed) ok = place(root, removed, target);
  });
  if (ok) {
    if (sourceParent) cleanupEmptiedColumn(sourceParent);
    st().select(id);
  }
  return ok;
}

/**
 * If a move emptied a column, remove that column (and its row when no
 * columns remain). Part of the same undo step as the move.
 */
function cleanupEmptiedColumn(columnId: string) {
  st().editLive((d) => {
    const root = d.root as StackNode;
    const loc = locate(root, columnId);
    if (!loc || loc.node.type !== "column" || loc.node.children.length || !loc.parent) return;
    const rowId = loc.parent.id;
    removeNode(root, columnId);
    const rowLoc = locate(root, rowId);
    if (rowLoc && rowLoc.node.type === "row" && rowLoc.node.children.length === 0) removeNode(root, rowId);
  });
}

export function removeSelected() {
  const { selection, project } = st();
  if (!selection || !project || selection === project.root.id) return;
  const loc = locate(project.root, selection);
  if (!loc || loc.node.locked) return;
  const next = loc.parent ? ((loc.parent.children as SigNode[])[loc.index + 1] ?? (loc.parent.children as SigNode[])[loc.index - 1] ?? loc.parent) : null;
  st().edit((d) => void removeNode(d.root as StackNode, selection));
  st().select(next && next.id !== project.root.id ? next.id : null);
  st().toast("Component removed", "info", { label: "Undo", run: () => st().undo() });
}

export function duplicateSelected() {
  const { selection, project } = st();
  if (!selection || !project || selection === project.root.id) return;
  let copy: string | null = null;
  st().edit((d) => void (copy = duplicateNode(d.root as StackNode, selection)));
  if (copy) st().select(copy);
}

export function nudgeOrder(delta: -1 | 1) {
  const { selection, project } = st();
  if (!selection || !project) return;
  const loc = locate(project.root, selection);
  if (!loc?.parent) return;
  const to = loc.index + delta;
  if (to < 0 || to >= loc.parent.children.length) return;
  st().edit((d) => void moveNode(d.root as StackNode, selection, loc.parent!.id, delta > 0 ? to + 1 : to));
}

export function groupSelected() {
  const { selection } = st();
  if (!selection) return;
  let g: string | null = null;
  st().edit((d) => void (g = groupNode(d.root as StackNode, selection)));
  if (g) st().select(g);
}

export function ungroupSelected() {
  const { selection, project } = st();
  if (!selection || !project) return;
  const node = findNode(project.root, selection);
  if (node?.type !== "stack" || selection === project.root.id) return;
  const first = node.children[0]?.id ?? null;
  st().edit((d) => void ungroupNode(d.root as StackNode, selection));
  st().select(first);
}

export function setVisibility(id: string, visibility: Visibility) {
  st().edit((d) => {
    const n = findNode(d.root as StackNode, id);
    if (n) n.visibility = visibility;
  });
}

export function toggleLock(id: string) {
  st().edit((d) => {
    const n = findNode(d.root as StackNode, id);
    if (n) n.locked = !n.locked || undefined;
  });
}

export function selectParent() {
  const { selection, project } = st();
  if (!selection || !project) return;
  const loc = locate(project.root, selection);
  if (loc?.parent && loc.parent.id !== project.root.id) st().select(loc.parent.id);
  else st().select(null);
}

/** Update a node (in a coalescing undo step keyed by node + field). */
export function updateNode<T extends SigNode>(id: string, recipe: (n: T) => void, key?: string) {
  st().edit(
    (d) => {
      const n = findNode(d.root as StackNode, id);
      if (n) recipe(n as T);
    },
    key ? `${id}:${key}` : undefined,
  );
}

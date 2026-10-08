import type { ContainerNode, SigNode, StackNode, Variant, Visibility } from "./types";
import { uid } from "../lib/id";
import { deepClone } from "../lib/clone";

export function isContainer(node: SigNode): node is ContainerNode {
  return node.type === "stack" || node.type === "row" || node.type === "column";
}

export function childrenOf(node: SigNode): SigNode[] {
  return isContainer(node) ? (node.children as SigNode[]) : [];
}

export interface Located {
  node: SigNode;
  parent: ContainerNode | null;
  index: number;
  depth: number;
}

export function walk(root: SigNode, visit: (loc: Located) => void | false): void {
  const rec = (node: SigNode, parent: ContainerNode | null, index: number, depth: number): boolean => {
    if (visit({ node, parent, index, depth }) === false) return false;
    if (isContainer(node)) {
      const kids = node.children as SigNode[];
      for (let i = 0; i < kids.length; i++) if (!rec(kids[i], node, i, depth + 1)) return false;
    }
    return true;
  };
  rec(root, null, 0, 0);
}

export function locate(root: SigNode, id: string): Located | null {
  let found: Located | null = null;
  walk(root, (loc) => {
    if (loc.node.id === id) {
      found = loc;
      return false;
    }
  });
  return found;
}

export function findNode(root: SigNode, id: string): SigNode | null {
  return locate(root, id)?.node ?? null;
}

export function pathTo(root: SigNode, id: string): SigNode[] {
  const path: SigNode[] = [];
  const rec = (node: SigNode): boolean => {
    path.push(node);
    if (node.id === id) return true;
    for (const c of childrenOf(node)) if (rec(c)) return true;
    path.pop();
    return false;
  };
  return rec(root) ? path : [];
}

export function isAncestor(root: SigNode, ancestorId: string, id: string): boolean {
  return pathTo(root, id).some((n) => n.id === ancestorId && n.id !== id);
}

/** Can `child` legally be placed inside `parent`? */
export function canContain(parent: SigNode, child: SigNode): boolean {
  if (parent.type === "row") return child.type === "column";
  if (parent.type === "stack" || parent.type === "column") return child.type !== "column";
  return false;
}

// ---------------------------------------------------------------------------
// Mutations. These operate on Immer drafts (or plain objects) in place.
// ---------------------------------------------------------------------------

export function removeNode(root: StackNode, id: string): SigNode | null {
  const loc = locate(root, id);
  if (!loc || !loc.parent) return null;
  const [removed] = (loc.parent.children as SigNode[]).splice(loc.index, 1);
  return removed;
}

export function insertNode(root: StackNode, parentId: string, index: number, node: SigNode): boolean {
  const parent = findNode(root, parentId);
  if (!parent || !isContainer(parent) || !canContain(parent, node)) return false;
  const kids = parent.children as SigNode[];
  kids.splice(Math.max(0, Math.min(index, kids.length)), 0, node);
  return true;
}

/**
 * Move a node to (parentId, index). `index` is interpreted against the
 * target's children *before* removal, as drop indicators compute it.
 */
export function moveNode(root: StackNode, id: string, parentId: string, index: number): boolean {
  if (id === root.id || id === parentId || isAncestor(root, id, parentId)) return false;
  const loc = locate(root, id);
  const target = findNode(root, parentId);
  if (!loc || !loc.parent || !target || !isContainer(target) || !canContain(target, loc.node)) return false;
  let at = index;
  if (loc.parent.id === parentId && loc.index < index) at -= 1;
  const node = removeNode(root, id)!;
  return insertNode(root, parentId, at, node);
}

/** Deep clone with fresh ids. */
export function cloneWithNewIds<T extends SigNode>(node: T): T {
  const copy = deepClone(node) as T;
  const rec = (n: SigNode) => {
    n.id = uid("n");
    if (n.type === "contact") n.props.items.forEach((it) => (it.id = uid("c")));
    childrenOf(n).forEach(rec);
  };
  rec(copy);
  return copy;
}

export function duplicateNode(root: StackNode, id: string): string | null {
  const loc = locate(root, id);
  if (!loc || !loc.parent) return null;
  const copy = cloneWithNewIds(loc.node);
  if (loc.node.name) copy.name = `${loc.node.name} copy`;
  (loc.parent.children as SigNode[]).splice(loc.index + 1, 0, copy);
  return copy.id;
}

/** Wrap a node in a new stack ("group"). Returns the group id. */
export function groupNode(root: StackNode, id: string): string | null {
  const loc = locate(root, id);
  if (!loc || !loc.parent || loc.node.type === "column") return null;
  const group: StackNode = {
    id: uid("n"),
    type: "stack",
    name: "Group",
    visibility: "both",
    props: { gap: 4 },
    children: [loc.node],
  };
  (loc.parent.children as SigNode[]).splice(loc.index, 1, group);
  return group.id;
}

/** Replace a stack with its children. */
export function ungroupNode(root: StackNode, id: string): boolean {
  const loc = locate(root, id);
  if (!loc || !loc.parent || loc.node.type !== "stack") return false;
  const kids = loc.node.children.filter((c) => canContain(loc.parent!, c));
  (loc.parent.children as SigNode[]).splice(loc.index, 1, ...kids);
  return true;
}

// ---------------------------------------------------------------------------
// Visibility
// ---------------------------------------------------------------------------

export function visibleIn(vis: Visibility, variant: Variant): boolean {
  if (vis === "hidden") return false;
  if (vis === "both") return true;
  return vis === variant;
}

export const VISIBILITY_LABEL: Record<Visibility, string> = {
  both: "Full & Reply",
  full: "Full only",
  reply: "Reply only",
  hidden: "Hidden",
};

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

const TYPE_LABEL: Record<SigNode["type"], string> = {
  stack: "Stack",
  row: "Columns",
  column: "Column",
  field: "Field",
  text: "Text",
  contact: "Contact details",
  image: "Image",
  social: "Social icons",
  button: "Button",
  divider: "Divider",
  spacer: "Spacer",
  qr: "QR code",
  badge: "Label",
};

const FIELD_LABEL: Record<string, string> = {
  fullName: "Name",
  displayName: "Display name",
  title: "Job title",
  company: "Company",
  department: "Department",
  pronouns: "Pronouns",
  phone: "Phone",
  mobile: "Mobile",
  email: "Email",
  website: "Website",
  address: "Address",
  tagline: "Tagline",
  intro: "Introduction",
  booking: "Booking link",
};

const ROLE_LABEL: Record<string, string> = {
  logo: "Logo",
  headshot: "Headshot",
  partner: "Partner logo",
  banner: "Banner",
  artwork: "Image",
};

export function nodeLabel(node: SigNode): string {
  if (node.name) return node.name;
  if (node.type === "field") return FIELD_LABEL[node.props.field] ?? "Field";
  if (node.type === "image") return ROLE_LABEL[node.props.role] ?? "Image";
  if (node.type === "text") return node.props.text.slice(0, 24) || "Text";
  if (node.type === "badge") return node.props.text.slice(0, 24) || "Label";
  if (node.type === "button") return node.props.label || "Button";
  return TYPE_LABEL[node.type];
}

export function typeLabel(type: SigNode["type"]): string {
  return TYPE_LABEL[type];
}

export function countNodes(root: SigNode): number {
  let n = 0;
  walk(root, () => {
    n++;
  });
  return n;
}

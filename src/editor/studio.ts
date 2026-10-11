/** Pure, reviewable editor transformations. Every applied proposal is one edit. */
import { findNode, isContainer, locate, pathTo, walk } from "../model/tree";
import { stack } from "../model/factory";
import type { Project, SigNode, StackNode, TextStyle, BoxStyle } from "../model/types";
import { useEditor } from "../state/store";

export type LayoutFix = "spacing" | "contacts" | "columns" | "stack";
export const LAYOUT_FIXES: { id: LayoutFix; label: string; detail: string }[] = [
  { id: "spacing", label: "Reduce extra spacing", detail: "Reduce large gaps and padding. Text, images and contact values keep their size." },
  { id: "contacts", label: "Wrap contact details", detail: "Put contact items on separate lines and allow long values to wrap." },
  { id: "columns", label: "Rebalance columns", detail: "Remove fixed column widths; give more room to columns containing longer text." },
  { id: "stack", label: "Stack columns vertically", detail: "Keep every component in reading order. Column dividers become unnecessary and are removed." },
];
export function proposeLayout(project: Project, fix: LayoutFix): Project {
  const next = structuredClone(project);
  walk(next.root, ({ node }) => {
    if (pathTo(next.root, node.id).some(n => n.locked)) return;
    if (fix === "spacing") {
      if (isContainer(node)) node.props.gap = Math.min(node.props.gap ?? next.theme.gap, 8);
      if (node.box) { if (node.box.padX !== undefined) node.box.padX = Math.min(node.box.padX, 6); if (node.box.padY !== undefined) node.box.padY = Math.min(node.box.padY, 6); }
    }
    if (fix === "contacts" && node.type === "contact") { node.props.layout = "stacked"; node.props.nowrap = false; }
    if (fix === "columns" && node.type === "row") node.children.forEach(col => {
      if (col.locked) return;
      if (col.box) delete col.box.width;
      let content = 0;
      walk(col, ({ node: n }) => {
        if (n.type === "field") content += (n.props.detached ? n.props.text ?? "" : next.profile.fields[n.props.field]).length;
        if (n.type === "text") content += n.props.text.length;
        if (n.type === "contact") content += 60;
      });
      col.props.weight = Math.max(1, Math.min(4, 1 + content / 80));
    });
  });
  if (fix === "spacing") next.theme.gap = Math.min(next.theme.gap, 6);
  if (fix === "stack") {
    const transform = (node: SigNode): SigNode => {
      if (node.locked || !isContainer(node)) return node;
      if (node.type === "row" && !node.children.some(col => col.locked)) return { ...node, type: "stack", props: { gap: 10 }, children: node.children.map(col => ({ ...col, type: "stack" as const, box: { ...col.box, width: undefined }, props: { gap: col.props.gap }, children: col.children.map(transform) })) };
      node.children = node.children.map(transform) as never; return node;
    };
    next.root = transform(next.root) as StackNode;
  }
  return next;
}
export function applyDesign(proposal: Project) {
  const st = useEditor.getState();
  if (proposal.id !== st.project?.id) return;
  st.edit(d => { d.root = proposal.root; d.theme = proposal.theme; d.templateId = proposal.templateId; });
  st.select(null);
}
export function selectedNodes(project = useEditor.getState().project): SigNode[] {
  if (!project) return [];
  const st = useEditor.getState();
  const ids = new Set(st.selections.length ? st.selections : st.selection ? [st.selection] : []);
  const result: SigNode[] = [];
  walk(project.root, ({ node }) => { if (ids.has(node.id) && node.id !== project.root.id && !pathTo(project.root, node.id).some(n => n.locked)) result.push(node); });
  return result;
}
export function bulkStyle(text: Partial<TextStyle>, box?: Partial<BoxStyle>) {
  const ids = selectedNodes().map(n => n.id);
  useEditor.getState().edit(d => ids.forEach(id => {
    const n = findNode(d.root, id);
    if (!n) return;
    n.text = { ...n.text, ...text };
    if (box) n.box = { ...n.box, ...box };
  }));
}
export function groupMany() {
  const st = useEditor.getState(); if (!st.project) return;
  const nodes = selectedNodes(); const locations = nodes.map(n => locate(st.project!.root, n.id)!);
  if (nodes.length < 2 || locations.some(l => !l.parent || l.parent.type === "row" || l.parent.id !== locations[0].parent?.id)) {
    st.toast("Choose two or more components in the same section to group.", "info"); return;
  }
  const indices = locations.map(l => l.index).sort((a,b) => a-b);
  if (indices[indices.length - 1] - indices[0] !== indices.length - 1) { st.toast("Choose adjacent components to preserve reading order when grouping.", "info"); return; }
  const group = stack(nodes.map(n => structuredClone(n)), { name: "Group", gap: 6 });
  st.edit(d => {
    const parent = findNode(d.root, locations[0].parent!.id);
    if (!parent || !isContainer(parent)) return;
    const ids = new Set(nodes.map(n => n.id));
    const at = Math.min(...locations.map(l => l.index));
    parent.children = parent.children.filter(n => !ids.has(n.id)) as never;
    (parent.children as SigNode[]).splice(at, 0, group);
  }); st.select(group.id);
}
export function equalizeSelection() {
  const ids = selectedNodes().map(n => n.id);
  useEditor.getState().edit(d => ids.forEach(id => {
    const n = findNode(d.root, id); if (!n) return;
    n.box = { ...n.box, padX: 6, padY: 4, valign: "top" };
    if (isContainer(n)) n.props.gap = 6;
    if (n.type === "column") { n.props.weight = 1; delete n.box.width; }
  }));
}
export type PreviewPerson = "current" | "long" | "missing" | "international";
export function previewPerson(project: Project, person: PreviewPerson): Project {
  const p = structuredClone(project);
  if (person === "long") Object.assign(p.profile.fields, { fullName: "Alexandra Montgomery Wellington", displayName: "", title: "Senior Director of Partnerships and Client Experience", company: "Modern Gentlemen International Advisory Group" });
  if (person === "missing") {
    Object.assign(p.profile.fields, { phone: "", mobile: "", address: "" });
    walk(p.root, ({ node }) => { if (node.type === "image" && node.props.role === "headshot") node.visibility = "hidden"; });
  }
  if (person === "international") Object.assign(p.profile.fields, { fullName: "Élodie Nguyễn 山田", displayName: "", title: "Directrice des relations internationales", address: "東京都渋谷区 / Montréal, Québec" });
  return p;
}

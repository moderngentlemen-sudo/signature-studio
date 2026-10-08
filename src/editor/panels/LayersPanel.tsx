import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Eye, EyeOff, Lock, Unlock } from "lucide-react";
import { useEditor } from "../../state/store";
import { canContain, childrenOf, findNode, isAncestor, isContainer, locate, nodeLabel, visibleIn } from "../../model/tree";
import type { SigNode, Visibility } from "../../model/types";
import { NodeIcon } from "../../ui/nodeIcons";
import { armDrag, registerResolver, useDrag } from "../dnd";
import { setVisibility, toggleLock, updateNode } from "../actions";

const VIS_SHORT: Record<Visibility, string> = { both: "", full: "FULL", reply: "REPLY", hidden: "HIDDEN" };

export function LayersPanel() {
  const project = useEditor((s) => s.project);
  const listRef = useRef<HTMLUListElement>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // Drop resolution for the layer list.
  useEffect(() => {
    return registerResolver((x, y, source) => {
      const list = listRef.current;
      const proj = useEditor.getState().project;
      if (!list || !proj) return null;
      const lr = list.getBoundingClientRect();
      if (x < lr.left || x > lr.right || y < lr.top - 10 || y > lr.bottom + 10) return null;
      const rows = Array.from(list.querySelectorAll<HTMLElement>("[data-layer-id]"));
      const dragged = source.kind === "move" ? source.nodeId : null;
      const probe = source.kind === "new" ? source.create() : findNode(proj.root, dragged!)!;
      for (const row of rows) {
        const r = row.getBoundingClientRect();
        if (y < r.top || y > r.bottom) continue;
        const id = row.dataset.layerId!;
        if (dragged && (id === dragged || isAncestor(proj.root, dragged, id))) return null;
        const node = findNode(proj.root, id)!;
        const rel = (y - r.top) / r.height;
        const loc = locate(proj.root, id)!;
        if (isContainer(node) && ((rel > 0.3 && rel < 0.7) || id === proj.root.id) && (canContain(node, probe) || node.type === "row")) {
          return { target: { kind: "insert", parentId: id, index: node.children.length }, indicator: { surface: "layers", layer: { id, pos: "into" } } };
        }
        if (!loc.parent) return null;
        const after = rel >= 0.5;
        return {
          target: { kind: "insert", parentId: loc.parent.id, index: loc.index + (after ? 1 : 0) },
          indicator: { surface: "layers", layer: { id, pos: after ? "after" : "before" } },
        };
      }
      return null;
    });
  }, []);

  if (!project) return null;

  const toggle = (id: string) =>
    setCollapsed((c) => {
      const n = new Set(c);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <>
      <div className="panel-head">
        <h2>Layers</h2>
        <p>Drag to reorder. Alt+↑/↓ moves the selection.</p>
      </div>
      <ul className="layers" role="tree" aria-label="Signature layers" ref={listRef}>
        <LayerRow node={project.root} depth={0} collapsed={collapsed} onToggle={toggle} isRoot />
      </ul>
    </>
  );
}

function LayerRow({
  node,
  depth,
  collapsed,
  onToggle,
  isRoot,
}: {
  node: SigNode;
  depth: number;
  collapsed: Set<string>;
  onToggle: (id: string) => void;
  isRoot?: boolean;
}) {
  const selected = useEditor((s) => s.selection === node.id);
  const variant = useEditor((s) => s.variant);
  const indicator = useDrag((s) => (s.resolution?.indicator.layer?.id === node.id ? s.resolution.indicator.layer.pos : null));
  const [renaming, setRenaming] = useState(false);
  const kids = childrenOf(node);
  const open = !collapsed.has(node.id);
  const rowRef = useRef<HTMLDivElement>(null);
  const shown = visibleIn(node.visibility, variant);

  useEffect(() => {
    if (selected) rowRef.current?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  return (
    <li role="treeitem" aria-selected={selected} aria-expanded={kids.length ? open : undefined}>
      <div
        ref={rowRef}
        className={`layer${shown ? "" : " ghost"}${indicator ? ` drop-${indicator}` : ""}`}
        aria-selected={selected}
        data-layer-id={node.id}
        style={{ paddingLeft: 6 + depth * 14 }}
        tabIndex={selected ? 0 : -1}
        onPointerDown={(e) => {
          if (e.button !== 0 || (e.target as HTMLElement).closest("button,input")) return;
          useEditor.getState().select(node.id);
          if (!isRoot && !node.locked) armDrag(e, { kind: "move", nodeId: node.id }, nodeLabel(node));
        }}
        onDoubleClick={() => !isRoot && setRenaming(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !isRoot) setRenaming(true);
          if (e.key === "ArrowRight" && kids.length && !open) onToggle(node.id);
          if (e.key === "ArrowLeft" && kids.length && open) onToggle(node.id);
        }}
      >
        {kids.length ? (
          <button className="twisty" aria-label={open ? "Collapse" : "Expand"} onClick={() => onToggle(node.id)}>
            {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        ) : (
          <span style={{ width: 16 }} />
        )}
        <NodeIcon type={node.type} size={13} />
        <span className="name">
          {renaming ? (
            <input
              autoFocus
              defaultValue={nodeLabel(node)}
              aria-label="Layer name"
              onBlur={(e) => {
                const v = e.target.value.trim();
                updateNode(node.id, (n) => void (n.name = v || undefined));
                setRenaming(false);
              }}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                if (e.key === "Escape") setRenaming(false);
              }}
            />
          ) : (
            nodeLabel(node)
          )}
        </span>
        {node.visibility !== "both" && <span className={`vis-badge ${node.visibility}`}>{VIS_SHORT[node.visibility]}</span>}
        {node.locked && <Lock size={11} className="muted" />}
        {!isRoot && (
          <span className="actions">
            <button
              className="icon-btn small"
              aria-label={node.visibility === "hidden" ? "Show" : "Hide"}
              title={node.visibility === "hidden" ? "Show in both" : "Hide everywhere"}
              onClick={() => setVisibility(node.id, node.visibility === "hidden" ? "both" : "hidden")}
            >
              {node.visibility === "hidden" ? <EyeOff size={12} /> : <Eye size={12} />}
            </button>
            <button className="icon-btn small" aria-label={node.locked ? "Unlock" : "Lock"} onClick={() => toggleLock(node.id)}>
              {node.locked ? <Unlock size={12} /> : <Lock size={12} />}
            </button>
          </span>
        )}
      </div>
      {kids.length > 0 && open && (
        <ul role="group" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {kids.map((k) => (
            <LayerRow key={k.id} node={k} depth={depth + 1} collapsed={collapsed} onToggle={onToggle} />
          ))}
        </ul>
      )}
    </li>
  );
}

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowUp, ArrowUpLeft, Copy, Eye, Grid3x3, Lock, Maximize, Minus, Plus, Trash2, Type, Unlock } from "lucide-react";
import { useEditor } from "../state/store";
import { renderSignature } from "../render/email";
import { googleFontsHref } from "../model/fonts";
import { findNode, isAncestor, locate, nodeLabel, pathTo, VISIBILITY_LABEL } from "../model/tree";
import type { Project, SigNode, StackNode, Variant, Visibility } from "../model/types";
import { sourceUrl, onSourcesChange } from "../state/assets";
import { armDrag, registerResolver, useDrag, type Resolution } from "./dnd";
import { duplicateSelected, nudgeOrder, removeSelected, selectParent, setVisibility, toggleLock } from "./actions";
import { fieldValue } from "../model/profile";

const VIS_CYCLE: Visibility[] = ["both", "full", "reply", "hidden"];

// ---------------------------------------------------------------------------
// Fonts: webfonts are loaded into the document (font faces are shared with
// shadow roots).
// ---------------------------------------------------------------------------

function useWebfonts(project: Project | null) {
  const ids = useMemo(() => {
    if (!project) return [] as string[];
    const set = new Set<string>([project.theme.fonts.display, project.theme.fonts.body]);
    JSON.stringify(project.root).replace(/"font":"([a-z0-9-]+)"/g, (_, id) => (set.add(id), ""));
    return [...set].sort();
  }, [project]);
  useEffect(() => {
    const href = googleFontsHref(ids);
    if (!href) return;
    if (document.querySelector(`link[data-ss-font="${CSS.escape(href)}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.dataset.ssFont = href;
    document.head.appendChild(link);
  }, [ids]);
}

function useSourcesVersion() {
  const [v, setV] = useState(0);
  useEffect(() => {
    const off = onSourcesChange(() => setV((n) => n + 1));
    return () => void off();
  }, []);
  return v;
}

// ---------------------------------------------------------------------------
// Canvas
// ---------------------------------------------------------------------------

export function Canvas() {
  const project = useEditor((s) => s.project);
  const compare = useEditor((s) => s.compare);
  const variant = useEditor((s) => s.variant);
  const preview = useEditor((s) => s.preview);
  const zoom = useEditor((s) => s.zoom);
  const wrapRef = useRef<HTMLElement>(null);
  useWebfonts(project);

  const fit = useCallback(() => {
    const wrap = wrapRef.current;
    const st = useEditor.getState();
    if (!wrap || !st.project) return;
    const contentW = Math.max(st.measuredWidth, st.project.theme.width) + 64 + 20;
    const z = Math.max(0.25, Math.min(2, (wrap.clientWidth - 64) / contentW));
    st.set({ zoom: Math.round(z * 100) / 100 });
  }, []);

  useEffect(() => {
    const onFit = () => fit();
    window.addEventListener("ss:fit", onFit);
    return () => window.removeEventListener("ss:fit", onFit);
  }, [fit]);

  if (!project) return <main className="canvas-wrap" />;
  // Side-by-side must fit: two papers plus padding.
  const wrapW = wrapRef.current?.clientWidth ?? 1000;
  const compareZoom = Math.min(zoom, Math.max(0.3, (wrapW - 80 - 28) / 2 / (Math.max(project.theme.width, 200) + 64)));

  return (
    <main
      className="canvas-wrap"
      ref={wrapRef}
      aria-label="Signature canvas"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains("canvas-scroll")) useEditor.getState().select(null);
      }}
    >
      <div className="canvas-scroll">
        {compare ? (
          <div className="compare">
            {(["full", "reply"] as Variant[]).map((v) => (
              <Paper
                key={v}
                project={project}
                variant={v}
                interactive={false}
                zoom={compareZoom}
                onPick={() => useEditor.getState().set({ compare: false, variant: v })}
              />
            ))}
          </div>
        ) : (
          <Paper project={project} variant={variant} interactive={!preview} zoom={zoom} />
        )}
      </div>
      <CanvasToggles />
      <div className="zoom-ctl" role="group" aria-label="Zoom">
        <button className="icon-btn small" aria-label="Zoom out" onClick={() => setZoom(zoom / 1.2)}>
          <Minus size={14} />
        </button>
        <span aria-live="polite">{Math.round(zoom * 100)}%</span>
        <button className="icon-btn small" aria-label="Zoom in" onClick={() => setZoom(zoom * 1.2)}>
          <Plus size={14} />
        </button>
        <button className="icon-btn small" aria-label="Fit to screen" title="Fit to screen (Shift+1)" onClick={fit}>
          <Maximize size={13} />
        </button>
      </div>
    </main>
  );
}

function setZoom(z: number) {
  useEditor.getState().set({ zoom: Math.round(Math.max(0.25, Math.min(4, z)) * 100) / 100 });
}

function CanvasToggles() {
  const ghosts = useEditor((s) => s.ghosts);
  const fallback = useEditor((s) => s.fallbackFonts);
  const grid = useEditor((s) => s.grid);
  const set = useEditor((s) => s.set);
  return (
    <div className="canvas-toggles">
      <button
        className={`chip${fallback ? " brass" : ""}`}
        aria-pressed={fallback}
        title="Show text with the fonts most recipients' email apps will actually use"
        onClick={() => set({ fallbackFonts: !fallback })}
      >
        <Type size={12} /> As recipients see it
      </button>
      <button
        className={`chip desktop-only${ghosts ? " brass" : ""}`}
        aria-pressed={ghosts}
        title="Show components hidden in this variant as faded ghosts"
        onClick={() => set({ ghosts: !ghosts })}
      >
        <Eye size={12} /> Hidden components
      </button>
      <button
        className={`chip desktop-only${grid ? " brass" : ""}`}
        aria-pressed={grid}
        title="Snap resizing to an 8px grid (hold Alt for 1px)"
        onClick={() => set({ grid: !grid })}
      >
        <Grid3x3 size={12} /> 8px snap
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Paper + stage
// ---------------------------------------------------------------------------

interface PaperProps {
  project: Project;
  variant: Variant;
  interactive: boolean;
  zoom: number;
  onPick?: () => void;
}

const SHADOW_CSS = `
:host { display: block; }
.sig { display: inline-block; min-width: 40px; -webkit-user-select: none; user-select: none; }
img { -webkit-user-drag: none; user-select: none; }
[data-ss-id] { cursor: default; }
[data-ss-text][contenteditable="true"] { -webkit-user-select: text; user-select: text; outline: none; cursor: text; box-shadow: 0 0 0 2px rgba(59,111,216,.35); border-radius: 2px; background: rgba(59,111,216,.06); }
[data-ss-locked] { cursor: not-allowed; }
`;

function Paper({ project, variant, interactive, zoom, onPick }: PaperProps) {
  const ghosts = useEditor((s) => s.ghosts);
  const fallbackFonts = useEditor((s) => s.fallbackFonts);
  const measured = useEditor((s) => s.measuredWidth);
  const sourcesVersion = useSourcesVersion();
  const { html } = useMemo(
    () =>
      renderSignature(project, {
        variant,
        mode: interactive ? "edit" : "preview",
        ghosts,
        fallbackFonts,
        sourceUrl,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [project, variant, interactive, ghosts, fallbackFonts, sourcesVersion],
  );
  const over = measured > project.theme.width + 1;

  return (
    <div className="paper" onClick={onPick} style={onPick ? { cursor: "pointer" } : undefined} data-testid={`paper-${variant}`}>
      <div className="paper-chrome">
        <span>
          <strong style={{ color: "var(--ink)", fontWeight: 600 }}>{variant === "full" ? "Full signature" : "Reply signature"}</strong>
          {variant === "full" ? " · new emails" : " · replies & forwards"}
        </span>
        {interactive && (
          <span className={over ? "warn" : ""} style={over ? { color: "var(--err)" } : undefined} title="Rendered width / target width">
            {Math.round(measured)} / {project.theme.width}px
          </span>
        )}
        {onPick && <span className="chip">Click to edit</span>}
      </div>
      <div className="paper-body">
        <div style={{ zoom }}>
          <Stage html={html} project={project} interactive={interactive} />
        </div>
      </div>
    </div>
  );
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

function Stage({ html, project, interactive }: { html: string; project: Project; interactive: boolean }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<{ root: ShadowRoot; container: HTMLDivElement } | null>(null);
  const [tick, setTick] = useState(0);
  const editingText = useEditor((s) => s.editingText);

  // Attach the shadow root once.
  useLayoutEffect(() => {
    const host = hostRef.current!;
    if (shadowRef.current) return;
    const root = host.shadowRoot ?? host.attachShadow({ mode: "open" });
    root.innerHTML = `<style>${SHADOW_CSS}</style><div class="sig"></div>`;
    shadowRef.current = { root, container: root.querySelector(".sig") as HTMLDivElement };
  }, []);

  // Render HTML (never while the user is typing inline).
  useLayoutEffect(() => {
    const sh = shadowRef.current;
    if (!sh || useEditor.getState().editingText) return;
    sh.container.innerHTML = html;
    if (interactive) {
      const table = sh.container.firstElementChild as HTMLElement | null;
      const w = table ? table.offsetWidth : 0;
      if (Math.abs(useEditor.getState().measuredWidth - w) > 0.5) useEditor.getState().set({ measuredWidth: w });
    }
    setTick((t) => t + 1);
  }, [html, interactive]);

  // Re-measure when fonts or images finish loading.
  useEffect(() => {
    const sh = shadowRef.current;
    if (!sh) return;
    const bump = () => {
      setTick((t) => t + 1);
      if (interactive) {
        const table = sh.container.firstElementChild as HTMLElement | null;
        if (table) useEditor.getState().set({ measuredWidth: table.offsetWidth });
      }
    };
    document.fonts?.ready.then(bump);
    const imgs = sh.container.querySelectorAll("img");
    imgs.forEach((img) => img.addEventListener("load", bump, { once: true }));
    const ro = new ResizeObserver(bump);
    ro.observe(sh.container);
    return () => ro.disconnect();
  }, [html, interactive]);

  const elFor = useCallback((id: string) => shadowRef.current?.container.querySelector<HTMLElement>(`[data-ss-id="${CSS.escape(id)}"]`) ?? null, []);

  const boxOf = useCallback((el: Element | null): Box | null => {
    const stage = stageRef.current;
    if (!el || !stage) return null;
    const sr = stage.getBoundingClientRect();
    const k = sr.width / (stage.offsetWidth || 1) || 1;
    const r = el.getBoundingClientRect();
    return { x: (r.left - sr.left) / k, y: (r.top - sr.top) / k, w: r.width / k, h: r.height / k };
  }, []);

  // ── Drop resolution on the canvas ──────────────────────────────────────
  useEffect(() => {
    if (!interactive) return;
    return registerResolver((x, y, source) => {
      const sh = shadowRef.current;
      const stage = stageRef.current;
      const proj = useEditor.getState().project;
      if (!sh || !stage || !proj) return null;
      const sr = stage.getBoundingClientRect();
      const pad = 40;
      if (x < sr.left - pad || x > sr.right + pad * 4 || y < sr.top - pad || y > sr.bottom + pad) return null;
      const root = proj.root;
      const dragged = source.kind === "move" ? source.nodeId : null;
      const hits = (sh.root.elementsFromPoint(x, y) as HTMLElement[])
        .filter((el) => el.dataset?.ssId)
        .map((el) => el.dataset.ssId!)
        .filter((id) => !dragged || (id !== dragged && !isAncestor(root, dragged, id)));
      const id = hits[0] ?? root.id;
      return resolveDrop(
        root,
        id,
        x,
        y,
        (nid) => boxOf(elFor(nid)),
        (cx) => (cx - sr.left) / (sr.width / (stage.offsetWidth || 1)),
        (cy) => (cy - sr.top) / (sr.height / (stage.offsetHeight || 1)),
        dragged,
      );
    });
  }, [interactive, boxOf, elFor]);

  // ── Pointer handlers ───────────────────────────────────────────────────
  const nodeElFromEvent = (e: React.SyntheticEvent): HTMLElement | null => {
    const path = e.nativeEvent.composedPath() as HTMLElement[];
    for (const el of path) {
      if (el === hostRef.current) break;
      if (el.dataset?.ssId) return el;
    }
    return null;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!interactive || e.button !== 0) return;
    const st = useEditor.getState();
    const path = e.nativeEvent.composedPath() as HTMLElement[];
    if (st.editingText && path.some((el) => el.isContentEditable)) return;
    const el = nodeElFromEvent(e);
    e.stopPropagation();
    if (!el) return st.select(null);
    const id = el.dataset.ssId!;
    st.select(id);
    const proj = st.project!;
    const node = findNode(proj.root, id);
    if (!node || id === proj.root.id || node.locked) return;
    armDrag(e, { kind: "move", nodeId: id }, nodeLabel(node));
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    if (!interactive) return;
    const path = e.nativeEvent.composedPath() as HTMLElement[];
    const span = path.find((el) => el.dataset?.ssText);
    if (span) startInlineEdit(span);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!interactive || useDrag.getState().source) return;
    const el = nodeElFromEvent(e);
    const id = el?.dataset.ssId ?? null;
    if (useEditor.getState().hover !== id) useEditor.getState().set({ hover: id });
  };

  return (
    <div className="stage" ref={stageRef} data-testid={interactive ? "stage" : undefined}>
      <div
        className="stage-host"
        ref={hostRef}
        onPointerDown={onPointerDown}
        onDoubleClick={onDoubleClick}
        onPointerMove={onPointerMove}
        onPointerLeave={() => useEditor.getState().set({ hover: null })}
      />
      {interactive && <Overlay project={project} tick={tick} boxOf={boxOf} elFor={elFor} editing={!!editingText} />}
    </div>
  );
}

/** Map a pointer position over node `id` to a drop target. */
function resolveDrop(
  root: StackNode,
  id: string,
  x: number,
  y: number,
  boxFor: (id: string) => Box | null,
  toX: (cx: number) => number,
  toY: (cy: number) => number,
  dragged: string | null,
): Resolution | null {
  const node = findNode(root, id);
  if (!node) return null;
  const px = toX(x);
  const py = toY(y);
  const canvas = (line: Resolution["indicator"]["line"], into?: Box): Resolution["indicator"] => ({ surface: "canvas", line, into });

  const intoContainer = (c: Extract<SigNode, { children: unknown }>): Resolution | null => {
    const box = boxFor(c.id);
    if (!box) return null;
    const kids = (c.children as SigNode[]).filter((k) => k.id !== dragged);
    if (c.type === "row") {
      const cols = kids.map((k) => ({ k, b: boxFor(k.id) })).filter((x) => x.b) as { k: SigNode; b: Box }[];
      let index = cols.length;
      for (let i = 0; i < cols.length; i++)
        if (px < cols[i].b.x + cols[i].b.w / 2) {
          index = i;
          break;
        }
      const realIndex = index < cols.length ? c.children.indexOf(cols[index].k as never) : c.children.length;
      const lx = index < cols.length ? cols[index].b.x - 4 : box.x + box.w + 2;
      return { target: { kind: "insert", parentId: c.id, index: realIndex }, indicator: canvas({ x: lx, y: box.y, length: box.h, vertical: true }) };
    }
    if (!kids.length) return { target: { kind: "insert", parentId: c.id, index: 0 }, indicator: canvas(undefined, box) };
    const boxes = kids.map((k) => ({ k, b: boxFor(k.id) })).filter((x) => x.b) as { k: SigNode; b: Box }[];
    let index = boxes.length;
    for (let i = 0; i < boxes.length; i++)
      if (py < boxes[i].b.y + boxes[i].b.h / 2) {
        index = i;
        break;
      }
    const realIndex = index < boxes.length ? (c.children as SigNode[]).indexOf(boxes[index].k) : c.children.length;
    const ly = index < boxes.length ? boxes[index].b.y - 2 : boxes[boxes.length - 1].b.y + boxes[boxes.length - 1].b.h + 2;
    return { target: { kind: "insert", parentId: c.id, index: realIndex }, indicator: canvas({ x: box.x, y: ly, length: Math.max(box.w, 40) }) };
  };

  if (node.type === "stack" || node.type === "column" || node.type === "row") {
    return intoContainer(node as never);
  }

  const loc = locate(root, id);
  if (!loc?.parent) return null;
  const box = boxFor(id);
  if (!box) return null;
  const rel = (px - box.x) / Math.max(1, box.w);
  const draggedNode = dragged ? findNode(root, dragged) : null;
  if (box.w > 60 && (rel < 0.18 || rel > 0.82) && draggedNode?.type !== "column") {
    const side = rel < 0.5 ? "left" : "right";
    return {
      target: { kind: "beside", targetId: id, side },
      indicator: canvas({ x: side === "left" ? box.x - 3 : box.x + box.w + 1, y: box.y, length: box.h, vertical: true }),
    };
  }
  const after = py > box.y + box.h / 2;
  const parent = loc.parent;
  const parentBox = boxFor(parent.id) ?? box;
  return {
    target: { kind: "insert", parentId: parent.id, index: loc.index + (after ? 1 : 0) },
    indicator: canvas({ x: parentBox.x, y: after ? box.y + box.h + 1 : box.y - 2, length: Math.max(parentBox.w, box.w) }),
  };
}

// ---------------------------------------------------------------------------
// Inline text editing
// ---------------------------------------------------------------------------

function startInlineEdit(span: HTMLElement) {
  const st = useEditor.getState();
  const id = span.dataset.ssText!;
  const node = findNode(st.project!.root, id);
  if (!node || node.locked) return;
  if (node.type === "field" && node.props.format) return;
  const original = span.textContent ?? "";
  // Show the real value (not the placeholder) when the field is empty.
  if (node.type === "field" && !node.props.detached && !fieldValue(st.project!.profile, node.props.field)) span.textContent = "";
  if ((node.type === "text" || node.type === "badge") && !node.props.text) span.textContent = "";
  st.set({ editingText: id, selection: id });
  span.contentEditable = "true";
  span.spellcheck = true;
  span.focus();
  const sel = document.getSelection();
  const range = document.createRange();
  range.selectNodeContents(span);
  sel?.removeAllRanges();
  sel?.addRange(range);
  const multiline = node.type === "text";

  const finish = (commit: boolean) => {
    span.removeEventListener("keydown", onKey);
    span.removeEventListener("blur", onBlur);
    span.removeEventListener("paste", onPaste);
    span.contentEditable = "false";
    const value = (span.innerText ?? "")
      .replace(/ /g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    useEditor.getState().set({ editingText: null });
    if (!commit) {
      span.textContent = original;
      return;
    }
    applyInlineText(id, value);
  };
  const onKey = (e: KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "Escape") {
      e.preventDefault();
      finish(false);
    } else if (e.key === "Enter" && (!multiline || !e.shiftKey)) {
      e.preventDefault();
      finish(true);
    }
  };
  const onBlur = () => finish(true);
  const onPaste = (e: ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData?.getData("text/plain") ?? "";
    document.execCommand("insertText", false, multiline ? text : text.replace(/\s*\n\s*/g, " "));
  };
  span.addEventListener("keydown", onKey);
  span.addEventListener("blur", onBlur);
  span.addEventListener("paste", onPaste);
}

function applyInlineText(id: string, value: string) {
  const st = useEditor.getState();
  const node = findNode(st.project!.root, id);
  if (!node) return;
  st.edit((d) => {
    const n = findNode(d.root as StackNode, id);
    if (!n) return;
    if (n.type === "field") {
      if (n.props.detached) n.props.text = value;
      else if (n.props.field === "fullName" && d.profile.fields.displayName.trim()) d.profile.fields.displayName = value;
      else d.profile.fields[n.props.field] = value;
    } else if (n.type === "text" || n.type === "badge") n.props.text = value;
    else if (n.type === "button") n.props.label = value;
  });
  // Force a re-render even if the model didn't change (restores placeholders).
  st.set({ project: { ...useEditor.getState().project! } });
}

// ---------------------------------------------------------------------------
// Overlay: hover/selection outlines, handles, drop indicators, toolbar
// ---------------------------------------------------------------------------

interface OverlayProps {
  project: Project;
  tick: number;
  boxOf: (el: Element | null) => Box | null;
  elFor: (id: string) => HTMLElement | null;
  editing: boolean;
}

function Overlay({ project, tick, boxOf, elFor, editing }: OverlayProps) {
  const selection = useEditor((s) => s.selection);
  const hover = useEditor((s) => s.hover);
  const zoom = useEditor((s) => s.zoom);
  const resolution = useDrag((s) => s.resolution);
  const dragging = useDrag((s) => !!s.source);
  const [measure, setMeasure] = useState<{ x: number; y: number; text: string } | null>(null);
  const [, force] = useState(0);
  void tick;
  void zoom;

  useEffect(() => {
    const onResize = () => force((n) => n + 1);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const root = project.root;
  const selNode = selection ? findNode(root, selection) : null;
  const selBox = selection ? boxOf(elFor(selection)) : null;
  const hoverBox = hover && hover !== selection && !dragging ? boxOf(elFor(hover)) : null;
  const parentId = selection ? locate(root, selection)?.parent?.id : null;
  const parentBox = parentId && parentId !== root.id ? boxOf(elFor(parentId)) : null;

  // Nearest row for column gutters.
  const rowNode = useMemo(() => {
    if (!selection) return null;
    const path = pathTo(root, selection);
    for (let i = path.length - 1; i >= 0; i--) if (path[i].type === "row") return path[i];
    return null;
  }, [root, selection]);

  const scale = project.theme.scale;
  const targetX = project.theme.width;
  const measured = useEditor.getState().measuredWidth;

  const startResize = (e: React.PointerEvent, mode: "image" | "width" | "column", nodeId: string, startPx: number) => {
    e.stopPropagation();
    e.preventDefault();
    const st = useEditor.getState();
    st.beginGesture();
    const sx = e.clientX;
    const z = st.zoom;
    const snapStep = () => (st.grid ? 8 : 4);
    const siblings: number[] = [];
    if (mode === "image") {
      const visit = (n: SigNode) => {
        if (n.type === "image" && n.id !== nodeId) siblings.push(n.props.width);
        if ("children" in n) (n.children as SigNode[]).forEach(visit);
      };
      visit(st.project!.root);
    }
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - sx) / z;
      let w = (startPx + dx) / scale;
      let note = "";
      if (!ev.altKey) {
        const step = snapStep();
        w = Math.round(w / step) * step;
        const near = siblings.find((s) => Math.abs(s - w) <= 4);
        if (near !== undefined) {
          w = near;
          note = " · matches another image";
        }
      }
      w = Math.max(mode === "column" ? 24 : 12, Math.min(1200, w));
      st.editLive((d) => {
        const n = findNode(d.root as StackNode, nodeId);
        if (!n) return;
        if (mode === "image" && n.type === "image") n.props.width = Math.round(w);
        else n.box = { ...n.box, width: Math.round(w) };
      });
      setMeasure({ x: ev.clientX, y: ev.clientY, text: `${Math.round(w)} px${note}` });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      useEditor.getState().endGesture();
      setMeasure(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const resetWidth = (nodeId: string) =>
    useEditor.getState().edit((d) => {
      const n = findNode(d.root as StackNode, nodeId);
      if (n?.box) delete n.box.width;
    });

  const gutters: { x: number; y: number; h: number; colId: string; startPx: number }[] = [];
  if (rowNode && rowNode.type === "row" && !dragging) {
    const cols = rowNode.children;
    for (let i = 0; i < cols.length - 1; i++) {
      const b = boxOf(elFor(cols[i].id));
      if (b) gutters.push({ x: b.x + b.w + 2, y: b.y, h: b.h, colId: cols[i].id, startPx: b.w });
    }
  }

  const ind = resolution?.indicator.surface === "canvas" ? resolution.indicator : null;
  const locked = !!selNode?.locked;
  const isRoot = selection === root.id;

  return (
    <div className="overlay" aria-hidden="false">
      {measured > 0 && <div className={`target-line${measured > targetX + 1 ? " over" : ""}`} style={{ left: targetX }} title={`Target width ${targetX}px`} />}
      {hoverBox && <div className="ov-box ov-hover" style={pos(hoverBox)} />}
      {parentBox && !dragging && <div className="ov-box ov-parent" style={pos(parentBox)} />}
      {selBox && selNode && (
        <div className="ov-box ov-select" style={pos(selBox)} data-testid="selection-box">
          {!editing && (
            <div className="ov-label">
              {nodeLabel(selNode)}
              {selNode.visibility !== "both" && <span className="vis">· {VISIBILITY_LABEL[selNode.visibility]}</span>}
              {locked && <Lock size={10} />}
            </div>
          )}
          {!editing && !locked && !dragging && selNode.type === "image" && (
            <div className="ov-handle se" title="Drag to resize (Alt: no snapping)" onPointerDown={(e) => startResize(e, "image", selNode.id, selBox.w)} />
          )}
          {!editing && !locked && !dragging && !isRoot && selNode.type !== "image" && selNode.type !== "spacer" && selNode.type !== "column" && (
            <div
              className="ov-handle e"
              title="Drag to set width · double-click to reset"
              onPointerDown={(e) => startResize(e, "width", selNode.id, selBox.w)}
              onDoubleClick={() => resetWidth(selNode.id)}
            />
          )}
        </div>
      )}
      {gutters.map((g) => (
        <div
          key={g.colId}
          className="ov-gutter"
          style={{ left: g.x, top: g.y, height: g.h }}
          title="Drag to resize column · double-click to reset"
          onPointerDown={(e) => startResize(e, "column", g.colId, g.startPx)}
          onDoubleClick={() => resetWidth(g.colId)}
        />
      ))}
      {ind?.line && (
        <div
          className={`ov-drop${ind.line.vertical ? " vertical" : ""}`}
          style={
            ind.line.vertical ? { left: ind.line.x, top: ind.line.y, height: ind.line.length } : { left: ind.line.x, top: ind.line.y, width: ind.line.length }
          }
        />
      )}
      {ind?.into && <div className="ov-drop-into" style={pos(ind.into)} />}
      {selBox && selNode && !editing && !dragging && !isRoot && <FloatToolbar node={selNode} x={selBox.x + selBox.w / 2} y={selBox.y - 26} />}
      {measure &&
        createPortal(
          <div className="ov-measure" style={{ position: "fixed", left: measure.x, top: measure.y }}>
            {measure.text}
          </div>,
          document.body,
        )}
    </div>
  );
}

function pos(b: Box) {
  return { left: b.x, top: b.y, width: b.w, height: b.h };
}

function FloatToolbar({ node, x, y }: { node: SigNode; x: number; y: number }) {
  const nextVis = VIS_CYCLE[(VIS_CYCLE.indexOf(node.visibility) + 1) % VIS_CYCLE.length];
  return (
    <div
      className="float-toolbar"
      style={{ left: x, top: Math.max(-60, y) }}
      onPointerDown={(e) => e.stopPropagation()}
      role="toolbar"
      aria-label="Component actions"
    >
      <button title="Select parent (Esc)" aria-label="Select parent" onClick={selectParent}>
        <ArrowUpLeft size={14} />
      </button>
      <span className="sep" />
      <button title="Move up (Alt+↑)" aria-label="Move up" onClick={() => nudgeOrder(-1)}>
        <ArrowUp size={14} />
      </button>
      <button title="Move down (Alt+↓)" aria-label="Move down" onClick={() => nudgeOrder(1)}>
        <ArrowDown size={14} />
      </button>
      <button title="Duplicate (⌘D)" aria-label="Duplicate" onClick={duplicateSelected}>
        <Copy size={14} />
      </button>
      <button
        title={`Visibility: ${VISIBILITY_LABEL[node.visibility]} → ${VISIBILITY_LABEL[nextVis]}`}
        aria-label={`Visibility: ${VISIBILITY_LABEL[node.visibility]}. Change to ${VISIBILITY_LABEL[nextVis]}`}
        onClick={() => setVisibility(node.id, nextVis)}
        style={{ width: "auto", padding: "0 6px", fontSize: 10.5, fontWeight: 600 }}
      >
        {node.visibility === "both" ? "F+R" : node.visibility === "full" ? "Full" : node.visibility === "reply" ? "Reply" : "Hid"}
      </button>
      <button title={node.locked ? "Unlock" : "Lock"} aria-label={node.locked ? "Unlock" : "Lock"} onClick={() => toggleLock(node.id)}>
        {node.locked ? <Unlock size={14} /> : <Lock size={14} />}
      </button>
      <span className="sep" />
      <button title="Delete (⌫)" aria-label="Delete" onClick={removeSelected} disabled={node.locked}>
        <Trash2 size={14} />
      </button>
    </div>
  );
}

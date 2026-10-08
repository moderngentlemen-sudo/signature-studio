import { useEffect, useMemo, useRef } from "react";
import { useEditor } from "../../state/store";
import { Modal, Segmented, Slider, TextInput } from "../../ui/controls";
import { findNode } from "../../model/tree";
import { assetMeta, BUILTINS } from "../../model/builtins";
import { cropRect, frameSize } from "../../model/crop";
import { sourceUrl } from "../../state/assets";
import { resolveColor } from "../../render/email";
import type { ImageNode, StackNode } from "../../model/types";

const ASPECTS: { value: string; label: string; ratio?: number }[] = [
  { value: "orig", label: "Original" },
  { value: "1", label: "1:1", ratio: 1 },
  { value: "0.8", label: "4:5", ratio: 0.8 },
  { value: "1.5", label: "3:2", ratio: 1.5 },
  { value: "1.778", label: "16:9", ratio: 16 / 9 },
  { value: "4", label: "4:1", ratio: 4 },
];

/**
 * Crop, zoom, pan and shape an image. All changes are live on the canvas and
 * form a single undo step; Cancel restores the previous state.
 */
export function ImageDialog() {
  const open = useEditor((s) => s.dialog === "image");
  const nodeId = useEditor((s) => s.dialogArg);
  const project = useEditor((s) => s.project);
  const node = useMemo(() => (project && nodeId ? (findNode(project.root, nodeId) as ImageNode | null) : null), [project, nodeId]);
  const started = useRef(false);

  useEffect(() => {
    if (open && !started.current) {
      useEditor.getState().beginGesture();
      started.current = true;
    }
    if (!open) started.current = false;
  }, [open]);

  const finish = (commit: boolean) => {
    if (commit) useEditor.getState().endGesture();
    else useEditor.getState().cancelGesture();
    started.current = false;
    useEditor.getState().openDialog(null);
  };

  if (!open || !node || node.type !== "image" || !project) return <Modal open={false} onClose={() => finish(false)} title="" children={null} />;
  const p = node.props;
  const meta = assetMeta(project, p.assetId);
  const set = (recipe: (n: ImageNode) => void) =>
    useEditor.getState().editLive((d) => {
      const n = findNode(d.root as StackNode, node.id);
      if (n?.type === "image") recipe(n);
    });

  return (
    <Modal
      open={open}
      onClose={() => finish(false)}
      wide
      title="Crop & shape"
      subtitle="Drag the image to reposition it. The result is baked into the published image so every email app shows it exactly like this."
      footer={
        <>
          <button className="btn ghost" onClick={() => finish(false)}>
            Cancel
          </button>
          <button className="btn primary" onClick={() => finish(true)} data-testid="image-done">
            Done
          </button>
        </>
      }
    >
      {meta ? (
        <div className="image-editor">
          <CropStage
            node={node}
            naturalW={meta.width}
            naturalH={meta.height}
            tint={p.tint ? resolveColor(project.theme, p.tint) : undefined}
            onPan={(x, y) => set((n) => void (n.props.crop = { ...n.props.crop, x, y }))}
          />
          <div>
            <div className="field">
              <div className="label">Frame</div>
              <div className="chips">
                {ASPECTS.map((a) => (
                  <button
                    key={a.value}
                    className="chip"
                    aria-pressed={a.ratio ? Math.abs((p.aspect ?? 0) - a.ratio) < 0.01 : p.aspect === undefined}
                    onClick={() =>
                      set((n) => {
                        n.props.aspect = a.ratio;
                        if (n.props.shape === "circle" && a.ratio !== 1) n.props.shape = "rounded";
                      })
                    }
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <div className="label">Shape</div>
              <Segmented
                full
                value={p.shape}
                onChange={(v) =>
                  set((n) => {
                    n.props.shape = v;
                    if (v === "circle") n.props.aspect = 1;
                  })
                }
                options={[
                  { value: "rect", label: "Square corners" },
                  { value: "rounded", label: "Rounded" },
                  { value: "circle", label: "Circle" },
                ]}
              />
            </div>
            <Slider
              label="Zoom"
              min={1}
              max={4}
              step={0.01}
              value={p.crop.zoom}
              onChange={(v) => set((n) => void (n.props.crop = { ...n.props.crop, zoom: v }))}
            />
            {p.shape === "rounded" && (
              <Slider label="Corner radius" unit="px" min={0} max={80} value={p.radius} onChange={(v) => set((n) => void (n.props.radius = v))} />
            )}
            <Slider label="Display width" unit="px" min={16} max={600} value={p.width} onChange={(v) => set((n) => void (n.props.width = v))} />
            <TextInput label="Alternative text" value={p.alt} onChange={(v) => set((n) => void (n.props.alt = v))} hint="Describes the image" />
            <button className="btn small" onClick={() => set((n) => void (n.props.crop = { x: 0, y: 0, zoom: 1 }))}>
              Reset framing
            </button>
          </div>
        </div>
      ) : (
        <div className="empty">
          <strong>No image yet</strong>Upload an image first.
        </div>
      )}
    </Modal>
  );
}

function CropStage({
  node,
  naturalW,
  naturalH,
  tint,
  onPan,
}: {
  node: ImageNode;
  naturalW: number;
  naturalH: number;
  tint?: string;
  onPan: (x: number, y: number) => void;
}) {
  const p = node.props;
  const display = 300;
  const frame = frameSize(display, p.aspect, naturalW, naturalH);
  const fw = frame.aspect >= 1 ? display : Math.round(display * frame.aspect);
  const fh = Math.round(fw / frame.aspect);
  const rect = cropRect(naturalW, naturalH, frame.aspect, p.crop);
  const k = fw / rect.sw;
  const src = BUILTINS[p.assetId!]?.url ?? sourceUrl(p.assetId!) ?? "";
  const radius = p.shape === "circle" ? "50%" : p.shape === "rounded" ? `${(p.radius * fw) / p.width}px` : "0";

  const onPointerDown = (e: React.PointerEvent) => {
    const startX = e.clientX;
    const startY = e.clientY;
    const start = { ...p.crop };
    const maxX = (naturalW - rect.sw) / 2;
    const maxY = (naturalH - rect.sh) / 2;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / k;
      const dy = (ev.clientY - startY) / k;
      const x = maxX ? Math.max(-1, Math.min(1, start.x - dx / maxX)) : 0;
      const y = maxY ? Math.max(-1, Math.min(1, start.y - dy / maxY)) : 0;
      onPan(x, y);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const pos = { position: "absolute" as const, left: -rect.sx * k, top: -rect.sy * k, width: naturalW * k, height: naturalH * k };
  return (
    <div className="crop-stage">
      <div
        className="crop-frame"
        style={{ width: fw, height: fh, borderRadius: radius }}
        onPointerDown={onPointerDown}
        role="img"
        aria-label="Drag to reposition the image"
        tabIndex={0}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 0.2 : 0.05;
          if (e.key === "ArrowLeft") onPan(Math.min(1, p.crop.x + step), p.crop.y);
          if (e.key === "ArrowRight") onPan(Math.max(-1, p.crop.x - step), p.crop.y);
          if (e.key === "ArrowUp") onPan(p.crop.x, Math.min(1, p.crop.y + step));
          if (e.key === "ArrowDown") onPan(p.crop.x, Math.max(-1, p.crop.y - step));
        }}
      >
        {tint ? (
          <div style={{ ...pos, background: tint, WebkitMask: `url(${JSON.stringify(src)}) center/100% 100% no-repeat`, mask: `url(${JSON.stringify(src)}) center/100% 100% no-repeat` }} />
        ) : (
          <img src={src} alt="" draggable={false} style={{ ...pos, maxWidth: "none", userSelect: "none" }} />
        )}
      </div>
    </div>
  );
}

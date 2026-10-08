import { useMemo, useRef, useState } from "react";
import { Check, Crop, Send, Upload } from "lucide-react";
import { useEditor } from "../../state/store";
import { ProfileFields, SocialEditor } from "./ProfilePanel";
import { PalettePresets, TypePresets } from "./BrandPanel";
import { TemplateGrid } from "./TemplatesPanel";
import { walk } from "../../model/tree";
import type { ImageNode, StackNode } from "../../model/types";
import { ACCEPT_ATTR, ingestFile, sourceUrl, UploadError } from "../../state/assets";
import { BUILTINS } from "../../model/builtins";
import { suggestAlt } from "../Inspector";
import { nameOf } from "../../model/profile";

const ROLE_LABEL: Record<string, string> = { logo: "Logo", headshot: "Headshot", partner: "Partner logo", banner: "Banner", artwork: "Image" };

function Step(props: { n: number; title: string; sub: string; done: boolean; open: boolean; onOpen: () => void; children: React.ReactNode }) {
  return (
    <div className={`guided-step${props.done ? " done" : ""}`} data-open={props.open}>
      <button aria-expanded={props.open} onClick={props.onOpen}>
        <span className="num">{props.done && !props.open ? <Check size={13} /> : props.n}</span>
        <span className="title">
          {props.title}
          <small>{props.sub}</small>
        </span>
      </button>
      {props.open && <div className="guided-body">{props.children}</div>}
    </div>
  );
}

export function GuidedPanel() {
  const project = useEditor((s) => s.project!);
  const openDialog = useEditor((s) => s.openDialog);
  const [open, setOpen] = useState(1);
  const fields = project.profile.fields;

  const images = useMemo(() => {
    const out: ImageNode[] = [];
    walk(project.root, ({ node }) => {
      if (node.type === "image") out.push(node);
    });
    return out;
  }, [project.root]);

  const done = {
    1: !!nameOf(fields) && !!(fields.email || fields.phone),
    2: !!project.templateId,
    3: images.length === 0 || images.every((i) => i.props.assetId),
    4: project.profile.socials.some((s) => s.url),
  };

  return (
    <>
      <div className="panel-head">
        <h2>Create your signature</h2>
        <p>Four quick steps, then install in Gmail.</p>
      </div>
      <div className="panel-pad">
        <Step n={1} title="Your details" sub="Name, role and how to reach you" done={done[1]} open={open === 1} onOpen={() => setOpen(1)}>
          <ProfileFields keys={["fullName", "title", "company", "phone", "email", "website"]} />
          <button className="btn small" onClick={() => setOpen(2)}>
            Next: style
          </button>
        </Step>
        <Step n={2} title="Style" sub="Layout, colours and type" done={done[2]} open={open === 2} onOpen={() => setOpen(2)}>
          <h4 className="hint" style={{ margin: "4px 0 8px", fontWeight: 600 }}>
            Colours
          </h4>
          <PalettePresets />
          <h4 className="hint" style={{ margin: "14px 0 8px", fontWeight: 600 }}>
            Typography
          </h4>
          <TypePresets />
          <h4 className="hint" style={{ margin: "14px 0 8px", fontWeight: 600 }}>
            Layout
          </h4>
          <TemplateGrid compact onPick={(t) => openDialog("applyTemplate", t.id)} />
        </Step>
        <Step
          n={3}
          title="Logo & photo"
          sub={images.length ? `${images.length} image ${images.length === 1 ? "slot" : "slots"} in this layout` : "This layout has no images"}
          done={done[3]}
          open={open === 3}
          onOpen={() => setOpen(3)}
        >
          {images.length === 0 && <p className="hint">Choose a layout with a logo or headshot in Style, or add an image from Advanced mode.</p>}
          {images.map((img) => (
            <ImageSlot key={img.id} node={img} />
          ))}
        </Step>
        <Step n={4} title="Social links" sub="Optional" done={done[4]} open={open === 4} onOpen={() => setOpen(4)}>
          <SocialEditor />
        </Step>
        <button className="btn brass block" style={{ height: 40, marginTop: 6 }} onClick={() => openDialog("install")}>
          <Send size={15} /> Install in Gmail
        </button>
      </div>
    </>
  );
}

function ImageSlot({ node }: { node: ImageNode }) {
  const edit = useEditor((s) => s.edit);
  const toast = useEditor((s) => s.toast);
  const openDialog = useEditor((s) => s.openDialog);
  const company = useEditor((s) => s.project!.profile.fields.company || nameOf(s.project!.profile.fields));
  const ref = useRef<HTMLInputElement>(null);
  const src = node.props.assetId ? (BUILTINS[node.props.assetId]?.url ?? sourceUrl(node.props.assetId)) : null;
  return (
    <div className="contact-item" style={{ padding: 8, marginBottom: 8 }}>
      <div className="asset-tile" style={{ width: 52, height: 52, padding: 4, cursor: "default", borderRadius: node.props.shape === "circle" ? "50%" : 8 }}>
        {src ? <img src={src} alt="" style={BUILTINS[node.props.assetId!] ? { filter: "invert(1)" } : undefined} /> : <Upload size={16} className="muted" />}
      </div>
      <div className="grow">
        <strong style={{ fontWeight: 600 }}>{node.name ?? ROLE_LABEL[node.props.role]}</strong>
        <div className="hint">{node.props.assetId ? "Ready to crop or replace" : "Empty. Upload an image."}</div>
      </div>
      {node.props.assetId && (
        <button className="icon-btn small" aria-label="Crop and shape" onClick={() => openDialog("image", node.id)}>
          <Crop size={14} />
        </button>
      )}
      <button className="btn small" onClick={() => ref.current?.click()}>
        {node.props.assetId ? "Replace" : "Upload"}
      </button>
      <input
        ref={ref}
        type="file"
        accept={ACCEPT_ATTR}
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          try {
            const meta = await ingestFile(f);
            edit((d) => {
              d.assets[meta.id] = meta;
              walk(d.root as StackNode, ({ node: n }) => {
                if (n.id === node.id && n.type === "image") {
                  n.props.assetId = meta.id;
                  n.props.tint = undefined;
                  n.props.crop = { x: 0, y: 0, zoom: 1 };
                  if (!n.props.alt) n.props.alt = suggestAlt(n.props.role, company);
                }
              });
            });
            openDialog("image", node.id);
          } catch (err) {
            toast(err instanceof UploadError ? err.message : "Upload failed.", "error");
          }
        }}
      />
    </div>
  );
}

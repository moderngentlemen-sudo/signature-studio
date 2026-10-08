import { useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, BookmarkPlus, Crop, Eye, EyeOff, Link2, Link2Off, Plus, RotateCcw, Sparkles, Trash2, Upload, Wand2 } from "lucide-react";
import { useEditor } from "../state/store";
import { findNode, nodeLabel, typeLabel } from "../model/tree";
import { FONTS, fontDef } from "../model/fonts";
import { CONTACT_LABELS, FIELD_META, PROFILE_FIELDS, fieldValue } from "../model/profile";
import { PLATFORM_MAP } from "../model/social";
import { BUILTINS } from "../model/builtins";
import { resolveFont } from "../render/email";
import { uid } from "../lib/id";
import type {
  BoxStyle,
  ButtonNode,
  ContactItemKind,
  ContactNode,
  DividerNode,
  FieldNode,
  ImageNode,
  ProfileKey,
  QrNode,
  RowNode,
  SigNode,
  SocialIconStyle,
  SocialNode,
  StackNode,
  TextNode,
  TextStyle,
  Visibility,
} from "../model/types";
import { ColorField, Section, Segmented, Select, Slider, TextInput, Toggle } from "../ui/controls";
import { NodeIcon } from "../ui/nodeIcons";
import { duplicateSelected, removeSelected, updateNode } from "./actions";
import { applyCompactReply, autoFit } from "./assist";
import { ACCEPT_ATTR, ingestFile, sourceUrl, UploadError } from "../state/assets";
import { column } from "../model/factory";
import { saveComponent } from "./library";

export function Inspector() {
  const selection = useEditor((s) => s.selection);
  const project = useEditor((s) => s.project);
  const node = useMemo(() => (project && selection ? findNode(project.root, selection) : null), [project, selection]);
  if (!project) return null;
  if (!node || node.id === project.root.id) return <DocumentInspector />;
  return <NodeInspector node={node} key={node.id} />;
}

// ---------------------------------------------------------------------------
// Node inspector
// ---------------------------------------------------------------------------

function NodeInspector({ node }: { node: SigNode }) {
  const mode = useEditor((s) => s.mode);
  const advanced = mode === "advanced";
  const [naming, setNaming] = useState(false);
  const hasText =
    ["field", "text", "badge", "contact", "button", "stack", "column", "row"].includes(node.type) || (node.type === "social" && node.props.style === "text");
  return (
    <div data-testid="inspector">
      <div className="insp-head">
        <div className="ico">
          <NodeIcon type={node.type} size={16} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {naming ? (
            <input
              className="input small"
              autoFocus
              defaultValue={node.name ?? nodeLabel(node)}
              aria-label="Component name"
              onBlur={(e) => {
                const v = e.target.value.trim();
                updateNode(node.id, (n) => void (n.name = v || undefined));
                setNaming(false);
              }}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            />
          ) : (
            <h2
              onDoubleClick={() => setNaming(true)}
              title="Double-click to rename"
              style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            >
              {nodeLabel(node)}
            </h2>
          )}
          <div className="sub">{typeLabel(node.type)}</div>
        </div>
      </div>

      <div style={{ padding: "14px 16px 4px" }}>
        <div className="field">
          <div className="label">
            <span>Shows in</span>
            <span className="hint">One design, two signatures</span>
          </div>
          <Segmented<Visibility>
            full
            label="Visibility"
            value={node.visibility}
            onChange={(v) => updateNode(node.id, (n) => void (n.visibility = v))}
            options={[
              { value: "both", label: "Both" },
              { value: "full", label: "Full" },
              { value: "reply", label: "Reply" },
              { value: "hidden", label: "Hidden" },
            ]}
          />
        </div>
      </div>

      <Section title="Content">
        <ContentControls node={node} />
      </Section>

      {hasText && (
        <Section title="Typography" defaultOpen={advanced || node.type === "field" || node.type === "text"}>
          <TextControls node={node} />
        </Section>
      )}

      {node.type !== "spacer" && (
        <Section title="Box & spacing" defaultOpen={advanced && node.type !== "field"}>
          <BoxControls node={node} />
        </Section>
      )}

      <div style={{ padding: "14px 16px 24px", display: "flex", flexWrap: "wrap", gap: 6, borderTop: "1px solid var(--line)" }}>
        <button className="btn small" onClick={duplicateSelected}>
          Duplicate
        </button>
        <button className="btn small" onClick={() => saveComponent(node)} title="Save to My components for reuse">
          <BookmarkPlus size={13} /> Save component
        </button>
        <button
          className="btn small"
          title="Remove custom typography and box styling"
          onClick={() =>
            updateNode(node.id, (n) => {
              delete n.text;
              delete n.box;
            })
          }
        >
          <RotateCcw size={13} /> Reset style
        </button>
        <button className="btn small danger" onClick={removeSelected} disabled={node.locked}>
          <Trash2 size={13} /> Delete
        </button>
      </div>
    </div>
  );
}

function ContentControls({ node }: { node: SigNode }) {
  switch (node.type) {
    case "field":
      return <FieldControls node={node} />;
    case "text":
    case "badge":
      return <TextNodeControls node={node as TextNode} />;
    case "contact":
      return <ContactControls node={node} />;
    case "image":
      return <ImageControls node={node} />;
    case "social":
      return <SocialControls node={node} />;
    case "button":
      return <ButtonControls node={node} />;
    case "divider":
      return <DividerControls node={node} />;
    case "spacer":
      return (
        <Slider
          label="Height"
          unit="px"
          min={0}
          max={80}
          value={node.props.size}
          onChange={(v) => updateNode(node.id, (n: typeof node) => void (n.props.size = v), "size")}
        />
      );
    case "qr":
      return <QrControls node={node} />;
    case "stack":
    case "column":
      return (
        <>
          <Slider
            label="Gap between items"
            unit="px"
            min={0}
            max={48}
            value={node.props.gap ?? useEditor.getState().project!.theme.gap}
            onChange={(v) => updateNode(node.id, (n: StackNode) => void (n.props.gap = v), "gap")}
          />
          {node.type === "column" && (
            <Segmented
              full
              label="Vertical alignment"
              value={node.box?.valign ?? "top"}
              onChange={(v) => updateNode(node.id, (n) => void (n.box = { ...n.box, valign: v as BoxStyle["valign"] }))}
              options={[
                { value: "top", label: "Top" },
                { value: "middle", label: "Middle" },
                { value: "bottom", label: "Bottom" },
              ]}
            />
          )}
        </>
      );
    case "row":
      return <RowControls node={node} />;
  }
}

function FieldControls({ node }: { node: FieldNode }) {
  const profile = useEditor((s) => s.project!.profile);
  const edit = useEditor((s) => s.edit);
  const p = node.props;
  const meta = FIELD_META[p.field];
  const value = p.detached ? (p.text ?? "") : p.field === "fullName" ? fieldValue(profile, "fullName") : profile.fields[p.field];
  return (
    <>
      {p.detached ? (
        <div className="connected" style={{ background: "var(--panel-2)" }}>
          <Link2Off size={14} />
          <span style={{ flex: 1 }}>Independent text. Profile changes won't affect it.</span>
          <button
            className="btn small"
            onClick={() =>
              updateNode(node.id, (n: FieldNode) => {
                n.props.detached = false;
                delete n.props.text;
              })
            }
          >
            Reconnect
          </button>
        </div>
      ) : (
        <div className="connected">
          <Link2 size={14} />
          <span style={{ flex: 1 }}>
            Connected to your profile's <strong>{meta.label.toLowerCase()}</strong>. Edits update everywhere.
          </span>
          <button
            className="btn small"
            title="Use independent text for this component only"
            onClick={() =>
              updateNode(node.id, (n: FieldNode) => {
                n.props.detached = true;
                n.props.text = value;
              })
            }
          >
            Detach
          </button>
        </div>
      )}
      <TextInput
        label={meta.label}
        value={value}
        multiline={meta.multiline}
        placeholder={meta.placeholder}
        onChange={(v) =>
          p.detached
            ? updateNode(node.id, (n: FieldNode) => void (n.props.text = v), "text")
            : edit((d) => {
                const key: ProfileKey = p.field === "fullName" && d.profile.fields.displayName.trim() ? "displayName" : p.field;
                d.profile.fields[key] = v;
              }, `profile:${p.field}`)
        }
      />
      <Select<ProfileKey>
        label="Shows"
        value={p.field}
        onChange={(v) => updateNode(node.id, (n: FieldNode) => void (n.props.field = v))}
        options={PROFILE_FIELDS.map((f) => ({ value: f.key, label: f.label }))}
      />
      <div className="grid2">
        <TextInput
          label="Before"
          value={p.prefix ?? ""}
          placeholder="e.g. ("
          onChange={(v) => updateNode(node.id, (n: FieldNode) => void (n.props.prefix = v || undefined), "prefix")}
        />
        <TextInput
          label="After"
          value={p.suffix ?? ""}
          placeholder="e.g. )"
          onChange={(v) => updateNode(node.id, (n: FieldNode) => void (n.props.suffix = v || undefined), "suffix")}
        />
      </div>
      {p.field === "fullName" && (
        <Toggle
          label="Show as initials (monogram)"
          checked={p.format === "initials"}
          onChange={(v) => updateNode(node.id, (n: FieldNode) => void (n.props.format = v ? "initials" : undefined))}
        />
      )}
      {["phone", "mobile", "email", "website", "booking"].includes(p.field) && (
        <Toggle
          label="Make clickable"
          checked={p.link !== "none"}
          onChange={(v) => updateNode(node.id, (n: FieldNode) => void (n.props.link = v ? "auto" : "none"))}
        />
      )}
    </>
  );
}

function TextNodeControls({ node }: { node: TextNode }) {
  return (
    <>
      <TextInput
        label="Text"
        multiline
        value={node.props.text}
        onChange={(v) => updateNode(node.id, (n: TextNode) => void (n.props.text = v), "text")}
        hint="Shift+Enter for a new line on canvas"
      />
      <TextInput
        label="Link (optional)"
        value={node.props.href ?? ""}
        placeholder="https://…"
        onChange={(v) => updateNode(node.id, (n: TextNode) => void (n.props.href = v || undefined), "href")}
      />
    </>
  );
}

const CONTACT_KINDS: { kind: ContactItemKind; label: string }[] = [
  { kind: "phone", label: "Phone" },
  { kind: "mobile", label: "Mobile" },
  { kind: "email", label: "Email" },
  { kind: "website", label: "Website" },
  { kind: "address", label: "Address" },
];

function ContactControls({ node }: { node: ContactNode }) {
  const profile = useEditor((s) => s.project!.profile);
  const p = node.props;
  const present = new Set(p.items.map((i) => (i.kind === "custom" ? `custom:${i.customId}` : i.kind)));
  const addable = [
    ...CONTACT_KINDS.filter((k) => !present.has(k.kind)).map((k) => ({ value: k.kind as string, label: k.label })),
    ...profile.custom.filter((c) => !present.has(`custom:${c.id}`)).map((c) => ({ value: `custom:${c.id}`, label: c.label })),
  ];
  const label = (it: ContactNode["props"]["items"][number]) =>
    it.kind === "custom" ? (profile.custom.find((c) => c.id === it.customId)?.label ?? "Custom") : CONTACT_LABELS[it.kind].full;
  const value = (it: ContactNode["props"]["items"][number]) =>
    it.kind === "custom" ? (profile.custom.find((c) => c.id === it.customId)?.value ?? "") : profile.fields[CONTACT_LABELS[it.kind].field];
  return (
    <>
      <div className="field">
        <div className="label">
          <span>Items</span>
          <span className="hint">Values come from your profile</span>
        </div>
        <div className="contact-items">
          {p.items.map((it, i) => (
            <div className="contact-item" key={it.id}>
              <button
                className="icon-btn small"
                aria-label={it.visible ? `Hide ${label(it)}` : `Show ${label(it)}`}
                onClick={() => updateNode(node.id, (n: ContactNode) => void (n.props.items[i].visible = !it.visible))}
              >
                {it.visible ? <Eye size={13} /> : <EyeOff size={13} />}
              </button>
              <span className="grow" style={{ opacity: it.visible ? 1 : 0.5 }}>
                {label(it)}
                {!value(it) && <span className="hint"> · empty</span>}
              </span>
              <button
                className="icon-btn small"
                aria-label="Move up"
                disabled={i === 0}
                onClick={() => updateNode(node.id, (n: ContactNode) => void n.props.items.splice(i - 1, 0, n.props.items.splice(i, 1)[0]))}
              >
                <ArrowUp size={13} />
              </button>
              <button
                className="icon-btn small"
                aria-label="Move down"
                disabled={i === p.items.length - 1}
                onClick={() => updateNode(node.id, (n: ContactNode) => void n.props.items.splice(i + 1, 0, n.props.items.splice(i, 1)[0]))}
              >
                <ArrowDown size={13} />
              </button>
              <button
                className="icon-btn small"
                aria-label={`Remove ${label(it)}`}
                onClick={() => updateNode(node.id, (n: ContactNode) => void n.props.items.splice(i, 1))}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
        {addable.length > 0 && (
          <select
            className="select small"
            value=""
            aria-label="Add contact item"
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              updateNode(
                node.id,
                (n: ContactNode) =>
                  void n.props.items.push(
                    v.startsWith("custom:")
                      ? { id: uid("c"), kind: "custom", customId: v.slice(7), visible: true }
                      : { id: uid("c"), kind: v as ContactItemKind, visible: true },
                  ),
              );
            }}
          >
            <option value="">+ Add item…</option>
            {addable.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="field">
        <div className="label">Layout</div>
        <Segmented
          full
          value={p.layout}
          onChange={(v) => updateNode(node.id, (n: ContactNode) => void (n.props.layout = v))}
          options={[
            { value: "stacked", label: "Stacked" },
            { value: "inline", label: "Inline" },
            { value: "grid", label: "Grid" },
          ]}
        />
      </div>
      <div className="field">
        <div className="label">Labels</div>
        <Segmented
          full
          value={p.labels}
          onChange={(v) => updateNode(node.id, (n: ContactNode) => void (n.props.labels = v))}
          options={[
            { value: "none", label: "None" },
            { value: "short", label: "T / E" },
            { value: "full", label: "Phone / Email" },
          ]}
        />
      </div>
      {p.layout === "inline" && (
        <div className="field">
          <div className="label">Separator</div>
          <Segmented
            full
            value={p.separator}
            onChange={(v) => updateNode(node.id, (n: ContactNode) => void (n.props.separator = v))}
            options={[
              { value: "dot", label: "·" },
              { value: "bar", label: "|" },
              { value: "slash", label: "/" },
              { value: "dash", label: "–" },
              { value: "diamond", label: "◆" },
              { value: "none", label: "None", title: "No symbol. Readable spacing is kept." },
            ]}
          />
        </div>
      )}
      <Slider
        label={p.layout === "inline" ? "Space between items" : "Space between rows"}
        unit="px"
        min={0}
        max={24}
        value={p.gap}
        onChange={(v) => updateNode(node.id, (n: ContactNode) => void (n.props.gap = v), "gap")}
      />
      {p.labels !== "none" && (
        <ColorField
          label="Label colour"
          value={p.labelColor}
          onChange={(v) => updateNode(node.id, (n: ContactNode) => void (n.props.labelColor = v), "labelColor")}
        />
      )}
      <Toggle label="Keep each item on one line" checked={!!p.nowrap} onChange={(v) => updateNode(node.id, (n: ContactNode) => void (n.props.nowrap = v))} />
    </>
  );
}

function ImageControls({ node }: { node: ImageNode }) {
  const project = useEditor((s) => s.project!);
  const openDialog = useEditor((s) => s.openDialog);
  const toast = useEditor((s) => s.toast);
  const fileRef = useRef<HTMLInputElement>(null);
  const p = node.props;
  const uploads = Object.values(project.assets);
  const builtins = Object.values(BUILTINS);
  const isBuiltin = p.assetId?.startsWith("builtin:");

  const upload = async (file: File) => {
    try {
      const meta = await ingestFile(file);
      useEditor.getState().edit((d) => {
        d.assets[meta.id] = meta;
        const n = findNode(d.root as StackNode, node.id) as ImageNode | null;
        if (n) {
          n.props.assetId = meta.id;
          n.props.crop = { x: 0, y: 0, zoom: 1 };
          n.props.tint = undefined;
          if (!n.props.alt) n.props.alt = suggestAlt(n.props.role, project.profile.fields.company || project.profile.fields.fullName);
        }
      });
      openDialog("image", node.id);
    } catch (err) {
      toast(err instanceof UploadError ? err.message : "Upload failed.", "error");
    }
  };

  return (
    <>
      <div className="field">
        <div className="label">
          <span>Image</span>
          <span className="hint">PNG, JPEG, WebP, GIF or SVG</span>
        </div>
        <div className="asset-grid">
          {[...builtins, ...uploads].map((a) => (
            <button
              key={a.id}
              className="asset-tile"
              aria-pressed={p.assetId === a.id}
              title={a.name}
              aria-label={`Use ${a.name}`}
              onClick={() =>
                updateNode(node.id, (n: ImageNode) => {
                  n.props.assetId = a.id;
                  n.props.crop = { x: 0, y: 0, zoom: 1 };
                  if (a.id.startsWith("builtin:")) n.props.tint = n.props.tint ?? "$ink";
                  else n.props.tint = undefined;
                  if (!n.props.alt) n.props.alt = "description" in a ? (a as { description: string }).description : a.name;
                })
              }
            >
              {"url" in a ? (
                <div
                  style={{
                    width: "100%",
                    height: "60%",
                    background: "#16150f",
                    WebkitMask: `url(${(a as { url: string }).url}) center/contain no-repeat`,
                    mask: `url(${(a as { url: string }).url}) center/contain no-repeat`,
                  }}
                />
              ) : (
                <img src={sourceUrl(a.id) ?? ""} alt="" />
              )}
            </button>
          ))}
          <button className="asset-tile" onClick={() => fileRef.current?.click()} aria-label="Upload image" style={{ borderStyle: "dashed" }}>
            <Upload size={18} />
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT_ATTR}
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
            e.target.value = "";
          }}
        />
      </div>
      {p.assetId && (
        <div className="row" style={{ marginBottom: 12 }}>
          <button className="btn small" onClick={() => openDialog("image", node.id)}>
            <Crop size={13} /> Crop & shape
          </button>
          <button className="btn small" onClick={() => updateNode(node.id, (n: ImageNode) => void (n.props.assetId = undefined))}>
            Remove image
          </button>
        </div>
      )}
      <Slider
        label="Width"
        unit="px"
        min={16}
        max={600}
        value={p.width}
        onChange={(v) => updateNode(node.id, (n: ImageNode) => void (n.props.width = v), "width")}
        hint="Drag the corner on canvas"
      />
      <div className="field">
        <div className="label">Shape</div>
        <Segmented
          full
          value={p.shape}
          onChange={(v) =>
            updateNode(node.id, (n: ImageNode) => {
              n.props.shape = v;
              if (v === "circle") n.props.aspect = 1;
            })
          }
          options={[
            { value: "rect", label: "Original" },
            { value: "rounded", label: "Rounded" },
            { value: "circle", label: "Circle" },
          ]}
        />
      </div>
      {p.shape === "rounded" && (
        <Slider
          label="Corner radius"
          unit="px"
          min={0}
          max={60}
          value={p.radius}
          onChange={(v) => updateNode(node.id, (n: ImageNode) => void (n.props.radius = v), "radius")}
        />
      )}
      {isBuiltin && (
        <ColorField label="Artwork colour" value={p.tint} onChange={(v) => updateNode(node.id, (n: ImageNode) => void (n.props.tint = v ?? "$ink"), "tint")} />
      )}
      <TextInput
        label="Alternative text"
        hint="Read aloud and shown if images are blocked"
        value={p.alt}
        onChange={(v) => updateNode(node.id, (n: ImageNode) => void (n.props.alt = v), "alt")}
      />
      <TextInput
        label="Link (optional)"
        placeholder="https://…"
        value={p.href ?? ""}
        onChange={(v) => updateNode(node.id, (n: ImageNode) => void (n.props.href = v || undefined), "href")}
      />
      <Select
        label="Role"
        value={p.role}
        onChange={(v) => updateNode(node.id, (n: ImageNode) => void (n.props.role = v))}
        hint="Helps templates keep your images"
        options={[
          { value: "logo", label: "Logo" },
          { value: "headshot", label: "Headshot" },
          { value: "partner", label: "Partner logo" },
          { value: "banner", label: "Banner" },
          { value: "artwork", label: "Artwork" },
        ]}
      />
    </>
  );
}

export function suggestAlt(role: ImageNode["props"]["role"], name: string): string {
  const who = name.trim();
  switch (role) {
    case "logo":
      return who ? `${who} logo` : "Logo";
    case "headshot":
      return who ? `Photo of ${who}` : "Portrait";
    case "partner":
      return "Partner logo";
    case "banner":
      return who ? `${who} banner` : "Banner";
    default:
      return who || "Image";
  }
}

function SocialControls({ node }: { node: SocialNode }) {
  const socials = useEditor((s) => s.project!.profile.socials);
  const set = useEditor((s) => s.set);
  const p = node.props;
  const styles: { value: SocialIconStyle; label: string }[] = [
    { value: "circle", label: "Circle" },
    { value: "bare", label: "Bare" },
    { value: "outline", label: "Outline" },
    { value: "tile", label: "Tile" },
    { value: "letter", label: "Letter" },
    { value: "text", label: "Text" },
  ];
  return (
    <>
      <div className="field">
        <div className="label">Style</div>
        <div className="chips">
          {styles.map((s) => (
            <button
              key={s.value}
              className="chip"
              aria-pressed={p.style === s.value}
              onClick={() => updateNode(node.id, (n: SocialNode) => void (n.props.style = s.value))}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      {p.style !== "text" && (
        <>
          <Slider
            label="Icon size"
            unit="px"
            min={12}
            max={48}
            value={p.size}
            onChange={(v) => updateNode(node.id, (n: SocialNode) => void (n.props.size = v), "size")}
          />
          <Slider
            label="Spacing"
            unit="px"
            min={0}
            max={24}
            value={p.gap}
            onChange={(v) => updateNode(node.id, (n: SocialNode) => void (n.props.gap = v), "gap")}
          />
          {(p.style === "circle" || p.style === "tile" || p.style === "letter") && (
            <ColorField
              label="Shape colour"
              value={p.background}
              onChange={(v) => updateNode(node.id, (n: SocialNode) => void (n.props.background = v ?? "$ink"), "bg")}
            />
          )}
        </>
      )}
      <ColorField
        label={p.style === "text" ? "Link colour" : "Icon colour"}
        value={p.color}
        onChange={(v) => updateNode(node.id, (n: SocialNode) => void (n.props.color = v ?? "$ink"), "color")}
      />
      <div className="field">
        <div className="label">
          <span>Show in this block</span>
          <button className="btn small ghost" onClick={() => set({ leftPanel: "profile", mobileSheet: "left" })}>
            Edit links
          </button>
        </div>
        {socials.length === 0 && <div className="hint">No social links yet. Add them in your profile.</div>}
        <div className="contact-items">
          {socials.map((s) => {
            const hidden = p.hidden.includes(s.id);
            return (
              <div className="contact-item" key={s.id}>
                <button
                  className="icon-btn small"
                  aria-label={hidden ? `Show ${PLATFORM_MAP[s.platform].label}` : `Hide ${PLATFORM_MAP[s.platform].label}`}
                  onClick={() =>
                    updateNode(node.id, (n: SocialNode) => {
                      n.props.hidden = hidden ? n.props.hidden.filter((x) => x !== s.id) : [...n.props.hidden, s.id];
                    })
                  }
                >
                  {hidden ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
                <span className="grow" style={{ opacity: hidden || !s.visible ? 0.5 : 1 }}>
                  {s.label || PLATFORM_MAP[s.platform].label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function ButtonControls({ node }: { node: ButtonNode }) {
  const p = node.props;
  return (
    <>
      <TextInput label="Label" value={p.label} onChange={(v) => updateNode(node.id, (n: ButtonNode) => void (n.props.label = v), "label")} />
      <Select<string>
        label="Links to"
        value={p.href ? "custom" : (p.field ?? "custom")}
        onChange={(v) =>
          updateNode(node.id, (n: ButtonNode) => {
            if (v === "custom") n.props.field = undefined;
            else {
              n.props.field = v as ProfileKey;
              n.props.href = "";
            }
          })
        }
        options={[
          { value: "booking", label: "Profile: booking link" },
          { value: "website", label: "Profile: website" },
          { value: "email", label: "Profile: email" },
          { value: "phone", label: "Profile: phone" },
          { value: "custom", label: "Custom address" },
        ]}
      />
      {(p.href || !p.field) && (
        <TextInput
          label="Address"
          placeholder="https://…"
          value={p.href}
          onChange={(v) => updateNode(node.id, (n: ButtonNode) => void (n.props.href = v), "href")}
        />
      )}
      <div className="field">
        <div className="label">Style</div>
        <Segmented
          full
          value={p.variant}
          onChange={(v) => updateNode(node.id, (n: ButtonNode) => void (n.props.variant = v))}
          options={[
            { value: "solid", label: "Solid" },
            { value: "outline", label: "Outline" },
            { value: "link", label: "Text link" },
          ]}
        />
      </div>
      <ColorField
        label={p.variant === "solid" ? "Button colour" : "Colour"}
        value={p.color}
        onChange={(v) => updateNode(node.id, (n: ButtonNode) => void (n.props.color = v ?? "$ink"), "color")}
      />
      {p.variant === "solid" && (
        <ColorField
          label="Text colour"
          value={p.textColor}
          onChange={(v) => updateNode(node.id, (n: ButtonNode) => void (n.props.textColor = v ?? "#ffffff"), "textColor")}
        />
      )}
      {p.variant !== "link" && (
        <>
          <Slider
            label="Corner radius"
            unit="px"
            min={0}
            max={24}
            value={p.radius}
            onChange={(v) => updateNode(node.id, (n: ButtonNode) => void (n.props.radius = v), "radius")}
          />
          <div className="grid2">
            <Slider
              label="Padding X"
              min={4}
              max={40}
              value={p.padX}
              onChange={(v) => updateNode(node.id, (n: ButtonNode) => void (n.props.padX = v), "padX")}
            />
            <Slider
              label="Padding Y"
              min={2}
              max={20}
              value={p.padY}
              onChange={(v) => updateNode(node.id, (n: ButtonNode) => void (n.props.padY = v), "padY")}
            />
          </div>
        </>
      )}
    </>
  );
}

function DividerControls({ node }: { node: DividerNode }) {
  const p = node.props;
  return (
    <>
      <div className="field">
        <div className="label">Direction</div>
        <Segmented
          full
          value={p.orientation}
          onChange={(v) => updateNode(node.id, (n: DividerNode) => void (n.props.orientation = v))}
          options={[
            { value: "horizontal", label: "Horizontal" },
            { value: "vertical", label: "Vertical" },
          ]}
        />
      </div>
      <Slider
        label="Thickness"
        unit="px"
        min={1}
        max={8}
        value={p.thickness}
        onChange={(v) => updateNode(node.id, (n: DividerNode) => void (n.props.thickness = v), "thickness")}
      />
      <Slider
        label={p.orientation === "vertical" ? "Height" : "Length"}
        unit="px"
        min={0}
        max={600}
        value={p.length ?? 0}
        hint={!p.length && p.orientation === "horizontal" ? "0 = full width" : undefined}
        onChange={(v) => updateNode(node.id, (n: DividerNode) => void (n.props.length = v || undefined), "length")}
      />
      <ColorField label="Colour" value={p.color} onChange={(v) => updateNode(node.id, (n: DividerNode) => void (n.props.color = v ?? "$rule"), "color")} />
      <div className="field">
        <div className="label">Line</div>
        <Segmented
          full
          value={p.style}
          onChange={(v) => updateNode(node.id, (n: DividerNode) => void (n.props.style = v))}
          options={[
            { value: "solid", label: "Solid" },
            { value: "dashed", label: "Dashed" },
            { value: "dotted", label: "Dotted" },
          ]}
        />
      </div>
    </>
  );
}

function QrControls({ node }: { node: QrNode }) {
  const p = node.props;
  return (
    <>
      <Select<string>
        label="Encodes"
        value={p.value ? "custom" : (p.field ?? "website")}
        onChange={(v) =>
          updateNode(node.id, (n: QrNode) => {
            if (v === "custom") {
              n.props.field = undefined;
              n.props.value = n.props.value || "https://";
            } else {
              n.props.field = v as ProfileKey;
              n.props.value = "";
            }
          })
        }
        options={[
          { value: "website", label: "Profile: website" },
          { value: "booking", label: "Profile: booking link" },
          { value: "email", label: "Profile: email" },
          { value: "custom", label: "Custom text or link" },
        ]}
      />
      {!p.field && <TextInput label="Value" value={p.value} onChange={(v) => updateNode(node.id, (n: QrNode) => void (n.props.value = v), "value")} />}
      <Slider label="Size" unit="px" min={40} max={160} value={p.size} onChange={(v) => updateNode(node.id, (n: QrNode) => void (n.props.size = v), "size")} />
      <ColorField label="Colour" value={p.color} onChange={(v) => updateNode(node.id, (n: QrNode) => void (n.props.color = v ?? "$ink"), "color")} />
      <div className="hint">Keep strong contrast so phones can scan it.</div>
    </>
  );
}

function RowControls({ node }: { node: RowNode }) {
  const p = node.props;
  return (
    <>
      <Slider
        label="Gap between columns"
        unit="px"
        min={0}
        max={60}
        value={p.gap ?? 20}
        onChange={(v) => updateNode(node.id, (n: RowNode) => void (n.props.gap = v), "gap")}
      />
      <Toggle
        label="Rule between columns"
        checked={!!p.divider?.width}
        onChange={(v) => updateNode(node.id, (n: RowNode) => void (n.props.divider = v ? { width: 1, color: "$rule" } : undefined))}
      />
      {p.divider?.width ? (
        <ColorField
          label="Rule colour"
          value={p.divider.color}
          onChange={(v) =>
            updateNode(node.id, (n: RowNode) => void (n.props.divider = { width: n.props.divider?.width ?? 1, color: v ?? "$rule" }), "divColor")
          }
        />
      ) : null}
      <div className="row" style={{ marginTop: 4 }}>
        <span className="hint" style={{ flex: 1 }}>
          {node.children.length} columns · drag gutters on canvas to resize
        </span>
        <button className="btn small" onClick={() => updateNode(node.id, (n: RowNode) => void n.children.push(column([])))}>
          <Plus size={13} /> Column
        </button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Typography & box
// ---------------------------------------------------------------------------

function TextControls({ node }: { node: SigNode }) {
  const theme = useEditor((s) => s.project!.theme);
  const t = node.text ?? {};
  const set = <K extends keyof TextStyle>(k: K, v: TextStyle[K], coalesce = true) =>
    updateNode(
      node.id,
      (n) => {
        n.text = { ...n.text, [k]: v };
        if (v === undefined) delete (n.text as Record<string, unknown>)[k];
      },
      coalesce ? `text.${k}` : undefined,
    );
  const fontId = resolveFont(theme, t.font);
  const def = fontDef(fontId);
  const inheritedSize = t.size ?? theme.size;
  return (
    <>
      <Select<string>
        label="Font"
        value={t.font ?? ""}
        onChange={(v) => set("font", v || undefined, false)}
        hint={def.safe ? "Email-safe" : `Recipients likely see ${def.seenAs}`}
        options={[
          { value: "", label: "Inherit" },
          { value: "$display", label: `Theme display · ${fontDef(theme.fonts.display).label}` },
          { value: "$body", label: `Theme body · ${fontDef(theme.fonts.body).label}` },
          ...FONTS.map((f) => ({ value: f.id, label: `${f.label}${f.safe ? " ✓" : ""}` })),
        ]}
      />
      <div className="grid2">
        <Slider label="Size" unit="px" min={8} max={48} step={0.5} value={inheritedSize} onChange={(v) => set("size", v)} />
        <Select<string>
          label="Weight"
          value={String(t.weight ?? "")}
          onChange={(v) => set("weight", v ? Number(v) : undefined, false)}
          options={[
            { value: "", label: "Inherit" },
            { value: "300", label: "Light" },
            { value: "400", label: "Regular" },
            { value: "500", label: "Medium" },
            { value: "600", label: "Semibold" },
            { value: "700", label: "Bold" },
          ]}
        />
      </div>
      <ColorField label="Colour" allowInherit value={t.color} onChange={(v) => set("color", v)} />
      <div className="field">
        <div className="label">Style</div>
        <div className="row" style={{ flexWrap: "wrap" }}>
          <Segmented
            value={t.align ?? ""}
            label="Alignment"
            onChange={(v) => set("align", (v || undefined) as TextStyle["align"], false)}
            options={[
              { value: "", label: "Auto" },
              { value: "left", label: "Left" },
              { value: "center", label: "Centre" },
              { value: "right", label: "Right" },
            ]}
          />
          <button className="chip" aria-pressed={!!t.italic} onClick={() => set("italic", !t.italic || undefined, false)} style={{ fontStyle: "italic" }}>
            Italic
          </button>
          <button
            className="chip"
            aria-pressed={!!t.underline}
            onClick={() => set("underline", !t.underline || undefined, false)}
            style={{ textDecoration: "underline" }}
          >
            Underline links
          </button>
        </div>
      </div>
      <div className="field">
        <div className="label">Case</div>
        <Segmented
          full
          value={t.transform ?? "none"}
          onChange={(v) => set("transform", v === "none" ? undefined : (v as TextStyle["transform"]), false)}
          options={[
            { value: "none", label: "As typed" },
            { value: "uppercase", label: "AA" },
            { value: "lowercase", label: "aa" },
            { value: "capitalize", label: "Aa" },
          ]}
        />
      </div>
      <div className="grid2">
        <Slider label="Letter spacing" unit="em" min={-0.05} max={0.4} step={0.01} value={t.tracking ?? 0} onChange={(v) => set("tracking", v || undefined)} />
        <Slider label="Line height" min={0.9} max={2.2} step={0.05} value={t.lineHeight ?? theme.lineHeight} onChange={(v) => set("lineHeight", v)} />
      </div>
    </>
  );
}

function BoxControls({ node }: { node: SigNode }) {
  const b = node.box ?? {};
  const set = <K extends keyof BoxStyle>(k: K, v: BoxStyle[K], coalesce = true) =>
    updateNode(
      node.id,
      (n) => {
        n.box = { ...n.box, [k]: v };
        if (v === undefined) delete (n.box as Record<string, unknown>)[k];
      },
      coalesce ? `box.${k}` : undefined,
    );
  return (
    <>
      <div className="grid2">
        <Slider label="Padding X" unit="px" min={0} max={48} value={b.padX ?? 0} onChange={(v) => set("padX", v || undefined)} />
        <Slider label="Padding Y" unit="px" min={0} max={48} value={b.padY ?? 0} onChange={(v) => set("padY", v || undefined)} />
      </div>
      <ColorField label="Background" allowInherit value={b.background} onChange={(v) => set("background", v)} />
      <div className="grid2">
        <Slider label="Border" unit="px" min={0} max={6} value={b.borderWidth ?? 0} onChange={(v) => set("borderWidth", v || undefined)} />
        <Slider label="Corner radius" unit="px" min={0} max={32} value={b.radius ?? 0} onChange={(v) => set("radius", v || undefined)} />
      </div>
      {!!b.borderWidth && (
        <>
          <ColorField label="Border colour" value={b.borderColor} onChange={(v) => set("borderColor", v)} />
          <Select<string>
            label="Border sides"
            value={b.borderSides ?? "all"}
            onChange={(v) => set("borderSides", v as BoxStyle["borderSides"], false)}
            options={[
              { value: "all", label: "All sides" },
              { value: "left", label: "Left" },
              { value: "right", label: "Right" },
              { value: "top", label: "Top" },
              { value: "bottom", label: "Bottom" },
              { value: "y", label: "Top & bottom" },
              { value: "x", label: "Left & right" },
            ]}
          />
        </>
      )}
      <Slider
        label="Width"
        unit="px"
        min={0}
        max={700}
        value={b.width ?? 0}
        hint={b.width ? undefined : "0 = natural"}
        onChange={(v) => set("width", v || undefined)}
      />
      <div className="field">
        <div className="label">Align in parent</div>
        <Segmented
          full
          value={b.align ?? ""}
          onChange={(v) => set("align", (v || undefined) as BoxStyle["align"], false)}
          options={[
            { value: "", label: "Auto" },
            { value: "left", label: "Left" },
            { value: "center", label: "Centre" },
            { value: "right", label: "Right" },
          ]}
        />
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Document inspector (nothing selected)
// ---------------------------------------------------------------------------

function DocumentInspector() {
  const project = useEditor((s) => s.project!);
  const edit = useEditor((s) => s.edit);
  const toast = useEditor((s) => s.toast);
  const measured = useEditor((s) => s.measuredWidth);
  const theme = project.theme;
  const setTheme = <K extends keyof typeof theme>(k: K, v: (typeof theme)[K], key = true) =>
    edit((d) => void (d.theme[k] = v as never), key ? `theme.${String(k)}` : undefined);
  const [fitting, setFitting] = useState(false);
  return (
    <div data-testid="document-inspector">
      <div className="insp-head">
        <div className="ico">
          <Sparkles size={16} />
        </div>
        <div>
          <h2>Signature</h2>
          <div className="sub">Select a component to edit it</div>
        </div>
      </div>
      <Section title="Size">
        <Slider
          label="Target width"
          unit="px"
          min={280}
          max={800}
          step={10}
          value={theme.width}
          onChange={(v) => setTheme("width", v)}
          hint={`Now ${Math.round(measured)}px`}
        />
        <Slider label="Scale" unit="%" min={50} max={150} value={Math.round(theme.scale * 100)} onChange={(v) => setTheme("scale", v / 100)} />
        <button
          className="btn block"
          disabled={fitting}
          onClick={async () => {
            setFitting(true);
            const r = await autoFit();
            setFitting(false);
            toast(r.message, r.ok ? "success" : "info");
          }}
        >
          <Wand2 size={14} /> {fitting ? "Fitting…" : "Auto-fit to width"}
        </button>
      </Section>
      <Section title="Colours">
        {(["ink", "muted", "accent", "rule", "surface"] as const).map((k) => (
          <ThemeColor key={k} name={k} />
        ))}
        <ColorField
          label="Signature background"
          value={theme.background === "transparent" ? undefined : theme.background}
          allowInherit
          onChange={(v) => setTheme("background", v ?? "transparent", false)}
        />
      </Section>
      <Section title="Typography">
        <Select<string>
          label="Display font"
          hint={fontDef(theme.fonts.display).safe ? "Email-safe" : `Falls back to ${fontDef(theme.fonts.display).seenAs}`}
          value={theme.fonts.display}
          onChange={(v) => edit((d) => void (d.theme.fonts.display = v))}
          options={FONTS.map((f) => ({ value: f.id, label: `${f.label}${f.safe ? " ✓" : ""}` }))}
        />
        <Select<string>
          label="Body font"
          hint={fontDef(theme.fonts.body).safe ? "Email-safe" : `Falls back to ${fontDef(theme.fonts.body).seenAs}`}
          value={theme.fonts.body}
          onChange={(v) => edit((d) => void (d.theme.fonts.body = v))}
          options={FONTS.map((f) => ({ value: f.id, label: `${f.label}${f.safe ? " ✓" : ""}` }))}
        />
        <div className="grid2">
          <Slider label="Base size" unit="px" min={10} max={18} step={0.5} value={theme.size} onChange={(v) => setTheme("size", v)} />
          <Slider label="Line height" min={1} max={2} step={0.05} value={theme.lineHeight} onChange={(v) => setTheme("lineHeight", v)} />
        </div>
      </Section>
      <Section title="Layout">
        <Slider label="Default spacing" unit="px" min={0} max={32} value={theme.gap} onChange={(v) => setTheme("gap", v)} />
        <div className="field">
          <div className="label">Alignment</div>
          <Segmented
            full
            value={theme.align}
            onChange={(v) => setTheme("align", v, false)}
            options={[
              { value: "left", label: "Left" },
              { value: "center", label: "Centred" },
            ]}
          />
        </div>
      </Section>
      <Section title="Reply signature">
        <p className="hint" style={{ marginTop: 0 }}>
          The Reply signature uses the same design. Mark components as Full-only to keep replies compact.
        </p>
        <button
          className="btn block"
          onClick={() => {
            const n = applyCompactReply();
            toast(
              n ? `${n} secondary components set to Full only` : "Your Reply signature is already compact.",
              "success",
              n ? { label: "Undo", run: () => useEditor.getState().undo() } : undefined,
            );
            useEditor.getState().set({ variant: "reply" });
          }}
        >
          Make Reply compact
        </button>
      </Section>
    </div>
  );
}

function ThemeColor({ name }: { name: "ink" | "muted" | "accent" | "rule" | "surface" | "link" }) {
  const value = useEditor((s) => s.project!.theme.colors[name]);
  const edit = useEditor((s) => s.edit);
  const labels = { ink: "Ink (text)", muted: "Muted", accent: "Accent", rule: "Rules", surface: "Surface", link: "Links" };
  return (
    <div className="field">
      <label style={{ justifyContent: "flex-start", gap: 10 }}>
        <input
          type="color"
          value={value}
          aria-label={labels[name]}
          onChange={(e) => edit((d) => void (d.theme.colors[name] = e.target.value), `color.${name}`)}
          style={{ width: 28, height: 28, border: "1px solid var(--line-strong)", borderRadius: 6, padding: 1, background: "#fff" }}
        />
        <span style={{ flex: 1 }}>{labels[name]}</span>
        <code className="hint">{value}</code>
      </label>
    </div>
  );
}

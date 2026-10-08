import { useMemo, useRef, useState } from "react";
import { Pipette, Plus, Trash2, Upload } from "lucide-react";
import { useEditor } from "../../state/store";
import { PALETTES, TYPE_PRESETS } from "../../model/presets";
import { fontDef, fontStack } from "../../model/fonts";
import { removeKit, saveKit, useLibrary } from "../library";
import { extractColors, ingestFile, ACCEPT_ATTR, sourceUrl, UploadError } from "../../state/assets";
import { walk } from "../../model/tree";
import { assetMeta } from "../../model/builtins";
import { contrast } from "../assist";
import type { ImageNode, StackNode } from "../../model/types";
import { downloadFile } from "../../lib/download";

export function PalettePresets() {
  const colors = useEditor((s) => s.project!.theme.colors);
  const edit = useEditor((s) => s.edit);
  return (
    <div className="preset-grid">
      {PALETTES.map((p) => (
        <button
          key={p.id}
          className="preset"
          aria-pressed={p.colors.ink === colors.ink && p.colors.accent === colors.accent}
          onClick={() => edit((d) => void (d.theme.colors = { ...p.colors }))}
        >
          <span className="dots">
            {[p.colors.ink, p.colors.accent, p.colors.muted, p.colors.surface].map((c) => (
              <i key={c} style={{ background: c }} />
            ))}
          </span>
          <small>{p.name}</small>
        </button>
      ))}
    </div>
  );
}

export function TypePresets() {
  const fonts = useEditor((s) => s.project!.theme.fonts);
  const edit = useEditor((s) => s.edit);
  return (
    <div className="preset-grid">
      {TYPE_PRESETS.map((t) => (
        <button
          key={t.id}
          className="preset"
          aria-pressed={fonts.display === t.display && fonts.body === t.body}
          onClick={() => edit((d) => void (d.theme.fonts = { display: t.display, body: t.body }))}
          title={t.note}
        >
          <span className="type-sample" style={{ fontFamily: fontStack(t.display) }}>
            Aa
          </span>
          <small>
            {t.name}
            {fontDef(t.display).safe && fontDef(t.body).safe ? " ✓" : ""}
          </small>
        </button>
      ))}
    </div>
  );
}

export function BrandPanel() {
  const project = useEditor((s) => s.project!);
  const edit = useEditor((s) => s.edit);
  const toast = useEditor((s) => s.toast);
  const kits = useLibrary((s) => s.kits);
  const [extracted, setExtracted] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const logoId = useMemo(() => {
    let id: string | undefined;
    walk(project.root, ({ node }) => {
      if (!id && node.type === "image" && node.props.role === "logo" && node.props.assetId && !node.props.assetId.startsWith("builtin:"))
        id = node.props.assetId;
    });
    return id ?? Object.keys(project.assets)[0];
  }, [project.root, project.assets]);

  const extract = async (assetId: string) => {
    const colors = await extractColors(assetId, 6);
    setExtracted(colors);
    if (!colors.length) toast("No distinct colours found in that image.", "info");
  };

  const applyExtracted = () => {
    if (!extracted.length) return;
    // Darkest becomes ink; the most saturated becomes accent.
    const sorted = [...extracted].sort((a, b) => contrast(b, "#ffffff") - contrast(a, "#ffffff"));
    const ink = contrast(sorted[0], "#ffffff") >= 7 ? sorted[0] : "#16150f";
    const accent = extracted.find((c) => c !== ink && contrast(c, "#ffffff") >= 2.2) ?? project.theme.colors.accent;
    edit((d) => {
      d.theme.colors.ink = ink;
      d.theme.colors.accent = accent;
      d.theme.colors.link = ink;
    });
    toast("Palette updated from your logo", "success", { label: "Undo", run: () => useEditor.getState().undo() });
  };

  return (
    <>
      <div className="panel-head">
        <h2>Brand</h2>
        <p>Palettes, type pairings and reusable brand kits.</p>
      </div>
      <div className="panel-pad">
        <h3 className="hint" style={{ textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 600 }}>
          Colour from your logo
        </h3>
        <div className="row" style={{ marginBottom: 8 }}>
          {logoId ? (
            <button className="btn small" onClick={() => extract(logoId)}>
              <Pipette size={13} /> Extract colours
            </button>
          ) : (
            <button className="btn small" onClick={() => fileRef.current?.click()}>
              <Upload size={13} /> Upload a logo
            </button>
          )}
          {logoId && sourceUrl(logoId) && <img src={sourceUrl(logoId)!} alt="" style={{ height: 26, maxWidth: 80, objectFit: "contain" }} />}
        </div>
        {extracted.length > 0 && (
          <div className="callout brass" style={{ marginBottom: 12, display: "grid" }}>
            <div className="swatches">
              {extracted.map((c) => (
                <button
                  key={c}
                  className="swatch"
                  title={`Use ${c} as accent`}
                  aria-label={`Use ${c} as accent`}
                  style={{ background: c }}
                  onClick={() => edit((d) => void (d.theme.colors.accent = c))}
                />
              ))}
            </div>
            <button className="btn small" onClick={applyExtracted}>
              Apply as palette
            </button>
          </div>
        )}
        <input
          ref={fileRef}
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
                walk(d.root as StackNode, ({ node }) => {
                  if (node.type === "image" && node.props.role === "logo" && !node.props.assetId) {
                    (node as ImageNode).props.assetId = meta.id;
                  }
                });
              });
              await extract(meta.id);
            } catch (err) {
              toast(err instanceof UploadError ? err.message : "Upload failed.", "error");
            }
          }}
        />

        <h3 className="hint" style={{ textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 600, marginTop: 18 }}>
          Palettes
        </h3>
        <PalettePresets />
        <h3 className="hint" style={{ textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 600, marginTop: 18 }}>
          Type pairings
        </h3>
        <TypePresets />
        <p className="hint">✓ = renders exactly as designed in every inbox.</p>

        <h3
          className="hint"
          style={{ textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 600, marginTop: 18, display: "flex", justifyContent: "space-between" }}
        >
          Brand kits
          {kits.length > 0 && (
            <button
              className="btn small ghost"
              onClick={() =>
                downloadFile("brand-kits.json", JSON.stringify({ format: "signature-studio.brand-kits", version: 1, kits }, null, 2), "application/json")
              }
            >
              Export
            </button>
          )}
        </h3>
        {kits.map((k) => (
          <div key={k.id} className="contact-item" style={{ marginBottom: 6 }}>
            <span className="dots" style={{ display: "flex", gap: 3 }}>
              {[k.colors.ink, k.colors.accent, k.colors.surface].map((c) => (
                <i key={c} style={{ width: 12, height: 12, borderRadius: 6, background: c, display: "block", border: "1px solid rgba(0,0,0,.1)" }} />
              ))}
            </span>
            <span className="grow">{k.name}</span>
            <button className="btn small" onClick={() => edit((d) => void ((d.theme.colors = { ...k.colors }), (d.theme.fonts = { ...k.fonts })))}>
              Apply
            </button>
            <button className="icon-btn small" aria-label={`Delete ${k.name}`} onClick={() => removeKit(k.id)}>
              <Trash2 size={13} />
            </button>
          </div>
        ))}
        <button
          className="btn small"
          onClick={async () => {
            const name = window.prompt("Name this brand kit", project.profile.fields.company || "My brand");
            if (!name) return;
            await saveKit(name, project.theme);
            toast(`Saved brand kit “${name}”`, "success");
          }}
        >
          <Plus size={13} /> Save current look as kit
        </button>
      </div>
    </>
  );
}

export function AssetsPanel() {
  const project = useEditor((s) => s.project!);
  const edit = useEditor((s) => s.edit);
  const toast = useEditor((s) => s.toast);
  const fileRef = useRef<HTMLInputElement>(null);
  const replaceFor = useRef<string | null>(null);

  const usage = useMemo(() => {
    const map = new Map<string, number>();
    walk(project.root, ({ node }) => {
      if (node.type === "image" && node.props.assetId) map.set(node.props.assetId, (map.get(node.props.assetId) ?? 0) + 1);
    });
    project.profile.socials.forEach((s) => s.iconAssetId && map.set(s.iconAssetId, (map.get(s.iconAssetId) ?? 0) + 1));
    return map;
  }, [project.root, project.profile.socials]);

  const assets = Object.values(project.assets).sort((a, b) => b.createdAt - a.createdAt);

  return (
    <>
      <div className="panel-head">
        <h2>Images</h2>
        <p>Originals stay private in this browser. Only email-ready copies are published.</p>
      </div>
      <div className="panel-pad">
        <button
          className="btn block"
          onClick={() => {
            replaceFor.current = null;
            fileRef.current?.click();
          }}
        >
          <Upload size={14} /> Upload image
        </button>
        <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
          {assets.length === 0 && (
            <div className="empty">
              <strong>No uploads yet</strong>
              Logos, headshots and banners you upload appear here.
            </div>
          )}
          {assets.map((a) => {
            const used = usage.get(a.id) ?? 0;
            const meta = assetMeta(project, a.id)!;
            return (
              <div key={a.id} className="contact-item" style={{ padding: 8 }}>
                <div className="asset-tile" style={{ width: 48, height: 48, padding: 4, cursor: "default" }}>
                  <img src={sourceUrl(a.id) ?? ""} alt="" />
                </div>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500 }}>{a.name}</div>
                  <div className="hint">
                    {meta.width}×{meta.height} · {Math.max(1, Math.round(a.bytes / 1024))} KB · {used ? `used ${used}×` : "unused"}
                  </div>
                </div>
                <button
                  className="btn small"
                  title="Replace everywhere it's used"
                  onClick={() => {
                    replaceFor.current = a.id;
                    fileRef.current?.click();
                  }}
                >
                  Replace
                </button>
                <button
                  className="icon-btn small"
                  aria-label={`Delete ${a.name}`}
                  onClick={() => {
                    if (used && !window.confirm(`This image is used ${used} time(s). Remove it from the signature?`)) return;
                    edit((d) => {
                      delete d.assets[a.id];
                      walk(d.root as StackNode, ({ node }) => {
                        if (node.type === "image" && node.props.assetId === a.id) (node as ImageNode).props.assetId = undefined;
                      });
                      d.profile.socials.forEach((s) => s.iconAssetId === a.id && (s.iconAssetId = undefined));
                    });
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT_ATTR}
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            try {
              const meta = await ingestFile(f);
              const dup = Object.values(useEditor.getState().project!.assets).find((x) => x.hash === meta.hash);
              if (dup && !replaceFor.current) {
                toast(`This image is already in your library (${dup.name}).`, "info");
                return;
              }
              const target = replaceFor.current;
              edit((d) => {
                d.assets[meta.id] = meta;
                if (target) {
                  walk(d.root as StackNode, ({ node }) => {
                    if (node.type === "image" && node.props.assetId === target) {
                      (node as ImageNode).props.assetId = meta.id;
                      (node as ImageNode).props.crop = { x: 0, y: 0, zoom: 1 };
                    }
                  });
                  d.profile.socials.forEach((s) => s.iconAssetId === target && (s.iconAssetId = meta.id));
                  delete d.assets[target];
                }
              });
              toast(target ? "Image replaced everywhere" : "Image added. Select an image component to use it.", "success");
            } catch (err) {
              toast(err instanceof UploadError ? err.message : "Upload failed.", "error");
            }
          }}
        />
      </div>
    </>
  );
}

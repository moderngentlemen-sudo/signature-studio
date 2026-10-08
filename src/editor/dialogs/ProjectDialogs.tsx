import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Download, FileJson, FileUp, Image as ImageIcon, Plus, Trash2, FileCode2, History, RotateCcw } from "lucide-react";
import { toPng } from "html-to-image";
import { useEditor } from "../../state/store";
import { Modal, Segmented, TextInput, Toggle } from "../../ui/controls";
import { localProjects, versionStore, type ProjectSummary, type ProjectVersion } from "../../storage/db";
import {
  deleteProject,
  duplicateProject,
  exportProjectFile,
  importProjectFile,
  newProject,
  openProject,
  renameProject,
  restoreVersion,
  saveVersion,
} from "../../state/projects";
import { downloadFile, safeFileName } from "../../lib/download";
import { emailHtml } from "../../publish/prepare";
import { htmlDocument } from "../../render/validate";
import { copyText } from "../../lib/clipboard";
import { renderSignature } from "../../render/email";
import { sourceUrl } from "../../state/assets";
import { TEMPLATE_MAP } from "../../templates/templates";
import { applyTemplate, summarizeApply } from "../../templates/apply";
import { pushRecent, updatePrefs, usePrefs } from "../../state/prefs";
import type { Variant } from "../../model/types";
import { hostFromConfig } from "../../publish/host";

const close = () => useEditor.getState().openDialog(null);

// ---------------------------------------------------------------------------
// Apply template
// ---------------------------------------------------------------------------

export function ApplyTemplateDialog() {
  const open = useEditor((s) => s.dialog === "applyTemplate");
  const id = useEditor((s) => s.dialogArg);
  const project = useEditor((s) => s.project);
  const template = id ? TEMPLATE_MAP[id] : null;
  const [keepLook, setKeepLook] = useState(false);
  const [keepCustom, setKeepCustom] = useState(true);
  const summary = useMemo(() => (project && template ? summarizeApply(project, template) : null), [project, template]);

  const apply = () => {
    if (!template) return;
    useEditor.getState().edit((d) => void applyTemplate(d, template, { keepLook, keepCustom }));
    pushRecent(template.id);
    useEditor.getState().select(null);
    close();
    useEditor.getState().toast(`Applied “${template.name}”`, "success", { label: "Undo", run: () => useEditor.getState().undo() });
    requestAnimationFrame(() => window.dispatchEvent(new Event("ss:fit")));
  };

  if (!template || !summary) return <Modal open={false} onClose={close} title="" children={null} />;
  return (
    <Modal
      open={open}
      onClose={close}
      title={`Use “${template.name}”`}
      subtitle={template.description}
      testId="apply-template"
      footer={
        <>
          <button className="btn ghost" onClick={close}>
            Cancel
          </button>
          <button className="btn primary" onClick={apply} data-testid="apply-template-confirm">
            Apply layout
          </button>
        </>
      }
    >
      <ul className="readiness">
        <li>
          <span className="what">
            Your profile, contact details and social links
            <small>Always kept</small>
          </span>
          <span className="chip ok">Kept</span>
        </li>
        <li>
          <span className="what">
            Images
            <small>
              {summary.placedImages} placed into matching slots
              {summary.unplacedImages ? ` · ${summary.unplacedImages} without a slot in this layout` : ""}
            </small>
          </span>
          <span className="chip ok">Kept</span>
        </li>
        {summary.customComponents + summary.unplacedImages > 0 && (
          <li>
            <span className="what">
              Your custom components
              <small>{summary.customComponents + summary.unplacedImages} item(s) not part of the new layout</small>
            </span>
            <span className={`chip ${keepCustom ? "ok" : "warn"}`}>{keepCustom ? "Moved to Extras" : "Removed"}</span>
          </li>
        )}
      </ul>
      <Toggle label="Keep custom components (added to an “Extras” group at the bottom)" checked={keepCustom} onChange={setKeepCustom} />
      <Toggle label="Keep my current colours and fonts" checked={keepLook} onChange={setKeepLook} />
      <p className="hint">You can always undo (⌘Z) or restore an earlier version from History.</p>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export function ProjectsDialog() {
  const open = useEditor((s) => s.dialog === "projects");
  const current = useEditor((s) => s.project?.id);
  const toast = useEditor((s) => s.toast);
  const [list, setList] = useState<ProjectSummary[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const refresh = () => localProjects.list().then(setList);
  useEffect(() => {
    if (open) void refresh();
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={close}
      title="Your signatures"
      subtitle="Saved in this browser. Export a project file to back it up or move it to another device."
      footer={
        <>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            <FileUp size={14} /> Import project
          </button>
          <span className="spacer" />
          <button
            className="btn primary"
            onClick={async () => {
              const cur = useEditor.getState().project;
              await newProject({ templateId: "exec-boardroom", fields: cur?.profile.fields, socials: cur?.profile.socials, name: "New signature" });
              close();
            }}
          >
            <Plus size={14} /> New signature
          </button>
        </>
      }
    >
      <ul className="readiness">
        {list.map((p) => (
          <li key={p.id}>
            <span className="what">
              <input
                className="input small"
                defaultValue={p.name}
                aria-label="Project name"
                onBlur={(e) => e.target.value.trim() && e.target.value !== p.name && renameProject(p.id, e.target.value.trim()).then(refresh)}
                style={{ maxWidth: 280 }}
              />
              <small>
                Edited {new Date(p.updatedAt).toLocaleString()}
                {p.templateId && TEMPLATE_MAP[p.templateId] ? ` · ${TEMPLATE_MAP[p.templateId].name}` : ""}
              </small>
            </span>
            {p.id === current ? (
              <span className="chip brass">Open</span>
            ) : (
              <button
                className="btn small"
                onClick={async () => {
                  await openProject(p.id);
                  close();
                }}
              >
                Open
              </button>
            )}
            <button className="icon-btn small" aria-label={`Duplicate ${p.name}`} title="Duplicate" onClick={() => duplicateProject(p.id).then(refresh)}>
              <Copy size={13} />
            </button>
            <button
              className="icon-btn small"
              aria-label={`Delete ${p.name}`}
              title="Delete"
              onClick={async () => {
                if (!window.confirm(`Delete “${p.name}”? This can't be undone.`)) return;
                await deleteProject(p.id);
                refresh();
              }}
            >
              <Trash2 size={13} />
            </button>
          </li>
        ))}
      </ul>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json,.sigstudio"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          try {
            const p = await importProjectFile(await f.text());
            await openProject(p.id);
            toast(`Imported “${p.name}” as a new project`, "success");
            close();
          } catch (err) {
            toast(err instanceof Error ? err.message : "Import failed", "error");
          }
        }}
      />
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export function ExportDialog() {
  const open = useEditor((s) => s.dialog === "export");
  const project = useEditor((s) => s.project);
  const toast = useEditor((s) => s.toast);
  const openDialog = useEditor((s) => s.openDialog);
  const [variant, setVariant] = useState<Variant>("full");
  const [busy, setBusy] = useState(false);
  const result = useMemo(() => (project ? emailHtml(project, variant) : null), [project, variant]);
  if (!project || !result) return <Modal open={false} onClose={close} title="" children={null} />;
  const base = safeFileName(`${project.name}-${variant}`);

  const png = async () => {
    setBusy(true);
    const holder = document.createElement("div");
    holder.style.cssText = "position:fixed;left:-10000px;top:0;background:#fff;padding:16px;display:inline-block;";
    holder.innerHTML = renderSignature(project, { variant, mode: "preview", sourceUrl }).html;
    document.body.appendChild(holder);
    try {
      await document.fonts?.ready;
      await Promise.all(
        Array.from(holder.querySelectorAll("img")).map((img) => (img.complete ? null : new Promise((r) => ((img.onload = r), (img.onerror = r))))),
      );
      const url = await toPng(holder, { pixelRatio: 2, backgroundColor: "#ffffff", cacheBust: false });
      const blob = await (await fetch(url)).blob();
      downloadFile(`${base}@2x.png`, blob);
    } catch {
      toast("PNG export failed. A web font or image may have blocked it.", "error");
    } finally {
      holder.remove();
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={close} title="Export" subtitle="Download or copy your signature in other formats.">
      <div className="field">
        <div className="label">Signature</div>
        <Segmented
          value={variant}
          onChange={setVariant}
          options={[
            { value: "full", label: "Full" },
            { value: "reply", label: "Reply" },
          ]}
        />
      </div>
      <ul className="readiness">
        <li>
          <FileCode2 size={16} />
          <span className="what">
            HTML file
            <small>{result.ready ? "Email-safe HTML with verified public images." : "Prepare images first (Install → Check)."}</small>
          </span>
          <button
            className="btn small"
            disabled={!result.ready}
            onClick={() => downloadFile(`${base}.html`, htmlDocument(result.html, project.name), "text/html")}
          >
            <Download size={13} /> Download
          </button>
          <button
            className="btn small"
            disabled={!result.ready}
            title="Copy the raw HTML source (advanced)"
            onClick={async () => {
              await copyText(result.html);
              toast("HTML source copied", "success");
            }}
          >
            Copy source
          </button>
          {!result.ready && (
            <button className="btn small" onClick={() => openDialog("install")}>
              Prepare
            </button>
          )}
        </li>
        <li>
          <ImageIcon size={16} />
          <span className="what">
            PNG image (2×)
            <small>A picture of your signature for sharing or approvals. Links aren't clickable in a PNG.</small>
          </span>
          <button className="btn small" disabled={busy} onClick={png}>
            <Download size={13} /> {busy ? "Rendering…" : "Download"}
          </button>
        </li>
        <li>
          <FileJson size={16} />
          <span className="what">
            Project file
            <small>Everything, including original images, to restore or move this design later.</small>
          </span>
          <button
            className="btn small"
            onClick={async () => downloadFile(`${safeFileName(project.name)}.sigstudio.json`, await exportProjectFile(project), "application/json")}
          >
            <Download size={13} /> Download
          </button>
        </li>
      </ul>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Versions
// ---------------------------------------------------------------------------

export function VersionsDialog() {
  const open = useEditor((s) => s.dialog === "versions");
  const project = useEditor((s) => s.project);
  const toast = useEditor((s) => s.toast);
  const [list, setList] = useState<ProjectVersion[]>([]);
  const [label, setLabel] = useState("");
  const refresh = () => project && versionStore.list(project.id).then(setList);
  useEffect(() => {
    if (open) void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, project?.id]);
  if (!project) return null;
  return (
    <Modal open={open} onClose={close} title="History" subtitle="Named versions and automatic snapshots, stored in this browser.">
      <div className="row" style={{ alignItems: "flex-end", marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <TextInput label="Name this version" value={label} placeholder="e.g. Before rebrand" onChange={setLabel} />
        </div>
        <button
          className="btn primary"
          style={{ marginBottom: 12 }}
          onClick={async () => {
            await saveVersion(label.trim() || `Version ${new Date().toLocaleString()}`);
            setLabel("");
            refresh();
            toast("Version saved", "success");
          }}
        >
          <History size={14} /> Save version
        </button>
      </div>
      <ul className="readiness">
        {list.length === 0 && (
          <li>
            <span className="what muted">No versions yet. Autosave snapshots appear here every 10 minutes while you work.</span>
          </li>
        )}
        {list.map((v) => (
          <li key={v.id}>
            <span className="what">
              {v.label}
              <small>
                {new Date(v.createdAt).toLocaleString()}
                {v.auto ? " · automatic" : ""}
              </small>
            </span>
            <button
              className="btn small"
              onClick={async () => {
                await restoreVersion(project.id, v.id);
                toast(`Restored “${v.label}”. Your previous state was saved as a version.`, "success", {
                  label: "Undo",
                  run: () => useEditor.getState().undo(),
                });
                close();
              }}
            >
              <RotateCcw size={13} /> Restore
            </button>
            <button className="icon-btn small" aria-label={`Delete ${v.label}`} onClick={() => versionStore.remove(project.id, v.id).then(refresh)}>
              <Trash2 size={13} />
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Settings (image hosting)
// ---------------------------------------------------------------------------

export function SettingsDialog() {
  const open = useEditor((s) => s.dialog === "settings");
  const host = usePrefs((s) => s.host);
  const consent = usePrefs((s) => s.publishConsent);
  const [endpoint, setEndpoint] = useState(host?.endpoint ?? "");
  const [token, setToken] = useState(host?.token ?? "");
  useEffect(() => {
    if (open) {
      setEndpoint(host?.endpoint ?? "");
      setToken(host?.token ?? "");
    }
  }, [open, host]);
  const envDefault = import.meta.env.VITE_ASSET_HOST as string | undefined;
  const active = hostFromConfig(host);
  return (
    <Modal
      open={open}
      onClose={close}
      title="Image hosting"
      subtitle="Where email-ready copies of your images are published so recipients can see them."
      footer={
        <>
          <button className="btn ghost" onClick={close}>
            Cancel
          </button>
          <button
            className="btn primary"
            onClick={() => {
              updatePrefs({ host: endpoint.trim() ? { endpoint: endpoint.trim(), token: token.trim() || undefined } : undefined });
              close();
            }}
          >
            Save
          </button>
        </>
      }
    >
      <div className={`callout ${active ? "ok" : "warn"}`} style={{ marginBottom: 14 }}>
        {active
          ? `Publishing to ${active.label}.`
          : "No image host is configured, so signatures with images can't be installed yet. Text-only signatures still work."}
      </div>
      <TextInput
        label="Image host address"
        placeholder={envDefault ?? "https://img.your-domain.com"}
        value={endpoint}
        onChange={setEndpoint}
        hint={envDefault ? "Leave empty to use the default" : undefined}
      />
      <TextInput label="Upload key" type="password" value={token} onChange={setToken} hint="Stored only in this browser" />
      <p className="hint">
        Signature Studio's image host is a small Cloudflare Worker with R2 storage (see <code>worker/README.md</code>). Images are stored at permanent,
        content-addressed links and are verified by downloading them anonymously before your signature is marked ready.
      </p>
      <Toggle label="I consent to publishing signature images publicly" checked={consent} onChange={(v) => updatePrefs({ publishConsent: v })} />
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Shortcuts
// ---------------------------------------------------------------------------

const MOD = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";

export const SHORTCUTS: [string, string][] = [
  [`${MOD} Z`, "Undo"],
  [`${MOD} ⇧ Z`, "Redo"],
  [`${MOD} D`, "Duplicate"],
  ["⌫ / Delete", "Delete component"],
  ["Esc", "Select parent / deselect"],
  ["Enter", "Edit text of selection"],
  ["Alt ↑ / ↓", "Move component up / down"],
  [`${MOD} G`, "Group"],
  [`${MOD} ⇧ G`, "Ungroup"],
  [`${MOD} L`, "Lock / unlock"],
  ["R", "Switch Full / Reply"],
  ["P", "Preview"],
  [`${MOD} + / −`, "Zoom"],
  ["⇧ 1", "Fit to screen"],
  ["Alt while resizing", "Disable snapping"],
  ["?", "This list"],
];

export function ShortcutsDialog() {
  const open = useEditor((s) => s.dialog === "shortcuts");
  return (
    <Modal open={open} onClose={close} title="Keyboard shortcuts">
      <ul className="readiness">
        {SHORTCUTS.map(([k, v]) => (
          <li key={v}>
            <span className="what">{v}</span>
            <span className="kbd">{k}</span>
          </li>
        ))}
      </ul>
    </Modal>
  );
}

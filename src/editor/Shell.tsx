import { useEffect, useMemo } from "react";
import {
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  FolderOpen,
  History,
  Image as ImageIcon,
  Keyboard,
  Layers,
  LayoutTemplate,
  Loader2,
  Palette,
  PanelLeft,
  PanelRight,
  Plus,
  Redo2,
  Send,
  Settings,
  Undo2,
  UserRound,
  Wand2,
  AlertTriangle,
} from "lucide-react";
import { useEditor, type LeftPanel } from "../state/store";
import { Segmented } from "../ui/controls";
import { TemplatesPanel } from "./panels/TemplatesPanel";
import { AddPanel } from "./panels/AddPanel";
import { LayersPanel } from "./panels/LayersPanel";
import { ProfilePanel } from "./panels/ProfilePanel";
import { AssetsPanel, BrandPanel } from "./panels/BrandPanel";
import { GuidedPanel } from "./panels/GuidedPanel";
import { useDrag } from "./dnd";
import { updatePrefs } from "../state/prefs";
import { designChecks } from "./assist";
import { emailHtml } from "../publish/prepare";
import { TEST_HOST_ENABLED } from "../lib/url";

const TABS: { id: LeftPanel; label: string; icon: typeof Layers }[] = [
  { id: "templates", label: "Layouts", icon: LayoutTemplate },
  { id: "add", label: "Add", icon: Plus },
  { id: "layers", label: "Layers", icon: Layers },
  { id: "profile", label: "Profile", icon: UserRound },
  { id: "brand", label: "Brand", icon: Palette },
  { id: "assets", label: "Images", icon: ImageIcon },
];

export function TopBar() {
  const project = useEditor((s) => s.project);
  const mode = useEditor((s) => s.mode);
  const variant = useEditor((s) => s.variant);
  const compare = useEditor((s) => s.compare);
  const preview = useEditor((s) => s.preview);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const set = useEditor((s) => s.set);
  const openDialog = useEditor((s) => s.openDialog);
  if (!project) return <header className="topbar" />;
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark" aria-hidden>
          <svg width="18" height="18" viewBox="0 0 32 32">
            <path d="M6 22c4-10 7-14 10-14s-2 12 1.5 12 4-6 8.5-6" stroke="#c9a46a" strokeWidth="2.6" fill="none" strokeLinecap="round" />
          </svg>
        </span>
        <input
          className="project-name"
          value={project.name}
          aria-label="Project name"
          onChange={(e) => useEditor.getState().edit((d) => void (d.name = e.target.value), "name")}
        />
        <button className="icon-btn desktop-only" title="Your signatures" aria-label="Your signatures" onClick={() => openDialog("projects")}>
          <FolderOpen size={16} />
        </button>
      </div>
      <span className="desktop-only">
        <Segmented
          label="Editing mode"
          value={mode}
          onChange={(m) => {
            set({ mode: m, leftPanel: m === "advanced" ? "add" : "templates" });
            updatePrefs({ mode: m });
          }}
          options={[
            { value: "simple", label: "Simple", title: "Guided steps" },
            { value: "advanced", label: "Advanced", title: "Full design control" },
          ]}
        />
      </span>
      <div className="row" style={{ gap: 0 }}>
        <button className="icon-btn" aria-label="Undo" title="Undo (⌘Z)" disabled={!canUndo} onClick={() => useEditor.getState().undo()}>
          <Undo2 size={16} />
        </button>
        <button className="icon-btn" aria-label="Redo" title="Redo (⌘⇧Z)" disabled={!canRedo} onClick={() => useEditor.getState().redo()}>
          <Redo2 size={16} />
        </button>
      </div>
      <span className="spacer" />
      <Segmented
        label="Signature variant"
        value={compare ? "compare" : variant}
        onChange={(v) => (v === "compare" ? set({ compare: true }) : set({ compare: false, variant: v as "full" | "reply" }))}
        options={[
          { value: "full", label: "Full", title: "Signature for new emails (R)" },
          { value: "reply", label: "Reply", title: "Signature for replies & forwards (R)" },
          { value: "compare", label: <span className="desktop-only">Compare</span>, title: "Side by side" },
        ]}
      />
      <span className="spacer" />
      <button
        className="icon-btn"
        aria-label={preview ? "Exit preview" : "Preview"}
        title="Preview (P)"
        aria-pressed={preview}
        onClick={() => set({ preview: !preview, selection: null })}
      >
        {preview ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
      <button className="icon-btn desktop-only" aria-label="History" title="History & versions" onClick={() => openDialog("versions")}>
        <History size={16} />
      </button>
      <button className="icon-btn desktop-only" aria-label="Settings" title="Image hosting settings" onClick={() => openDialog("settings")}>
        <Settings size={16} />
      </button>
      <button className="btn desktop-only" onClick={() => openDialog("export")}>
        <Download size={15} /> Export
      </button>
      <button className="btn brass" onClick={() => openDialog("install")} data-testid="install-button">
        <Send size={15} /> <span className="desktop-only">Install in Gmail</span>
        <span className="mobile-only">Install</span>
      </button>
    </header>
  );
}

export function Rail() {
  const mode = useEditor((s) => s.mode);
  const panel = useEditor((s) => s.leftPanel);
  const sheet = useEditor((s) => s.mobileSheet);
  const set = useEditor((s) => s.set);
  return (
    <aside className={`rail${sheet === "left" ? " open" : ""}`} aria-label="Tools">
      {mode === "advanced" && (
        <nav className="rail-tabs" role="tablist" aria-label="Panels" aria-orientation="vertical">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              className="rail-tab"
              aria-selected={panel === t.id}
              onClick={() => set({ leftPanel: t.id })}
              data-testid={`tab-${t.id}`}
            >
              <t.icon size={17} strokeWidth={1.75} />
              {t.label}
            </button>
          ))}
        </nav>
      )}
      <div className="rail-body" role="tabpanel">
        {mode === "simple" ? (
          <GuidedPanel />
        ) : panel === "templates" ? (
          <TemplatesPanel />
        ) : panel === "add" ? (
          <AddPanel />
        ) : panel === "layers" ? (
          <LayersPanel />
        ) : panel === "profile" ? (
          <ProfilePanel />
        ) : panel === "brand" ? (
          <BrandPanel />
        ) : (
          <AssetsPanel />
        )}
      </div>
    </aside>
  );
}

export function StatusBar() {
  const project = useEditor((s) => s.project);
  const measured = useEditor((s) => s.measuredWidth);
  const saveState = useEditor((s) => s.saveState);
  const variant = useEditor((s) => s.variant);
  const sheet = useEditor((s) => s.mobileSheet);
  const set = useEditor((s) => s.set);
  const checks = useMemo(() => (project ? designChecks(project, measured) : []), [project, measured]);
  const readiness = useMemo(() => (project ? emailHtml(project, variant) : null), [project, variant]);
  if (!project) return <footer className="statusbar" />;
  const warnings = checks.filter((c) => c.level === "warning");
  const over = measured > project.theme.width + 1;
  return (
    <footer className="statusbar">
      <button className="btn small ghost mobile-only" onClick={() => set({ mobileSheet: sheet === "left" ? null : "left" })} aria-pressed={sheet === "left"}>
        <PanelLeft size={14} /> Edit
      </button>
      <span className={`desktop-only ${over ? "warn" : ""}`}>
        Width {Math.round(measured)} / {project.theme.width}px
      </span>
      <span className="desktop-only" title={readiness?.problems.map((p) => p.message).join("\n")}>
        {readiness?.ready ? (
          <span className="ok">
            <CheckCircle2 size={12} style={{ verticalAlign: -2 }} /> {variant === "full" ? "Full" : "Reply"} ready for Gmail
          </span>
        ) : (
          <>{readiness?.images.length ?? 0} image(s) to prepare before install</>
        )}
      </span>
      {warnings.length > 0 && (
        <span className="warn desktop-only" title={warnings.map((w) => w.message).join("\n")}>
          <AlertTriangle size={12} style={{ verticalAlign: -2 }} /> {warnings[0].message}
          {warnings.length > 1 ? ` (+${warnings.length - 1})` : ""}
        </span>
      )}
      {over && (
        <button
          className="btn small ghost desktop-only"
          onClick={async () => {
            const { autoFit } = await import("./assist");
            const r = await autoFit();
            useEditor.getState().toast(r.message, r.ok ? "success" : "info");
          }}
        >
          <Wand2 size={12} /> Auto-fit
        </button>
      )}
      {TEST_HOST_ENABLED && (
        <span className="chip err" title="This build accepts the local test image host. Images will not display for real recipients.">
          Test image host
        </span>
      )}
      <span style={{ flex: 1 }} className="desktop-only" />
      <span className="desktop-only">
        {saveState === "saving" ? (
          <>
            <Loader2 size={11} className="spin" style={{ verticalAlign: -1 }} /> Saving…
          </>
        ) : saveState === "error" ? (
          <span className="warn">Not saved</span>
        ) : saveState === "unsaved" ? (
          "Unsaved changes"
        ) : (
          "Saved in this browser"
        )}
      </span>
      <button className="btn small ghost desktop-only" onClick={() => useEditor.getState().openDialog("shortcuts")} aria-label="Keyboard shortcuts">
        <Keyboard size={13} />
      </button>
      <button className="btn small ghost mobile-only" onClick={() => set({ mobileSheet: sheet === "right" ? null : "right" })} aria-pressed={sheet === "right"}>
        <PanelRight size={14} /> Style
      </button>
    </footer>
  );
}

export function Toasts() {
  const toasts = useEditor((s) => s.toasts);
  const dismiss = useEditor((s) => s.dismissToast);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.tone}`}>
          <span>{t.message}</span>
          {t.action && (
            <button
              onClick={() => {
                t.action!.run();
                dismiss(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export function DragGhost() {
  const source = useDrag((s) => s.source);
  const label = useDrag((s) => s.label);
  const x = useDrag((s) => s.x);
  const y = useDrag((s) => s.y);
  const valid = useDrag((s) => !!s.resolution);
  if (!source) return null;
  return (
    <div className="drag-ghost" style={{ left: x, top: y, opacity: valid ? 1 : 0.6 }}>
      {source.kind === "new" ? "+ " : ""}
      {label}
    </div>
  );
}

/** Close the mobile sheet when a dialog opens or selection changes on phones. */
export function useMobileSheetSync() {
  const dialog = useEditor((s) => s.dialog);
  useEffect(() => {
    if (dialog) useEditor.getState().set({ mobileSheet: null });
  }, [dialog]);
}

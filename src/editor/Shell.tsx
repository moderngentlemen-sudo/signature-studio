import { useEffect, useMemo, useRef } from "react";
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
  MoreHorizontal,
  X,
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
  const saveState = useEditor((s) => s.saveState);
  if (!project) return <header className="topbar" />;
  return (
    <header className="topbar">
      <div className="topbar-main">
        <div className="brand">
          <StudioMark />
          <span className="brand-wordmark">
            Signature <strong>Studio</strong>
            <span className="version-label">3.0</span>
          </span>
        </div>
        <div className="project-identity">
          <span className="project-caption">Your workspace</span>
          <input
            className="project-name"
            value={project.name}
            aria-label="Project name"
            onChange={(e) => useEditor.getState().edit((d) => void (d.name = e.target.value), "name")}
          />
        </div>
        <span className="spacer" />
        <span className={`save-pill desktop-only${saveState === "error" ? " warn" : ""}`} role="status">
          {saveState === "saving" ? (
            <Loader2 size={14} className="spin" />
          ) : saveState === "error" ? (
            <AlertTriangle size={14} />
          ) : (
            <CheckCircle2 size={14} />
          )}
          {saveState === "saving"
            ? "Saving…"
            : saveState === "error"
              ? "Not saved"
              : saveState === "unsaved"
                ? "Unsaved changes"
                : "Saved in this browser"}
        </span>
        <button className="btn desktop-only" onClick={() => openDialog("projects")}>
          <FolderOpen size={16} /> Your signatures
        </button>
        <WorkspaceMenu />
        <button className="btn brass install-action" onClick={() => openDialog("install")} data-testid="install-button">
          <Send size={15} /> <span className="desktop-only">Install in Gmail</span>
          <span className="mobile-only">Install</span>
        </button>
      </div>
      <div className="topbar-tools" aria-label="Editor controls">
        <span className="desktop-only mode-switch">
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
        <span className="toolbar-divider desktop-only" aria-hidden="true" />
        <Segmented
          label="Signature variant"
          value={compare ? "compare" : variant}
          onChange={(v) => (v === "compare" ? set({ compare: true }) : set({ compare: false, variant: v as "full" | "reply" }))}
          options={[
            { value: "full", label: "Full", title: "Signature for new emails (R)" },
            { value: "reply", label: "Reply", title: "Signature for replies & forwards (R)" },
            { value: "compare", label: "Compare", title: "Side by side" },
          ]}
        />
        <span className="spacer" />
        <button className="btn small studio-tool" aria-label="Preview lab" title="Preview lab" onClick={() => openDialog("previewLab")}>
          <Eye size={14} />
          <span>Preview lab</span>
        </button>
        <button
          className="btn small studio-tool desktop-only"
          aria-label="Fix layout"
          title="Fix layout"
          onClick={() => openDialog("layoutFix")}
        >
          <Wand2 size={14} />
          <span>Fix layout</span>
        </button>
        <button
          className="icon-btn canvas-preview"
          aria-label={preview ? "Exit preview" : "Preview"}
          title="Preview (P)"
          aria-pressed={preview}
          onClick={() => set({ preview: !preview, selection: null })}
        >
          {preview ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </header>
  );
}

export function StudioMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
        <path d="M6 23c4-11 7-15 10-15s-2 12 1.5 12 4-6 8.5-6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M7 27h18" stroke="currentColor" strokeOpacity=".45" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </span>
  );
}

function WorkspaceMenu() {
  const ref = useRef<HTMLDetailsElement>(null);
  const mode = useEditor((s) => s.mode);
  const openDialog = useEditor((s) => s.openDialog);
  useEffect(() => {
    const closeOutside = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node) && ref.current) ref.current.open = false;
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);
  return (
    <details
      className="workspace-menu"
      ref={ref}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          ref.current!.open = false;
          ref.current!.querySelector("summary")?.focus();
        }
      }}
    >
      <summary className="icon-btn" aria-label="More tools" title="More tools">
        <MoreHorizontal size={20} />
      </summary>
      <div className="workspace-menu-content">
        <span className="menu-caption">Workspace tools</span>
        <div className="mobile-only menu-mode">
          <Segmented
            label="Editing mode"
            value={mode}
            onChange={(m) => {
              useEditor.getState().set({ mode: m, leftPanel: m === "advanced" ? "add" : "templates" });
              updatePrefs({ mode: m });
            }}
            options={[
              { value: "simple", label: "Simple" },
              { value: "advanced", label: "Advanced" },
            ]}
          />
        </div>
        {(
          [
            { dialog: "projects", label: "Your signatures", icon: FolderOpen },
            { dialog: "versions", label: "History", icon: History },
            { dialog: "export", label: "Export", icon: Download },
            { dialog: "settings", label: "Settings", icon: Settings },
            { dialog: "shortcuts", label: "Keyboard shortcuts", icon: Keyboard },
            { dialog: "layoutFix", label: "Fix layout", icon: Wand2 },
          ] as const
        ).map((item) => (
          <button
            key={item.dialog}
            onClick={() => {
              ref.current!.open = false;
              openDialog(item.dialog);
            }}
          >
            <item.icon size={17} />
            {item.label}
          </button>
        ))}
      </div>
    </details>
  );
}

export function Rail() {
  const mode = useEditor((s) => s.mode);
  const panel = useEditor((s) => s.leftPanel);
  const sheet = useEditor((s) => s.mobileSheet);
  const set = useEditor((s) => s.set);
  return (
    <aside className={`rail${sheet === "left" ? " open" : ""}`} aria-label="Tools">
      <div className="sheet-heading mobile-only">
        <strong>Edit your signature</strong>
        <button id="close-edit-panel" className="icon-btn" aria-label="Close editing panel" onClick={() => set({ mobileSheet: null })}>
          <X size={18} />
        </button>
      </div>
      {mode === "advanced" && (
        <nav className="rail-tabs" role="tablist" aria-label="Panels" aria-orientation="horizontal">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              className="rail-tab"
              aria-selected={panel === t.id}
              id={`panel-tab-${t.id}`}
              aria-controls="editor-panel"
              tabIndex={panel === t.id ? 0 : -1}
              onKeyDown={(e) => {
                const i = TABS.findIndex((tab) => tab.id === t.id);
                const next =
                  e.key === "ArrowRight"
                    ? (i + 1) % TABS.length
                    : e.key === "ArrowLeft"
                      ? (i + TABS.length - 1) % TABS.length
                      : e.key === "Home"
                        ? 0
                        : e.key === "End"
                          ? TABS.length - 1
                          : -1;
                if (next < 0) return;
                e.preventDefault();
                set({ leftPanel: TABS[next].id });
                document.getElementById(`panel-tab-${TABS[next].id}`)?.focus();
              }}
              onClick={() => set({ leftPanel: t.id })}
              data-testid={`tab-${t.id}`}
            >
              <t.icon size={17} strokeWidth={1.75} />
              {t.label}
            </button>
          ))}
        </nav>
      )}
      <div
        className="rail-body"
        id="editor-panel"
        role={mode === "advanced" ? "tabpanel" : undefined}
        aria-labelledby={mode === "advanced" ? `panel-tab-${panel}` : undefined}
        tabIndex={mode === "advanced" ? 0 : undefined}
      >
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
  const checks = useMemo(() => (project ? designChecks(project, measured, variant) : []), [project, measured, variant]);
  const readiness = useMemo(() => (project ? emailHtml(project, variant) : null), [project, variant]);
  if (!project) return <footer className="statusbar" />;
  const warnings = checks.filter((c) => c.level === "warning");
  const over = measured > project.theme.width + 1;
  return (
    <footer className="statusbar">
      <button
        id="mobile-edit-trigger"
        className="btn small ghost mobile-only"
        onClick={() => set({ mobileSheet: sheet === "left" ? null : "left", preview: false })}
        aria-expanded={sheet === "left"}
        aria-controls="editor-panel"
      >
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
        <button className="btn small ghost desktop-only" onClick={() => useEditor.getState().openDialog("layoutFix")}>
          <Wand2 size={12} /> Fix layout
        </button>
      )}
      {TEST_HOST_ENABLED && (
        <span className="chip err" title="This build accepts the local test image host. Images will not display for real recipients.">
          Test image host
        </span>
      )}
      <span style={{ flex: 1 }} className="desktop-only" />
      <span className={`mobile-only mobile-save${saveState === "error" ? " warn" : ""}`} role="status">
        {saveState === "saving" ? "Saving…" : saveState === "error" ? "Not saved" : saveState === "unsaved" ? "Unsaved" : "Saved"}
      </span>
      <span className="desktop-only" role="status">
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
      <button
        className="btn small ghost desktop-only"
        onClick={() => useEditor.getState().openDialog("shortcuts")}
        aria-label="Keyboard shortcuts"
      >
        <Keyboard size={13} />
      </button>
      <button
        id="mobile-style-trigger"
        className="btn small ghost mobile-only"
        onClick={() => set({ mobileSheet: sheet === "right" ? null : "right", preview: false })}
        aria-expanded={sheet === "right"}
        aria-controls="style-panel"
      >
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
  const sheet = useEditor((s) => s.mobileSheet);
  const previousSheet = useRef(sheet);
  useEffect(() => {
    const previous = previousSheet.current;
    previousSheet.current = sheet;
    if (!window.matchMedia("(max-width: 900px)").matches || dialog) return;
    if (sheet) document.getElementById(sheet === "left" ? "close-edit-panel" : "close-style-panel")?.focus();
    else if (previous) document.getElementById(previous === "left" ? "mobile-edit-trigger" : "mobile-style-trigger")?.focus();
  }, [sheet, dialog]);
  useEffect(() => {
    if (dialog) useEditor.getState().set({ mobileSheet: null });
  }, [dialog]);
  useEffect(() => {
    const closeSheet = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || useEditor.getState().dialog || !useEditor.getState().mobileSheet) return;
      useEditor.getState().set({ mobileSheet: null });
    };
    document.addEventListener("keydown", closeSheet);
    return () => document.removeEventListener("keydown", closeSheet);
  }, []);
}

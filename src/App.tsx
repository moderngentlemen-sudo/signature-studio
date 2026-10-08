import { useEffect, useState } from "react";
import { useEditor } from "./state/store";
import { Canvas } from "./editor/Canvas";
import { Inspector } from "./editor/Inspector";
import { DragGhost, Rail, StatusBar, Toasts, TopBar, useMobileSheetSync } from "./editor/Shell";
import { Onboarding } from "./editor/Onboarding";
import { InstallDialog } from "./editor/dialogs/InstallDialog";
import { ImageDialog } from "./editor/dialogs/ImageDialog";
import { ApplyTemplateDialog, ExportDialog, ProjectsDialog, SettingsDialog, ShortcutsDialog, VersionsDialog } from "./editor/dialogs/ProjectDialogs";
import { useShortcuts } from "./editor/shortcuts";
import { loadPrefs } from "./state/prefs";
import { loadLibrary } from "./editor/library";
import { openProject, startAutosave } from "./state/projects";
import { localProjects } from "./storage/db";

type Boot = "loading" | "onboarding" | "ready" | "error";

export default function App() {
  const [boot, setBoot] = useState<Boot>("loading");
  const preview = useEditor((s) => s.preview);
  const sheet = useEditor((s) => s.mobileSheet);
  useShortcuts();
  useMobileSheetSync();

  useEffect(() => {
    let stop: (() => void) | undefined;
    (async () => {
      try {
        const [prefs] = await Promise.all([loadPrefs(), loadLibrary()]);
        useEditor.getState().set({ mode: prefs.mode, leftPanel: prefs.mode === "advanced" ? "add" : "templates" });
        let opened = false;
        if (prefs.lastProjectId) opened = await openProject(prefs.lastProjectId);
        if (!opened) {
          const list = await localProjects.list();
          if (list.length) opened = await openProject(list[0].id);
        }
        stop = startAutosave();
        setBoot(opened ? "ready" : "onboarding");
        if (opened) setTimeout(() => window.dispatchEvent(new Event("ss:fit")), 60);
      } catch (err) {
        console.error(err);
        setBoot("error");
      }
    })();
    return () => stop?.();
  }, []);

  if (boot === "loading")
    return (
      <div className="empty" style={{ paddingTop: "30vh" }}>
        Loading your studio…
      </div>
    );
  if (boot === "error")
    return (
      <div className="empty" style={{ paddingTop: "25vh" }}>
        <strong>This browser blocked local storage.</strong>
        Signature Studio saves your work in the browser. Please allow site data (or leave private browsing) and reload.
      </div>
    );
  if (boot === "onboarding") return <Onboarding onDone={() => setBoot("ready")} />;

  return (
    <div className={`app${preview ? " preview-mode" : ""}`}>
      <TopBar />
      <Rail />
      <Canvas />
      <aside className={`inspector${sheet === "right" ? " open" : ""}`} aria-label="Properties">
        <Inspector />
      </aside>
      <StatusBar />
      <InstallDialog />
      <ImageDialog />
      <ApplyTemplateDialog />
      <ExportDialog />
      <ProjectsDialog />
      <VersionsDialog />
      <SettingsDialog />
      <ShortcutsDialog />
      <Toasts />
      <DragGhost />
    </div>
  );
}

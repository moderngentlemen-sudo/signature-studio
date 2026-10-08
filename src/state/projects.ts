/**
 * Project lifecycle: open, create, duplicate, delete, autosave, import and
 * export, plus local named versions.
 */
import { uid } from "../lib/id";
import { migrateProject, type ProjectFile } from "../model/schema";
import type { Project } from "../model/types";
import { assetStore, localProjects, versionStore } from "../storage/db";
import { createProject } from "../templates/starter";
import { blobToDataUrl, hydrateSources, ingestDataUrl } from "./assets";
import { updatePrefs } from "./prefs";
import { useEditor } from "./store";

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let lastSaved: Project | null = null;
/** updatedAt of the stored copy this session last loaded or wrote. */
let baseUpdatedAt = 0;
let lastVersionAt = 0;
const AUTO_VERSION_MS = 10 * 60 * 1000;

function markLoaded(project: Project) {
  lastSaved = project;
  baseUpdatedAt = project.updatedAt;
}

/** Debounced autosave of the open project. */
export function startAutosave() {
  const unsub = useEditor.subscribe((state, prev) => {
    if (!state.project || state.project === prev.project || state.project === lastSaved) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void flushSave(), 600);
  });
  const flush = () => void flushSave();
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", flush);
  return () => {
    unsub();
    window.removeEventListener("pagehide", flush);
    document.removeEventListener("visibilitychange", flush);
  };
}

export async function flushSave() {
  const st = useEditor.getState();
  const project = st.project;
  if (!project || project === lastSaved) return;
  st.set({ saveState: "saving" });
  try {
    // Conflict detection: another tab saved newer work to the same project.
    const stored = await localProjects.load(project.id);
    if (stored && stored.updatedAt > baseUpdatedAt) {
      const copy: Project = { ...project, id: uid("p"), name: `${project.name} (conflicted copy)`, updatedAt: Date.now() };
      await localProjects.save(copy);
      markLoaded(copy);
      useEditor.setState({ project: copy, saveState: "saved" });
      useEditor.getState().toast("This project was changed in another tab. Your edits were saved as a separate copy so nothing is overwritten.", "info");
      return;
    }
    const toSave = { ...project, updatedAt: Date.now() };
    await localProjects.save(toSave);
    lastSaved = project;
    baseUpdatedAt = toSave.updatedAt;
    if (Date.now() - lastVersionAt > AUTO_VERSION_MS) {
      lastVersionAt = Date.now();
      await versionStore.add(project.id, { id: uid("v"), label: "Autosave", createdAt: Date.now(), auto: true, project: toSave });
    }
    if (useEditor.getState().project === project) useEditor.getState().set({ saveState: "saved" });
  } catch {
    useEditor.getState().set({ saveState: "error" });
    useEditor.getState().toast("Couldn't save to this browser's storage. Export your project to keep a copy.", "error");
  }
}

function collectAssetIds(project: Project): string[] {
  return Object.keys(project.assets);
}

export async function openProject(id: string): Promise<boolean> {
  await flushSave();
  const project = await localProjects.load(id);
  if (!project) return false;
  let migrated: Project;
  try {
    migrated = migrateProject(project);
  } catch {
    useEditor.getState().toast("This project couldn't be opened. It may be damaged.", "error");
    return false;
  }
  const missing = await hydrateSources(collectAssetIds(migrated));
  markLoaded(migrated);
  lastVersionAt = Date.now();
  useEditor.getState().load(migrated);
  updatePrefs({ lastProjectId: id });
  if (missing.length) useEditor.getState().toast(`${missing.length} image(s) are missing from this browser. Re-upload them.`, "error");
  return true;
}

export async function newProject(opts: Parameters<typeof createProject>[0] = {}) {
  await flushSave();
  const project = createProject(opts);
  await localProjects.save(project);
  markLoaded(project);
  useEditor.getState().load(project);
  updatePrefs({ lastProjectId: project.id });
  return project;
}

export async function duplicateProject(id: string) {
  const source = await localProjects.load(id);
  if (!source) return null;
  const copy: Project = { ...structuredClone(source), id: uid("p"), name: `${source.name} copy`, createdAt: Date.now(), updatedAt: Date.now() };
  await localProjects.save(copy);
  return copy;
}

export async function deleteProject(id: string) {
  await localProjects.remove(id);
  if (useEditor.getState().project?.id === id) {
    const rest = await localProjects.list();
    if (rest.length) await openProject(rest[0].id);
    else await newProject({ sample: false });
  }
}

export async function renameProject(id: string, name: string) {
  if (useEditor.getState().project?.id === id) useEditor.getState().edit((d) => void (d.name = name), "name");
  else {
    const p = await localProjects.load(id);
    if (p) await localProjects.save({ ...p, name, updatedAt: Date.now() });
  }
}

// --- Files --------------------------------------------------------------------

export async function exportProjectFile(project: Project): Promise<string> {
  const sources: Record<string, string> = {};
  for (const id of collectAssetIds(project)) {
    const blob = await assetStore.get(id);
    if (blob) sources[id] = await blobToDataUrl(blob);
  }
  const file: ProjectFile = { format: "signature-studio.file", exportedAt: Date.now(), project, sources };
  return JSON.stringify(file, null, 2);
}

/** Import never overwrites: it always creates a new project. */
export async function importProjectFile(text: string): Promise<Project> {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }
  const file = data as Partial<ProjectFile>;
  const raw = file?.format === "signature-studio.file" ? file.project : data;
  const project = migrateProject(raw);
  const fresh: Project = { ...project, id: uid("p"), name: project.name, updatedAt: Date.now() };
  if (file?.sources) {
    for (const [id, url] of Object.entries(file.sources)) {
      if (typeof url !== "string" || !/^data:image\/(png|jpeg|webp|gif|svg\+xml);base64,/.test(url)) continue;
      if (!fresh.assets[id]) continue;
      await ingestDataUrl(id, url);
    }
  }
  await localProjects.save(fresh);
  return fresh;
}

// --- Versions -----------------------------------------------------------------

export async function saveVersion(label: string) {
  const project = useEditor.getState().project;
  if (!project) return;
  await versionStore.add(project.id, { id: uid("v"), label, createdAt: Date.now(), auto: false, project: structuredClone(project) });
}

export async function restoreVersion(projectId: string, versionId: string) {
  const versions = await versionStore.list(projectId);
  const v = versions.find((x) => x.id === versionId);
  const current = useEditor.getState().project;
  if (!v || !current) return;
  // Keep the current state recoverable before restoring.
  await versionStore.add(projectId, { id: uid("v"), label: "Before restore", createdAt: Date.now(), auto: false, project: structuredClone(current) });
  useEditor.getState().edit((d) => {
    const restored = structuredClone(v.project);
    d.root = restored.root;
    d.theme = restored.theme;
    d.profile = restored.profile;
    d.assets = { ...d.assets, ...restored.assets };
    d.templateId = restored.templateId;
  });
}

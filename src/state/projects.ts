/**
 * Serialized persistence. Failed saves block navigation, and conflict forks
 * rebase the entire history so undo can never write to the original project.
 */
import { uid } from "../lib/id";
import { migrateProject, type ProjectFile } from "../model/schema";
import { walk } from "../model/tree";
import type { Project } from "../model/types";
import { assetStore, localProjects, versionStore } from "../storage/db";
import { createProject } from "../templates/starter";
import { blobToDataUrl, hydrateSources, ingestFile, MAX_UPLOAD_BYTES } from "./assets";
import { updatePrefs } from "./prefs";
import { useEditor } from "./store";

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let lastSaved: Project | null = null;
let baseUpdatedAt = 0;
let lastVersionAt = 0;
let queue: Promise<boolean> = Promise.resolve(true);
let transition = 0;
const AUTO_VERSION_MS = 10 * 60 * 1000;
function markLoaded(project: Project) { lastSaved = project; baseUpdatedAt = project.updatedAt; }
function cancelTimer() { if (saveTimer) clearTimeout(saveTimer); saveTimer = null; }

export function startAutosave() {
  const unsub = useEditor.subscribe((state, prev) => {
    if (!state.project || state.project === prev.project || state.project === lastSaved) return;
    cancelTimer();
    saveTimer = setTimeout(() => void flushSave(), 600);
  });
  const flush = () => { if (document.visibilityState !== "visible") void flushSave(); };
  const pagehide = () => void flushSave();
  window.addEventListener("pagehide", pagehide);
  document.addEventListener("visibilitychange", flush);
  return () => { unsub(); cancelTimer(); window.removeEventListener("pagehide", pagehide); document.removeEventListener("visibilitychange", flush); };
}
async function saveNow(): Promise<boolean> {
  const project = useEditor.getState().project;
  if (!project || project === lastSaved) return true;
  useEditor.getState().set({ saveState: "saving" });
  try {
    const write = async () => {
      const stored = await localProjects.load(project.id);
      if (stored && stored.updatedAt > baseUpdatedAt) {
        const copy = { ...project, id: uid("p"), name: `${project.name} (conflicted copy)`, updatedAt: Date.now() };
        await localProjects.save(copy);
        if (useEditor.getState().project?.id === project.id) {
          const unchanged = useEditor.getState().project === project;
          useEditor.getState().rebaseIdentity(copy.id, copy.name);
          if (unchanged) { useEditor.setState({ project: copy }); markLoaded(copy); }
          else { lastSaved = copy; baseUpdatedAt = copy.updatedAt; }
          useEditor.getState().set({ saveState: unchanged ? "saved" : "unsaved" });
          updatePrefs({ lastProjectId: copy.id });
        }
        useEditor.getState().toast("Another tab changed this project. Your work and undo history are now in a separate copy.", "info");
        return;
      }
      const toSave = { ...project, updatedAt: Math.max(Date.now(), (stored?.updatedAt ?? 0) + 1) };
      await localProjects.save(toSave);
      if (useEditor.getState().project?.id === project.id) {
        lastSaved = project; baseUpdatedAt = toSave.updatedAt;
        if (useEditor.getState().project === project) useEditor.getState().set({ saveState: "saved" });
      }
      // A failed optional snapshot must not misreport a successfully saved design.
      if (Date.now() - lastVersionAt > AUTO_VERSION_MS) {
        lastVersionAt = Date.now();
        await versionStore.add(project.id, { id: uid("v"), label: "Autosave", createdAt: Date.now(), auto: true, project: toSave }).catch(() => {});
      }
    };
    if (typeof navigator !== "undefined" && navigator.locks) await navigator.locks.request("signature-studio-save", write);
    else await write();
    return true;
  } catch {
    if (useEditor.getState().project?.id === project.id) useEditor.getState().set({ saveState: "error" });
    useEditor.getState().toast("Couldn't save. Your open design is preserved; export it or retry before switching projects.", "error");
    return false;
  }
}
export function flushSave(): Promise<boolean> {
  cancelTimer();
  queue = queue.then(saveNow, saveNow);
  return queue;
}
function collectAssetIds(project: Project) { return Object.keys(project.assets); }
export async function openProject(id: string): Promise<boolean> {
  const operation = ++transition;
  if (!(await flushSave())) return false;
  const leaving = useEditor.getState().project;
  const raw = await localProjects.load(id);
  if (!raw) return false;
  let project: Project;
  try { project = migrateProject(raw); }
  catch { useEditor.getState().toast("This project couldn't be opened. It may be damaged.", "error"); return false; }
  const missing = await hydrateSources(collectAssetIds(project));
  if (operation !== transition) return false;
  if (useEditor.getState().project !== leaving && !(await flushSave())) return false;
  if (operation !== transition) return false;
  markLoaded(project); lastVersionAt = Date.now();
  useEditor.getState().load(project); updatePrefs({ lastProjectId: id });
  if (missing.length) useEditor.getState().toast(`${missing.length} image(s) are missing. Re-upload them.`, "error");
  return true;
}
export async function newProject(opts: Parameters<typeof createProject>[0] = {}) {
  const operation = ++transition;
  if (!(await flushSave())) throw new Error("Save or export your current design before creating another.");
  const leaving = useEditor.getState().project;
  const project = createProject(opts);
  await localProjects.save(project);
  if (operation !== transition) return project;
  if (useEditor.getState().project !== leaving && !(await flushSave())) throw new Error("Your open design could not be saved. It has been preserved.");
  if (operation !== transition) return project;
  markLoaded(project);
  useEditor.getState().load(project); updatePrefs({ lastProjectId: project.id });
  return project;
}
export async function duplicateProject(id: string) {
  const active = useEditor.getState().project;
  const source = active?.id === id ? active : await localProjects.load(id);
  if (!source) return null;
  const copy = { ...structuredClone(source), id: uid("p"), name: `${source.name} copy`, createdAt: Date.now(), updatedAt: Date.now() };
  await localProjects.save(copy);
  return copy;
}
export async function deleteProject(id: string) {
  ++transition;
  cancelTimer(); await queue;
  if (useEditor.getState().project?.id === id) {
    useEditor.setState({ project: null, selection: null, selections: [], past: [], future: [], gestureBase: null });
    lastSaved = null; baseUpdatedAt = 0;
  }
  await localProjects.remove(id);
  if (!useEditor.getState().project) {
    const rest = await localProjects.list();
    if (rest.length) await openProject(rest[0].id);
    else await newProject({ sample: false });
  }
}
export async function renameProject(id: string, name: string) {
  if (useEditor.getState().project?.id === id) useEditor.getState().edit(d => { d.name = name; }, "name");
  else { const p = await localProjects.load(id); if (p) await localProjects.save({ ...p, name, updatedAt: Date.now() }); }
}
export async function exportProjectFile(project: Project) {
  const sources: Record<string, string> = {};
  for (const id of collectAssetIds(project)) { const blob = await assetStore.get(id); if (blob) sources[id] = await blobToDataUrl(blob); }
  const file: ProjectFile = { format: "signature-studio.file", exportedAt: Date.now(), project, sources };
  return JSON.stringify(file, null, 2);
}
export async function importProjectFile(text: string): Promise<Project> {
  if (text.length > 50 * 1024 * 1024) throw new Error("This project file is too large.");
  let data: unknown;
  try { data = JSON.parse(text); } catch { throw new Error("That file isn't valid JSON."); }
  const file = data as Partial<ProjectFile>;
  const project = migrateProject(file?.format === "signature-studio.file" ? file.project : data);
  const fresh: Project = { ...project, id: uid("p"), published: {}, assets: {}, updatedAt: Date.now() };
  const remap = new Map<string, string>();
  for (const [oldId, meta] of Object.entries(project.assets)) {
    const source = file?.format === "signature-studio.file" ? file.sources?.[oldId] : undefined;
    if (source) {
      if (typeof source !== "string" || source.length > MAX_UPLOAD_BYTES * 1.4 || !/^data:image\/(png|jpeg|webp|gif|svg\+xml);base64,/.test(source)) throw new Error("An embedded image is invalid or too large.");
      const blob = await (await fetch(source)).blob();
      const safe = await ingestFile(blob, meta.name);
      fresh.assets[safe.id] = safe; remap.set(oldId, safe.id);
    } else {
      // Preserve a missing-image slot without aliasing another project's blob.
      const id = uid("a"); fresh.assets[id] = { ...meta, id }; remap.set(oldId, id);
    }
  }
  walk(fresh.root, ({ node }) => { if (node.type === "image" && node.props.assetId && remap.has(node.props.assetId)) node.props.assetId = remap.get(node.props.assetId); });
  fresh.profile.socials.forEach(s => { if (s.iconAssetId && remap.has(s.iconAssetId)) s.iconAssetId = remap.get(s.iconAssetId); });
  await localProjects.save(fresh); return fresh;
}
export async function saveVersion(label: string) {
  const project = useEditor.getState().project;
  if (project) await versionStore.add(project.id, { id: uid("v"), label, createdAt: Date.now(), auto: false, project: structuredClone(project) });
}
export async function restoreVersion(projectId: string, versionId: string) {
  const v = (await versionStore.list(projectId)).find(x => x.id === versionId);
  const current = useEditor.getState().project;
  if (!v || !current || current.id !== projectId) return;
  await saveVersion("Before restore");
  const restored = migrateProject(v.project);
  await hydrateSources(collectAssetIds(restored));
  if (useEditor.getState().project !== current) { useEditor.getState().toast("Your design changed while the version was loading. Review and restore again.", "info"); return; }
  useEditor.getState().edit(d => { d.root = restored.root; d.theme = restored.theme; d.profile = restored.profile; d.assets = { ...d.assets, ...restored.assets }; d.templateId = restored.templateId; });
}

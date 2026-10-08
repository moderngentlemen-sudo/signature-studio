/**
 * Local persistence (IndexedDB). Projects, image sources, saved components,
 * brand kits and named versions live in the browser so users can start
 * without an account. A `ProjectRepository` interface keeps the door open
 * for cloud sync (Phase 5).
 */
import { createStore, del, entries, get, set, type UseStore } from "idb-keyval";
import type { Project, SigNode, ThemeColors } from "../model/types";

let stores: { projects: UseStore; assets: UseStore; library: UseStore; versions: UseStore } | null = null;

function db() {
  if (!stores) {
    stores = {
      projects: createStore("ss-projects", "projects"),
      assets: createStore("ss-assets", "assets"),
      library: createStore("ss-library", "library"),
      versions: createStore("ss-versions", "versions"),
    };
  }
  return stores;
}

export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: number;
  templateId?: string;
}

export interface ProjectRepository {
  list(): Promise<ProjectSummary[]>;
  load(id: string): Promise<Project | null>;
  save(project: Project): Promise<void>;
  remove(id: string): Promise<void>;
}

export const localProjects: ProjectRepository = {
  async list() {
    const all = await entries<string, Project>(db().projects);
    return all.map(([, p]) => ({ id: p.id, name: p.name, updatedAt: p.updatedAt, templateId: p.templateId })).sort((a, b) => b.updatedAt - a.updatedAt);
  },
  load: (id) => get<Project>(id, db().projects).then((p) => p ?? null),
  save: (project) => set(project.id, project, db().projects),
  async remove(id) {
    await del(id, db().projects);
    await del(id, db().versions);
  },
};

// --- Asset blobs ---------------------------------------------------------------

export const assetStore = {
  put: (id: string, blob: Blob) => set(id, blob, db().assets),
  get: (id: string) => get<Blob>(id, db().assets).then((b) => b ?? null),
  remove: (id: string) => del(id, db().assets),
};

// --- Library: saved components, brand kits, preferences ------------------------

export interface SavedComponent {
  id: string;
  name: string;
  node: SigNode;
  createdAt: number;
}

export interface BrandKit {
  id: string;
  name: string;
  colors: ThemeColors;
  fonts: { display: string; body: string };
  createdAt: number;
}

export interface Prefs {
  favorites: string[];
  recent: string[];
  lastProjectId?: string;
  mode: "simple" | "advanced";
  onboarded: boolean;
  publishConsent: boolean;
  host?: { endpoint: string; token?: string };
}

export const DEFAULT_PREFS: Prefs = { favorites: [], recent: [], mode: "simple", onboarded: false, publishConsent: false };

export const libraryStore = {
  async components(): Promise<SavedComponent[]> {
    return (await get<SavedComponent[]>("components", db().library)) ?? [];
  },
  saveComponents: (list: SavedComponent[]) => set("components", list, db().library),
  async kits(): Promise<BrandKit[]> {
    return (await get<BrandKit[]>("kits", db().library)) ?? [];
  },
  saveKits: (list: BrandKit[]) => set("kits", list, db().library),
  async prefs(): Promise<Prefs> {
    return { ...DEFAULT_PREFS, ...((await get<Prefs>("prefs", db().library)) ?? {}) };
  },
  savePrefs: (prefs: Prefs) => set("prefs", prefs, db().library),
};

// --- Named versions (local revision history) -----------------------------------

export interface ProjectVersion {
  id: string;
  label: string;
  createdAt: number;
  auto: boolean;
  project: Project;
}

const MAX_AUTO_VERSIONS = 20;

export const versionStore = {
  async list(projectId: string): Promise<ProjectVersion[]> {
    return (await get<ProjectVersion[]>(projectId, db().versions)) ?? [];
  },
  async add(projectId: string, version: ProjectVersion) {
    const list = await versionStore.list(projectId);
    list.unshift(version);
    // Keep every named version; cap automatic ones.
    let autos = 0;
    const kept = list.filter((v) => !v.auto || ++autos <= MAX_AUTO_VERSIONS);
    await set(projectId, kept, db().versions);
  },
  async remove(projectId: string, versionId: string) {
    const list = await versionStore.list(projectId);
    await set(
      projectId,
      list.filter((v) => v.id !== versionId),
      db().versions,
    );
  },
};

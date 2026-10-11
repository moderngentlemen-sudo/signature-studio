/** Saved components and brand kits (local library). */
import { create } from "zustand";
import { uid } from "../lib/id";
import { cloneWithNewIds, nodeLabel, walk } from "../model/tree";
import type { SigNode, Theme } from "../model/types";
import { assetStore, libraryStore, type BrandKit, type SavedComponent } from "../storage/db";
import { assetSchema, parseComponent } from "../model/schema";
import { blobToDataUrl, hydrateSources, ingestFile } from "../state/assets";
import { BUILTINS } from "../model/builtins";
import { useEditor } from "../state/store";

interface LibraryState {
  components: SavedComponent[];
  kits: BrandKit[];
  loaded: boolean;
}

export const useLibrary = create<LibraryState>(() => ({ components: [], kits: [], loaded: false }));

export async function loadLibrary() {
  const [components, kits] = await Promise.all([libraryStore.components(), libraryStore.kits()]);
  await hydrateSources([...new Set(components.flatMap(c => Object.keys(c.assets ?? {})))]);
  useLibrary.setState({ components, kits, loaded: true });
}

export async function saveComponent(node: SigNode, name?: string) {
  const item: SavedComponent = { id: uid("sc"), name: name ?? nodeLabel(node), node: cloneWithNewIds(node), createdAt: Date.now() };
  const project = useEditor.getState().project;
  item.assets = {}; item.sources = {};
  const ids = new Set<string>();
  walk(node, ({ node: n }) => { if (n.type === "image" && n.props.assetId) ids.add(n.props.assetId); });
  for (const id of ids) {
    if (project?.assets[id]) item.assets[id] = { ...project.assets[id] };
    const blob = await assetStore.get(id);
    if (blob) item.sources[id] = await blobToDataUrl(blob);
  }
  const components = [item, ...useLibrary.getState().components];
  await libraryStore.saveComponents(components);
  useLibrary.setState({ components });
  useEditor.getState().toast(`Saved “${item.name}” to My components`, "success");
}

export async function removeComponent(id: string) {
  const components = useLibrary.getState().components.filter((c) => c.id !== id);
  useLibrary.setState({ components });
  await libraryStore.saveComponents(components);
}

export async function importComponents(list: SavedComponent[]) {
  const fresh: SavedComponent[] = [];
  for (const c of list) {
    const node = cloneWithNewIds(parseComponent(c.node));
    const assets: NonNullable<SavedComponent["assets"]> = {}, sources: NonNullable<SavedComponent["sources"]> = {};
    const mapping = new Map<string, string>();
    for (const [oldId, raw] of Object.entries(c.assets ?? {})) {
      const meta = assetSchema.parse(raw);
      const url = c.sources?.[oldId];
      if (!url || url.length > 22 * 1024 * 1024 || !/^data:image\/(png|jpeg|webp|gif|svg\+xml);base64,/.test(url)) throw new Error("A saved component image is missing or invalid.");
      const safe = await ingestFile(await (await fetch(url)).blob(), meta.name);
      assets[safe.id] = safe; sources[safe.id] = await blobToDataUrl((await assetStore.get(safe.id))!); mapping.set(oldId, safe.id);
    }
    walk(node, ({ node: n }) => {
      if (n.type !== "image" || !n.props.assetId || BUILTINS[n.props.assetId]) return;
      if (!mapping.has(n.props.assetId)) throw new Error("A component is missing its image source. Re-export it from the original project.");
      n.props.assetId = mapping.get(n.props.assetId);
    });
    fresh.push({ id: uid("sc"), name: c.name.slice(0, 120), node, assets, sources, createdAt: Date.now() });
  }
  const components = [...fresh, ...useLibrary.getState().components];
  await libraryStore.saveComponents(components);
  useLibrary.setState({ components });
  return fresh.length;
}

export async function saveKit(name: string, theme: Theme) {
  const kit: BrandKit = { id: uid("bk"), name, colors: { ...theme.colors }, fonts: { ...theme.fonts }, createdAt: Date.now() };
  const kits = [kit, ...useLibrary.getState().kits];
  useLibrary.setState({ kits });
  await libraryStore.saveKits(kits);
  return kit;
}

export async function removeKit(id: string) {
  const kits = useLibrary.getState().kits.filter((k) => k.id !== id);
  useLibrary.setState({ kits });
  await libraryStore.saveKits(kits);
}

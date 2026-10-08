/** Saved components and brand kits (local library). */
import { create } from "zustand";
import { uid } from "../lib/id";
import { cloneWithNewIds, nodeLabel } from "../model/tree";
import type { SigNode, Theme } from "../model/types";
import { libraryStore, type BrandKit, type SavedComponent } from "../storage/db";
import { useEditor } from "../state/store";

interface LibraryState {
  components: SavedComponent[];
  kits: BrandKit[];
  loaded: boolean;
}

export const useLibrary = create<LibraryState>(() => ({ components: [], kits: [], loaded: false }));

export async function loadLibrary() {
  const [components, kits] = await Promise.all([libraryStore.components(), libraryStore.kits()]);
  useLibrary.setState({ components, kits, loaded: true });
}

export async function saveComponent(node: SigNode, name?: string) {
  const item: SavedComponent = { id: uid("sc"), name: name ?? nodeLabel(node), node: cloneWithNewIds(node), createdAt: Date.now() };
  const components = [item, ...useLibrary.getState().components];
  useLibrary.setState({ components });
  await libraryStore.saveComponents(components);
  useEditor.getState().toast(`Saved “${item.name}” to My components`, "success");
}

export async function removeComponent(id: string) {
  const components = useLibrary.getState().components.filter((c) => c.id !== id);
  useLibrary.setState({ components });
  await libraryStore.saveComponents(components);
}

export async function importComponents(list: SavedComponent[]) {
  const fresh = list.map((c) => ({ ...c, id: uid("sc"), node: cloneWithNewIds(c.node) }));
  const components = [...fresh, ...useLibrary.getState().components];
  useLibrary.setState({ components });
  await libraryStore.saveComponents(components);
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

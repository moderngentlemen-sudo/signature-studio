import { create } from "zustand";
import { DEFAULT_PREFS, libraryStore, type Prefs } from "../storage/db";

export const usePrefs = create<Prefs & { loaded: boolean }>(() => ({ ...DEFAULT_PREFS, loaded: false }));

export async function loadPrefs() {
  const prefs = await libraryStore.prefs();
  usePrefs.setState({ ...prefs, loaded: true });
  return prefs;
}

export function updatePrefs(patch: Partial<Prefs>) {
  usePrefs.setState(patch);
  const { loaded: _loaded, ...prefs } = usePrefs.getState();
  void _loaded;
  void libraryStore.savePrefs(prefs);
}

export function toggleFavorite(id: string) {
  const fav = usePrefs.getState().favorites;
  updatePrefs({ favorites: fav.includes(id) ? fav.filter((f) => f !== id) : [id, ...fav] });
}

export function pushRecent(id: string) {
  updatePrefs({ recent: [id, ...usePrefs.getState().recent.filter((r) => r !== id)].slice(0, 8) });
}

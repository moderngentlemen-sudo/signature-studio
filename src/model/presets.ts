import type { ThemeColors } from "./types";

export interface PalettePreset {
  id: string;
  name: string;
  colors: ThemeColors;
}

export const PALETTES: PalettePreset[] = [
  { id: "atelier", name: "Atelier", colors: { ink: "#16150f", muted: "#6b675d", accent: "#a8834a", link: "#16150f", surface: "#f4efe6", rule: "#d8d0c2" } },
  { id: "noir", name: "Noir", colors: { ink: "#0b0b0b", muted: "#5c5c5c", accent: "#0b0b0b", link: "#0b0b0b", surface: "#f2f2f2", rule: "#cfcfcf" } },
  { id: "navy", name: "Harbour", colors: { ink: "#14213d", muted: "#5b6478", accent: "#c79a3b", link: "#14213d", surface: "#eef1f6", rule: "#cdd3df" } },
  { id: "forest", name: "Estate", colors: { ink: "#1f2a22", muted: "#5d685f", accent: "#4f6b4a", link: "#1f2a22", surface: "#eef1ea", rule: "#ccd4c6" } },
  { id: "bordeaux", name: "Bordeaux", colors: { ink: "#2a1418", muted: "#6e5a5d", accent: "#7d1f2e", link: "#2a1418", surface: "#f6eeee", rule: "#dcc9cb" } },
  { id: "slate", name: "Slate", colors: { ink: "#1e2329", muted: "#66707b", accent: "#3b82f6", link: "#1e2329", surface: "#eef2f6", rule: "#d3dae2" } },
  {
    id: "terracotta",
    name: "Terracotta",
    colors: { ink: "#2b1d16", muted: "#7a6458", accent: "#c0603a", link: "#2b1d16", surface: "#f8eee8", rule: "#e3cfc3" },
  },
  { id: "sage", name: "Sage", colors: { ink: "#263029", muted: "#6d776f", accent: "#8aa38b", link: "#263029", surface: "#f0f3ef", rule: "#d5ddd5" } },
  { id: "plum", name: "Plum", colors: { ink: "#231a2b", muted: "#6c6273", accent: "#7a4f9a", link: "#231a2b", surface: "#f3eef6", rule: "#dcd2e3" } },
  {
    id: "citrus",
    name: "Studio Citrus",
    colors: { ink: "#151515", muted: "#5f5f5f", accent: "#e8a317", link: "#151515", surface: "#fff7e4", rule: "#ead9b0" },
  },
  { id: "ocean", name: "Coastal", colors: { ink: "#0f2a33", muted: "#58707a", accent: "#1c8a9a", link: "#0f2a33", surface: "#e9f4f5", rule: "#c8dfe2" } },
  { id: "rose", name: "Blush", colors: { ink: "#2d1f22", muted: "#7a676b", accent: "#c27c88", link: "#2d1f22", surface: "#faf0f1", rule: "#ead5d8" } },
];

export interface TypePreset {
  id: string;
  name: string;
  display: string;
  body: string;
  note: string;
}

export const TYPE_PRESETS: TypePreset[] = [
  { id: "classic", name: "Classic", display: "cormorant", body: "helvetica", note: "Refined serif names, clean sans details" },
  { id: "editorial", name: "Editorial", display: "playfair", body: "georgia", note: "Magazine contrast" },
  { id: "modern", name: "Modern", display: "inter", body: "inter", note: "Neutral, precise, contemporary" },
  { id: "geometric", name: "Geometric", display: "montserrat", body: "helvetica", note: "Confident geometric sans" },
  { id: "safe-serif", name: "Inbox-safe serif", display: "georgia", body: "georgia", note: "Renders identically everywhere" },
  { id: "safe-sans", name: "Inbox-safe sans", display: "helvetica", body: "helvetica", note: "Renders identically everywhere" },
  { id: "literary", name: "Literary", display: "libre-baskerville", body: "georgia", note: "Bookish and warm" },
  { id: "studio", name: "Studio", display: "space-grotesk", body: "helvetica", note: "Technical, creative edge" },
  { id: "avant", name: "Avant", display: "syne", body: "jost", note: "Expressive display" },
  { id: "humanist", name: "Humanist", display: "fraunces", body: "work-sans", note: "Soft, friendly, premium" },
];

/**
 * Curated font library. Every font declares an email-safe fallback stack:
 * most recipients' mail clients ignore webfonts, so the fallback is what
 * they will actually see. "safe" fonts are installed on nearly every system.
 */
export interface FontDef {
  id: string;
  label: string;
  family: string;
  /** Email fallback stack (appended after the family). */
  fallback: string;
  category: "serif" | "sans" | "display" | "mono";
  /** true = system font, renders as designed in nearly every inbox. */
  safe: boolean;
  /** Google Fonts spec for loading in the editor. */
  google?: string;
  /** Human name of what recipients will most likely see. */
  seenAs: string;
}

const SERIF = "Georgia, 'Times New Roman', Times, serif";
const SANS = "Helvetica, Arial, sans-serif";

export const FONTS: FontDef[] = [
  { id: "georgia", label: "Georgia", family: "Georgia", fallback: "'Times New Roman', Times, serif", category: "serif", safe: true, seenAs: "Georgia" },
  { id: "times", label: "Times New Roman", family: "'Times New Roman'", fallback: "Times, serif", category: "serif", safe: true, seenAs: "Times New Roman" },
  {
    id: "palatino",
    label: "Palatino",
    family: "'Palatino Linotype'",
    fallback: "Palatino, 'Book Antiqua', Georgia, serif",
    category: "serif",
    safe: true,
    seenAs: "Palatino / Georgia",
  },
  {
    id: "helvetica",
    label: "Helvetica / Arial",
    family: "Helvetica",
    fallback: "Arial, sans-serif",
    category: "sans",
    safe: true,
    seenAs: "Helvetica or Arial",
  },
  { id: "verdana", label: "Verdana", family: "Verdana", fallback: "Geneva, sans-serif", category: "sans", safe: true, seenAs: "Verdana" },
  { id: "tahoma", label: "Tahoma", family: "Tahoma", fallback: "Verdana, Segoe, sans-serif", category: "sans", safe: true, seenAs: "Tahoma" },
  {
    id: "trebuchet",
    label: "Trebuchet MS",
    family: "'Trebuchet MS'",
    fallback: "'Lucida Grande', Arial, sans-serif",
    category: "sans",
    safe: true,
    seenAs: "Trebuchet MS",
  },
  {
    id: "system",
    label: "System UI",
    family: "-apple-system",
    fallback: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    category: "sans",
    safe: true,
    seenAs: "the reader's system font",
  },
  { id: "courier", label: "Courier", family: "'Courier New'", fallback: "Courier, monospace", category: "mono", safe: true, seenAs: "Courier New" },
  {
    id: "cormorant",
    label: "Cormorant Garamond",
    family: "'Cormorant Garamond'",
    fallback: SERIF,
    category: "serif",
    safe: false,
    google: "Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400",
    seenAs: "Georgia",
  },
  {
    id: "playfair",
    label: "Playfair Display",
    family: "'Playfair Display'",
    fallback: SERIF,
    category: "display",
    safe: false,
    google: "Playfair+Display:ital,wght@0,400;0,600;0,700;1,400",
    seenAs: "Georgia",
  },
  {
    id: "fraunces",
    label: "Fraunces",
    family: "Fraunces",
    fallback: SERIF,
    category: "serif",
    safe: false,
    google: "Fraunces:ital,wght@0,400;0,600;1,400",
    seenAs: "Georgia",
  },
  {
    id: "libre-baskerville",
    label: "Libre Baskerville",
    family: "'Libre Baskerville'",
    fallback: "Baskerville, " + SERIF,
    category: "serif",
    safe: false,
    google: "Libre+Baskerville:ital,wght@0,400;0,700;1,400",
    seenAs: "Baskerville / Georgia",
  },
  {
    id: "dm-serif",
    label: "DM Serif Display",
    family: "'DM Serif Display'",
    fallback: SERIF,
    category: "display",
    safe: false,
    google: "DM+Serif+Display:ital@0;1",
    seenAs: "Georgia",
  },
  {
    id: "inter",
    label: "Inter",
    family: "Inter",
    fallback: SANS,
    category: "sans",
    safe: false,
    google: "Inter:wght@300;400;500;600;700",
    seenAs: "Helvetica or Arial",
  },
  {
    id: "montserrat",
    label: "Montserrat",
    family: "Montserrat",
    fallback: SANS,
    category: "sans",
    safe: false,
    google: "Montserrat:wght@300;400;500;600;700",
    seenAs: "Helvetica or Arial",
  },
  {
    id: "jost",
    label: "Jost",
    family: "Jost",
    fallback: "'Century Gothic', " + SANS,
    category: "sans",
    safe: false,
    google: "Jost:wght@300;400;500;600",
    seenAs: "Century Gothic / Arial",
  },
  {
    id: "work-sans",
    label: "Work Sans",
    family: "'Work Sans'",
    fallback: SANS,
    category: "sans",
    safe: false,
    google: "Work+Sans:wght@300;400;500;600",
    seenAs: "Helvetica or Arial",
  },
  {
    id: "space-grotesk",
    label: "Space Grotesk",
    family: "'Space Grotesk'",
    fallback: SANS,
    category: "sans",
    safe: false,
    google: "Space+Grotesk:wght@400;500;600",
    seenAs: "Helvetica or Arial",
  },
  {
    id: "syne",
    label: "Syne",
    family: "Syne",
    fallback: SANS,
    category: "display",
    safe: false,
    google: "Syne:wght@500;600;700",
    seenAs: "Helvetica or Arial",
  },
  {
    id: "ibm-plex-mono",
    label: "IBM Plex Mono",
    family: "'IBM Plex Mono'",
    fallback: "'Courier New', monospace",
    category: "mono",
    safe: false,
    google: "IBM+Plex+Mono:wght@400;500",
    seenAs: "Courier New",
  },
];

export const FONT_MAP: Record<string, FontDef> = Object.fromEntries(FONTS.map((f) => [f.id, f]));

export function fontDef(id: string): FontDef {
  return FONT_MAP[id] ?? FONT_MAP.helvetica;
}

/** CSS font-family for a font id. In "fallback" mode the webfont is dropped. */
export function fontStack(id: string, fallbackOnly = false): string {
  const f = fontDef(id);
  if (fallbackOnly && !f.safe) return f.fallback;
  return `${f.family}, ${f.fallback}`;
}

/** Stylesheet URL loading every webfont used in the editor. */
export function googleFontsHref(ids: Iterable<string>): string | null {
  const specs = new Set<string>();
  for (const id of ids) {
    const g = FONT_MAP[id]?.google;
    if (g) specs.add(g);
  }
  if (!specs.size) return null;
  return `https://fonts.googleapis.com/css2?${[...specs].map((s) => `family=${s}`).join("&")}&display=swap`;
}

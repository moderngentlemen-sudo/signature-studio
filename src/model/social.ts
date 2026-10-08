import type { SocialPlatform } from "./types";

export interface PlatformDef {
  id: SocialPlatform;
  label: string;
  /** Brand colour, offered as a one-click option. */
  brand: string;
  /** Hostname patterns used to detect the platform from a pasted URL. */
  hosts: RegExp;
  /** Letter for the "letter" icon style. */
  letter: string;
  placeholder: string;
}

export const PLATFORMS: PlatformDef[] = [
  {
    id: "instagram",
    label: "Instagram",
    brand: "#E4405F",
    hosts: /(^|\.)instagram\.com$|(^|\.)instagr\.am$/,
    letter: "Ig",
    placeholder: "instagram.com/yourname",
  },
  { id: "linkedin", label: "LinkedIn", brand: "#0A66C2", hosts: /(^|\.)linkedin\.com$|(^|\.)lnkd\.in$/, letter: "in", placeholder: "linkedin.com/in/yourname" },
  { id: "x", label: "X", brand: "#000000", hosts: /(^|\.)x\.com$|(^|\.)twitter\.com$/, letter: "X", placeholder: "x.com/yourname" },
  {
    id: "facebook",
    label: "Facebook",
    brand: "#0866FF",
    hosts: /(^|\.)facebook\.com$|(^|\.)fb\.com$|(^|\.)fb\.me$/,
    letter: "f",
    placeholder: "facebook.com/yourpage",
  },
  { id: "tiktok", label: "TikTok", brand: "#000000", hosts: /(^|\.)tiktok\.com$/, letter: "Tk", placeholder: "tiktok.com/@yourname" },
  { id: "youtube", label: "YouTube", brand: "#FF0000", hosts: /(^|\.)youtube\.com$|(^|\.)youtu\.be$/, letter: "Yt", placeholder: "youtube.com/@yourchannel" },
  {
    id: "pinterest",
    label: "Pinterest",
    brand: "#BD081C",
    hosts: /(^|\.)pinterest\.[a-z.]+$|(^|\.)pin\.it$/,
    letter: "P",
    placeholder: "pinterest.com/yourname",
  },
  { id: "threads", label: "Threads", brand: "#000000", hosts: /(^|\.)threads\.(net|com)$/, letter: "@", placeholder: "threads.net/@yourname" },
  { id: "behance", label: "Behance", brand: "#1769FF", hosts: /(^|\.)behance\.net$/, letter: "Bē", placeholder: "behance.net/yourname" },
  { id: "dribbble", label: "Dribbble", brand: "#EA4C89", hosts: /(^|\.)dribbble\.com$/, letter: "Dr", placeholder: "dribbble.com/yourname" },
  { id: "vimeo", label: "Vimeo", brand: "#1AB7EA", hosts: /(^|\.)vimeo\.com$/, letter: "V", placeholder: "vimeo.com/yourname" },
  { id: "github", label: "GitHub", brand: "#181717", hosts: /(^|\.)github\.com$/, letter: "Gh", placeholder: "github.com/yourname" },
  { id: "custom", label: "Custom link", brand: "#16150f", hosts: /^$/, letter: "↗", placeholder: "https://…" },
];

export const PLATFORM_MAP: Record<SocialPlatform, PlatformDef> = Object.fromEntries(PLATFORMS.map((p) => [p.id, p])) as Record<SocialPlatform, PlatformDef>;

/** Detect a platform from a pasted URL; returns "custom" if unknown. */
export function detectPlatform(raw: string): SocialPlatform {
  const value = raw.trim();
  if (!value) return "custom";
  try {
    const url = new URL(/^[a-z]+:\/\//i.test(value) ? value : `https://${value}`);
    const host = url.hostname.toLowerCase();
    for (const p of PLATFORMS) if (p.id !== "custom" && p.hosts.test(host)) return p.id;
  } catch {
    /* not a URL */
  }
  return "custom";
}

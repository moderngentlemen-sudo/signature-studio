/**
 * Template library. A template is a *layout and look*: applying one keeps the
 * project's profile, socials and uploaded artwork (image slots are matched by
 * role), so switching templates never discards identity or images.
 */
import { badge, button, column, contact, divider, field, image, qr, row, social, spacer, stack, text } from "../model/factory";
import type { StackNode, TextStyle, Theme } from "../model/types";

export type TemplateCategory =
  | "Minimal"
  | "Executive"
  | "Editorial"
  | "Corporate"
  | "Luxury"
  | "Hospitality"
  | "Creative"
  | "Fashion"
  | "Media"
  | "Technology"
  | "Real estate"
  | "Consulting"
  | "Personal brand"
  | "Compact"
  | "Image-forward"
  | "Typographic"
  | "Architectural"
  | "Monogram"
  | "Partnership";

export interface TemplateLook {
  palette: string;
  type: string;
  theme?: Partial<Omit<Theme, "colors" | "fonts">>;
}

export interface Template {
  id: string;
  name: string;
  category: TemplateCategory;
  description: string;
  tags: string[];
  look: TemplateLook;
  build: () => StackNode;
}

// --- shared text styles ------------------------------------------------------

const t = (s: TextStyle): TextStyle => s;
const NAME = (o: TextStyle = {}) => t({ font: "$display", size: 22, weight: 500, lineHeight: 1.15, ...o });
const CAPS = (o: TextStyle = {}) => t({ size: 10.5, tracking: 0.16, transform: "uppercase", color: "$muted", weight: 500, ...o });
const MUTED = (o: TextStyle = {}) => t({ color: "$muted", ...o });
const SMALL = (o: TextStyle = {}) => t({ size: 11.5, ...o });
const FINE = (o: TextStyle = {}) => t({ size: 9.5, color: "$muted", lineHeight: 1.5, ...o });

const disclaimer = () =>
  text("This message may contain confidential information. If you received it in error, please notify the sender and delete it.", {
    name: "Disclaimer",
    visibility: "full",
    text: FINE(),
    box: { width: 460 },
  });

const socials = (o: Parameters<typeof social>[0] = {}) => social({ visibility: "full", ...o });

// --- templates -----------------------------------------------------------------

export const TEMPLATES: Template[] = [
  // ── Minimal ──────────────────────────────────────────────────────────────
  {
    id: "minimal-ledger",
    name: "Ledger",
    category: "Minimal",
    description: "Name, title and a hairline rule above stacked contacts.",
    tags: ["simple", "clean", "stacked"],
    look: { palette: "noir", type: "modern" },
    build: () =>
      stack(
        [
          field("fullName", { text: NAME({ size: 18, weight: 600 }) }),
          field("title", { text: MUTED({ size: 12 }) }),
          divider({ length: 40, thickness: 1, color: "$ink" }),
          contact(["phone", "email", "website"], { labels: "none", gap: 1 }),
        ],
        { name: "Signature", gap: 5 },
      ),
  },
  {
    id: "minimal-line",
    name: "Single Line",
    category: "Minimal",
    description: "Everything on two quiet lines. Ideal for replies.",
    tags: ["compact", "inline", "reply"],
    look: { palette: "slate", type: "safe-sans", theme: { size: 12 } },
    build: () =>
      stack(
        [
          row([column([field("fullName", { text: t({ weight: 700, size: 13 }) })]), column([field("title", { text: MUTED({ size: 13 }) })])], { gap: 8 }),
          contact(["phone", "email", "website"], { layout: "inline", labels: "none", separator: "bar", text: MUTED() }),
        ],
        { name: "Signature", gap: 3 },
      ),
  },
  {
    id: "minimal-whitespace",
    name: "Whitespace",
    category: "Minimal",
    description: "Generous air, lower-case details, small socials.",
    tags: ["airy", "lowercase"],
    look: { palette: "sage", type: "humanist", theme: { gap: 10 } },
    build: () =>
      stack(
        [
          field("fullName", { text: NAME({ size: 20, weight: 400 }) }),
          field("title", { text: MUTED({ transform: "lowercase", italic: true }) }),
          contact(["email", "website"], { layout: "inline", labels: "none", separator: "none", gap: 8, text: t({ transform: "lowercase" }) }),
          socials({ style: "bare", size: 15, gap: 10, color: "$muted" }),
        ],
        { name: "Signature" },
      ),
  },

  // ── Executive ────────────────────────────────────────────────────────────
  {
    id: "exec-boardroom",
    name: "Boardroom",
    category: "Executive",
    description: "Logo column, vertical rule, authoritative name block.",
    tags: ["logo", "two-column", "divider"],
    look: { palette: "navy", type: "classic" },
    build: () =>
      stack(
        [
          row(
            [
              column([image("logo", { width: 92 })], { box: { valign: "middle" } }),
              column(
                [
                  field("fullName", { text: NAME() }),
                  field("title", { text: CAPS({ color: "$accent" }) }),
                  spacer(4),
                  contact(["phone", "mobile", "email", "website"], { labels: "short", gap: 1, text: SMALL() }),
                ],
                { gap: 3 },
              ),
            ],
            { gap: 22, divider: { width: 1, color: "$rule" } },
          ),
          disclaimer(),
        ],
        { name: "Signature", gap: 14 },
      ),
  },
  {
    id: "exec-chair",
    name: "Chairman",
    category: "Executive",
    description: "Portrait, name in small caps, company and direct lines.",
    tags: ["headshot", "two-column"],
    look: { palette: "atelier", type: "literary" },
    build: () =>
      stack(
        [
          row(
            [
              column([image("headshot", { width: 76 })], { box: { valign: "middle" } }),
              column(
                [
                  field("fullName", { text: NAME({ size: 19, transform: "uppercase", tracking: 0.06 }) }),
                  field("title", { text: MUTED({ italic: true }) }),
                  field("company", { text: t({ weight: 600 }) }),
                  contact(["phone", "email"], { layout: "inline", labels: "short", separator: "none", gap: 8, text: SMALL() }),
                ],
                { gap: 2 },
              ),
            ],
            { gap: 18 },
          ),
        ],
        { name: "Signature" },
      ),
  },
  {
    id: "exec-rule",
    name: "Gold Rule",
    category: "Executive",
    description: "A short accent rule anchors a classic stacked block.",
    tags: ["stacked", "accent"],
    look: { palette: "bordeaux", type: "editorial" },
    build: () =>
      stack(
        [
          field("intro", { text: MUTED({ italic: true }), visibility: "full" }),
          field("fullName", { text: NAME({ size: 24 }) }),
          divider({ length: 56, thickness: 2, color: "$accent" }),
          field("title", { text: CAPS() }),
          field("company", { text: t({ weight: 600, size: 12.5 }) }),
          contact(["phone", "email", "website", "address"], { gap: 1, labels: "full", text: SMALL() }),
          socials({ style: "outline", size: 20, color: "$accent" }),
        ],
        { name: "Signature", gap: 5 },
      ),
  },

  // ── Editorial ────────────────────────────────────────────────────────────
  {
    id: "editorial-masthead",
    name: "Masthead",
    category: "Editorial",
    description: "Oversized serif name with a kicker, like a magazine byline.",
    tags: ["serif", "large-type"],
    look: { palette: "noir", type: "editorial" },
    build: () =>
      stack(
        [
          field("company", { text: CAPS({ size: 9.5, tracking: 0.3, color: "$ink" }) }),
          field("fullName", { text: NAME({ size: 32, weight: 400, italic: true, lineHeight: 1.05 }) }),
          field("title", { text: MUTED({ size: 12 }) }),
          divider({ thickness: 1, color: "$ink", length: 300 }),
          contact(["email", "phone", "website"], { layout: "inline", labels: "none", separator: "slash", text: SMALL() }),
        ],
        { name: "Signature", gap: 6 },
      ),
  },
  {
    id: "editorial-column",
    name: "Op-Ed",
    category: "Editorial",
    description: "Tagline as a pull-quote beside the byline.",
    tags: ["quote", "two-column"],
    look: { palette: "terracotta", type: "literary" },
    build: () =>
      stack(
        [
          row(
            [
              column(
                [
                  field("fullName", { text: NAME({ size: 20 }) }),
                  field("title", { text: CAPS({ color: "$accent" }) }),
                  contact(["email", "website"], { gap: 1, labels: "none", text: SMALL() }),
                ],
                { gap: 3 },
              ),
              column([field("tagline", { text: t({ font: "$display", italic: true, size: 15, color: "$muted", lineHeight: 1.3 }) })], {
                visibility: "full",
                box: { width: 190, padX: 14, borderWidth: 2, borderColor: "$accent", borderSides: "left", valign: "middle" },
              }),
            ],
            { gap: 22 },
          ),
        ],
        { name: "Signature" },
      ),
  },

  // ── Corporate ────────────────────────────────────────────────────────────
  {
    id: "corp-standard",
    name: "Standard Issue",
    category: "Corporate",
    description: "Dependable layout with logo beneath and full contact block.",
    tags: ["logo", "stacked", "disclaimer"],
    look: { palette: "slate", type: "safe-sans" },
    build: () =>
      stack(
        [
          field("fullName", { text: t({ size: 15, weight: 700 }) }),
          field("title", { text: MUTED(), suffix: "" }),
          field("department", { text: MUTED({ size: 12 }) }),
          contact(["phone", "mobile", "email", "website"], { labels: "full", gap: 1, labelColor: "$muted", text: SMALL() }),
          image("logo", { width: 110 }),
          disclaimer(),
        ],
        { name: "Signature", gap: 5 },
      ),
  },
  {
    id: "corp-banded",
    name: "Banded",
    category: "Corporate",
    description: "A tinted header band with name and logo, details below.",
    tags: ["background", "band"],
    look: { palette: "navy", type: "geometric" },
    build: () =>
      stack(
        [
          row(
            [
              column(
                [
                  field("fullName", { text: t({ font: "$display", size: 17, weight: 600, color: "#ffffff" }) }),
                  field("title", { text: SMALL({ color: "#d7dceb" }) }),
                ],
                { gap: 2, box: { valign: "middle" } },
              ),
              column([image("logo", { width: 70, tint: "#ffffff" })], { box: { valign: "middle", align: "right" } }),
            ],
            { gap: 30, box: { background: "$ink", padX: 16, padY: 12, radius: 4, width: 420 } },
          ),
          contact(["phone", "email", "website"], { layout: "inline", labels: "short", separator: "none", gap: 8, text: SMALL() }),
          socials({ style: "tile", size: 20, background: "$ink" }),
        ],
        { name: "Signature", gap: 8 },
      ),
  },
  {
    id: "corp-grid",
    name: "Directory",
    category: "Corporate",
    description: "Two-column contact grid for people with many numbers.",
    tags: ["grid", "contacts"],
    look: { palette: "ocean", type: "modern" },
    build: () =>
      stack(
        [
          field("fullName", { text: NAME({ size: 17, weight: 600 }) }),
          field("title", { text: MUTED(), suffix: "" }),
          divider({ color: "$rule", length: 380 }),
          contact(["phone", "mobile", "email", "website", "address"], { layout: "grid", labels: "short", gap: 3, text: SMALL() }),
          image("logo", { width: 96 }),
        ],
        { name: "Signature", gap: 6 },
      ),
  },

  // ── Luxury ───────────────────────────────────────────────────────────────
  {
    id: "luxury-maison",
    name: "Maison",
    category: "Luxury",
    description: "Centred wordmark, spaced capitals and a fine rule.",
    tags: ["centred", "spaced-caps"],
    look: { palette: "atelier", type: "classic", theme: { align: "center" } },
    build: () =>
      stack(
        [
          image("logo", { width: 64, tint: "$ink" }),
          field("fullName", { text: NAME({ size: 20, transform: "uppercase", tracking: 0.22, weight: 400 }) }),
          field("title", { text: CAPS({ size: 9.5, tracking: 0.3, color: "$accent" }) }),
          divider({ length: 28, color: "$accent" }),
          contact(["phone", "email", "website"], { layout: "inline", labels: "none", separator: "diamond", gap: 6, text: SMALL({ tracking: 0.04 }) }),
          socials({ style: "bare", size: 14, gap: 12, color: "$accent" }),
        ],
        { name: "Signature", gap: 7 },
      ),
  },
  {
    id: "luxury-noir-card",
    name: "Black Card",
    category: "Luxury",
    description: "A dark card with brass details. Image-free text renders everywhere.",
    tags: ["dark", "card"],
    look: { palette: "atelier", type: "classic" },
    build: () =>
      stack(
        [
          stack(
            [
              field("fullName", { text: NAME({ size: 21, color: "#f4efe6", weight: 400, tracking: 0.04 }) }),
              field("title", { text: CAPS({ color: "$accent", size: 9.5, tracking: 0.28 }) }),
              spacer(6),
              contact(["phone", "email", "website"], { labels: "short", gap: 2, labelColor: "$accent", text: SMALL({ color: "#e9e2d4" }) }),
            ],
            { name: "Card", gap: 3, box: { background: "#16150f", padX: 22, padY: 18, radius: 6, width: 360 } },
          ),
        ],
        { name: "Signature" },
      ),
  },
  {
    id: "luxury-monogram-seal",
    name: "Seal",
    category: "Monogram",
    description: "Initials in a framed seal beside a refined name block.",
    tags: ["initials", "frame"],
    look: { palette: "bordeaux", type: "classic" },
    build: () =>
      stack(
        [
          row(
            [
              column(
                [
                  field("fullName", {
                    format: "initials",
                    text: t({ font: "$display", size: 24, color: "$accent", align: "center", tracking: 0.05 }),
                    box: { width: 58, padY: 12, borderWidth: 1, borderColor: "$accent", align: "center" },
                  }),
                ],
                { box: { valign: "middle" } },
              ),
              column(
                [
                  field("fullName", { text: NAME({ size: 19 }) }),
                  field("title", { text: MUTED({ italic: true }) }),
                  contact(["phone", "email"], { layout: "inline", labels: "none", separator: "dot", text: SMALL() }),
                ],
                { gap: 2, box: { valign: "middle" } },
              ),
            ],
            { gap: 16 },
          ),
        ],
        { name: "Signature" },
      ),
  },

  // ── Hospitality ──────────────────────────────────────────────────────────
  {
    id: "hosp-concierge",
    name: "Concierge",
    category: "Hospitality",
    description: "Warm welcome line, reservations button and address.",
    tags: ["button", "booking", "address"],
    look: { palette: "forest", type: "humanist" },
    build: () =>
      stack(
        [
          field("intro", { text: MUTED({ italic: true }), visibility: "full" }),
          field("fullName", { text: NAME({ size: 20 }) }),
          field("title", { text: MUTED() }),
          field("company", { text: t({ weight: 600 }) }),
          contact(["phone", "email", "address"], { gap: 1, labels: "none", text: SMALL() }),
          button("Reserve a table", { field: "booking", visibility: "full", color: "$accent", radius: 20, padX: 18 }),
          image("banner", { width: 440, visibility: "full" }),
        ],
        { name: "Signature", gap: 5 },
      ),
  },
  {
    id: "hosp-terrace",
    name: "Terrace",
    category: "Hospitality",
    description: "Logo and property name side by side with a soft tinted panel.",
    tags: ["panel", "logo"],
    look: { palette: "terracotta", type: "editorial" },
    build: () =>
      stack(
        [
          row(
            [
              column([image("logo", { width: 84 })], { box: { valign: "middle" } }),
              column(
                [
                  field("fullName", { text: NAME({ size: 19 }) }),
                  field("title", { text: CAPS({ color: "$accent" }) }),
                  contact(["phone", "website"], { layout: "inline", labels: "none", separator: "dot", text: SMALL() }),
                ],
                { gap: 3, box: { valign: "middle" } },
              ),
            ],
            { gap: 18, box: { background: "$surface", padX: 16, padY: 14, radius: 8 } },
          ),
          socials({ style: "circle", size: 20, background: "$accent" }),
        ],
        { name: "Signature", gap: 8 },
      ),
  },

  // ── Creative ─────────────────────────────────────────────────────────────
  {
    id: "creative-studio",
    name: "Studio",
    category: "Creative",
    description: "Big grotesk name, accent dot, portfolio link button.",
    tags: ["bold", "portfolio"],
    look: { palette: "citrus", type: "studio" },
    build: () =>
      stack(
        [
          field("fullName", { text: NAME({ size: 26, weight: 600, lineHeight: 1 }), suffix: "." }),
          field("title", { text: t({ size: 13, color: "$muted" }) }),
          contact(["email", "website"], { layout: "inline", labels: "none", separator: "slash", text: SMALL() }),
          row(
            [
              column([button("See the work", { field: "website", variant: "solid", color: "$ink", radius: 0, padY: 7 })]),
              column([socials({ style: "bare", size: 16, gap: 10, color: "$ink" })], { box: { valign: "middle" } }),
            ],
            { gap: 16, visibility: "full" },
          ),
        ],
        { name: "Signature", gap: 6 },
      ),
  },
  {
    id: "creative-split",
    name: "Split Field",
    category: "Creative",
    description: "Colour block column with initials, details alongside.",
    tags: ["colour-block", "initials"],
    look: { palette: "plum", type: "avant" },
    build: () =>
      stack(
        [
          row(
            [
              column([field("fullName", { format: "initials", text: t({ font: "$display", size: 26, weight: 700, color: "#ffffff", align: "center" }) })], {
                box: { background: "$accent", width: 74, padY: 22, align: "center", valign: "middle", radius: 6 },
              }),
              column(
                [
                  field("fullName", { text: NAME({ size: 19, weight: 600 }) }),
                  field("title", { text: MUTED() }),
                  contact(["phone", "email", "website"], { gap: 1, labels: "none", text: SMALL() }),
                ],
                { gap: 2, box: { valign: "middle" } },
              ),
            ],
            { gap: 16 },
          ),
        ],
        { name: "Signature" },
      ),
  },
  {
    id: "creative-gallery",
    name: "Gallery Wall",
    category: "Image-forward",
    description: "Name block over a wide artwork banner.",
    tags: ["banner", "artwork"],
    look: { palette: "noir", type: "studio" },
    build: () =>
      stack(
        [
          field("fullName", { text: NAME({ size: 18, weight: 600 }) }),
          field("title", { text: MUTED() }),
          contact(["email", "website"], { layout: "inline", labels: "none", separator: "bar", text: SMALL() }),
          image("banner", { width: 460, aspect: 3.2, visibility: "full" }),
          socials({ style: "bare", size: 15, gap: 12 }),
        ],
        { name: "Signature", gap: 6 },
      ),
  },

  // ── Fashion ──────────────────────────────────────────────────────────────
  {
    id: "fashion-lookbook",
    name: "Lookbook",
    category: "Fashion",
    description: "Wordmark-first, airy capitals, socials as text.",
    tags: ["wordmark", "text-socials"],
    look: { palette: "noir", type: "geometric" },
    build: () =>
      stack(
        [
          image("logo", { width: 180, tint: "$ink" }),
          field("fullName", { text: CAPS({ color: "$ink", size: 11, tracking: 0.24, weight: 600 }) }),
          field("title", { text: CAPS({ size: 9.5, tracking: 0.24 }) }),
          contact(["email", "phone"], { layout: "inline", labels: "none", separator: "none", gap: 10, text: SMALL({ tracking: 0.06 }) }),
          socials({ style: "text", color: "$ink", text: CAPS({ size: 9.5, color: "$ink", tracking: 0.2 }) }),
        ],
        { name: "Signature", gap: 7 },
      ),
  },
  {
    id: "fashion-atelier",
    name: "Atelier",
    category: "Fashion",
    description: "Portrait and name with italic title and brass socials.",
    tags: ["headshot", "italic"],
    look: { palette: "rose", type: "editorial" },
    build: () =>
      stack(
        [
          row(
            [
              column([image("headshot", { width: 88, shape: "rounded", aspect: 0.8, radius: 6 })]),
              column(
                [
                  field("fullName", { text: NAME({ size: 22, italic: true, weight: 400 }) }),
                  field("title", { text: CAPS({ color: "$accent" }) }),
                  spacer(4),
                  contact(["mobile", "email", "website"], { gap: 1, labels: "none", text: SMALL() }),
                  socials({ style: "circle", size: 18, background: "$accent", gap: 5 }),
                ],
                { gap: 3, box: { valign: "middle" } },
              ),
            ],
            { gap: 18 },
          ),
        ],
        { name: "Signature" },
      ),
  },

  // ── Media ────────────────────────────────────────────────────────────────
  {
    id: "media-broadcast",
    name: "Broadcast",
    category: "Media",
    description: "Show line, name and a watch-now call to action.",
    tags: ["button", "video"],
    look: { palette: "slate", type: "geometric" },
    build: () =>
      stack(
        [
          badge("ON AIR", {
            text: t({ size: 9, weight: 700, tracking: 0.2, color: "#ffffff" }),
            box: { background: "#d6332f", padX: 6, padY: 2, radius: 2 },
            visibility: "full",
          }),
          field("fullName", { text: NAME({ size: 20, weight: 700 }) }),
          field("title", { text: MUTED() }),
          contact(["email", "phone"], { layout: "inline", labels: "short", separator: "none", gap: 8, text: SMALL() }),
          button("Watch the latest episode", { field: "website", variant: "link", color: "$accent", visibility: "full" }),
          socials({ style: "tile", size: 20, background: "$ink", gap: 5 }),
        ],
        { name: "Signature", gap: 5 },
      ),
  },
  {
    id: "media-press",
    name: "Press Desk",
    category: "Media",
    description: "Newsroom-style byline with department and rules.",
    tags: ["rules", "newsroom"],
    look: { palette: "noir", type: "safe-serif" },
    build: () =>
      stack(
        [
          divider({ thickness: 3, color: "$ink", length: 320 }),
          field("fullName", { text: t({ font: "$display", size: 18, weight: 700 }) }),
          row([column([field("title", { text: SMALL({ italic: true }) })]), column([field("department", { text: SMALL({ color: "$muted" }) })])], { gap: 10 }),
          divider({ thickness: 1, color: "$ink", length: 320 }),
          contact(["phone", "email", "website"], { layout: "inline", labels: "short", separator: "bar", text: SMALL() }),
        ],
        { name: "Signature", gap: 5 },
      ),
  },

  // ── Technology ───────────────────────────────────────────────────────────
  {
    id: "tech-terminal",
    name: "Terminal",
    category: "Technology",
    description: "Monospace details with a bright accent and GitHub-first socials.",
    tags: ["mono", "developer"],
    look: { palette: "slate", type: "modern", theme: { size: 12 } },
    build: () =>
      stack(
        [
          field("fullName", { text: t({ size: 16, weight: 600 }) }),
          field("title", { text: t({ font: "ibm-plex-mono", size: 11.5, color: "$accent" }), prefix: "// " }),
          contact(["email", "website"], { gap: 1, labels: "none", text: t({ font: "ibm-plex-mono", size: 11.5 }) }),
          socials({ style: "bare", size: 16, gap: 10, color: "$muted" }),
        ],
        { name: "Signature", gap: 4 },
      ),
  },
  {
    id: "tech-product",
    name: "Product",
    category: "Technology",
    description: "Logo tile, name and a demo booking button.",
    tags: ["saas", "booking"],
    look: { palette: "ocean", type: "modern" },
    build: () =>
      stack(
        [
          row(
            [
              column([image("logo", { width: 48, shape: "rounded", aspect: 1, radius: 10 })], { box: { valign: "top" } }),
              column(
                [
                  field("fullName", { text: t({ size: 15, weight: 600 }) }),
                  field("title", { text: MUTED({ size: 12 }) }),
                  contact(["email", "phone"], { layout: "inline", labels: "none", separator: "dot", text: SMALL() }),
                  button("Book a demo", { field: "booking", radius: 6, color: "$accent", padY: 6, padX: 14, visibility: "full" }),
                ],
                { gap: 4 },
              ),
            ],
            { gap: 14 },
          ),
        ],
        { name: "Signature" },
      ),
  },

  // ── Real estate ──────────────────────────────────────────────────────────
  {
    id: "realestate-listing",
    name: "Listing",
    category: "Real estate",
    description: "Headshot, brokerage logo and a QR code to listings.",
    tags: ["qr", "headshot", "logo"],
    look: { palette: "navy", type: "geometric" },
    build: () =>
      stack(
        [
          row(
            [
              column([image("headshot", { width: 80 })], { box: { valign: "middle" } }),
              column(
                [
                  field("fullName", { text: NAME({ size: 18, weight: 600 }) }),
                  field("title", { text: CAPS({ color: "$accent" }) }),
                  contact(["mobile", "email", "website"], { gap: 1, labels: "short", text: SMALL() }),
                  image("logo", { width: 90 }),
                ],
                { gap: 3, box: { valign: "middle" } },
              ),
              column([qr({ size: 70 })], { visibility: "full", box: { valign: "middle" } }),
            ],
            { gap: 16 },
          ),
        ],
        { name: "Signature" },
      ),
  },
  {
    id: "realestate-estate",
    name: "Estate Agent",
    category: "Real estate",
    description: "Property banner beneath a classic two-column block.",
    tags: ["banner", "two-column"],
    look: { palette: "forest", type: "classic" },
    build: () =>
      stack(
        [
          row(
            [
              column([field("fullName", { text: NAME() }), field("title", { text: MUTED({ italic: true }) })], { gap: 2 }),
              column([contact(["phone", "email", "website"], { gap: 1, labels: "short", text: SMALL() })], {
                box: { padX: 14, borderWidth: 1, borderColor: "$rule", borderSides: "left" },
              }),
            ],
            { gap: 14 },
          ),
          image("banner", { width: 460, aspect: 3.4, visibility: "full" }),
        ],
        { name: "Signature", gap: 10 },
      ),
  },

  // ── Consulting & professional services ───────────────────────────────────
  {
    id: "consult-advisor",
    name: "Advisor",
    category: "Consulting",
    description: "Credentials line, scheduling link, measured tone.",
    tags: ["booking", "credentials"],
    look: { palette: "sage", type: "literary" },
    build: () =>
      stack(
        [
          field("fullName", { text: NAME({ size: 19 }) }),
          field("title", { text: MUTED() }),
          field("company", { text: CAPS({ color: "$accent" }) }),
          contact(["phone", "email"], { layout: "inline", labels: "full", separator: "none", gap: 8, labelColor: "$muted", text: SMALL() }),
          button("Schedule a conversation", { field: "booking", variant: "outline", color: "$ink", radius: 2, visibility: "full" }),
        ],
        { name: "Signature", gap: 5 },
      ),
  },
  {
    id: "services-counsel",
    name: "Counsel",
    category: "Consulting",
    description: "Law-firm formality: firm name, practice, full disclaimer.",
    tags: ["legal", "disclaimer"],
    look: { palette: "navy", type: "safe-serif" },
    build: () =>
      stack(
        [
          field("fullName", { text: t({ font: "$display", size: 16, weight: 700 }) }),
          field("title", { text: SMALL({ italic: true }) }),
          field("company", { text: CAPS({ color: "$ink", tracking: 0.12 }) }),
          field("address", { text: SMALL({ color: "$muted" }) }),
          contact(["phone", "email", "website"], { layout: "inline", labels: "short", separator: "bar", text: SMALL() }),
          disclaimer(),
        ],
        { name: "Signature", gap: 4 },
      ),
  },

  // ── Personal brand ───────────────────────────────────────────────────────
  {
    id: "personal-founder",
    name: "Founder",
    category: "Personal brand",
    description: "Portrait-led with tagline and the full social set.",
    tags: ["headshot", "tagline", "social"],
    look: { palette: "atelier", type: "humanist" },
    build: () =>
      stack(
        [
          row(
            [
              column([image("headshot", { width: 92 })], { box: { valign: "middle" } }),
              column(
                [
                  field("fullName", { text: NAME({ size: 22 }) }),
                  field("title", { text: MUTED() }),
                  field("tagline", { text: t({ italic: true, color: "$accent" }), visibility: "full" }),
                  socials({ style: "circle", size: 22, background: "$ink" }),
                ],
                { gap: 4, box: { valign: "middle" } },
              ),
            ],
            { gap: 18 },
          ),
          contact(["email", "website"], { layout: "inline", labels: "none", separator: "dot", text: SMALL() }),
        ],
        { name: "Signature", gap: 10 },
      ),
  },
  {
    id: "personal-creator",
    name: "Creator",
    category: "Personal brand",
    description: "Pronouns, handle-style socials and a newsletter button.",
    tags: ["pronouns", "creator"],
    look: { palette: "rose", type: "modern" },
    build: () =>
      stack(
        [
          row(
            [
              column([field("fullName", { text: NAME({ size: 19, weight: 600 }) })]),
              column([field("pronouns", { text: MUTED({ size: 11 }), prefix: "(", suffix: ")" })], { box: { valign: "bottom" } }),
            ],
            { gap: 6 },
          ),
          field("title", { text: MUTED() }),
          socials({ style: "tile", size: 22, background: "$accent", gap: 5 }),
          button("Join the newsletter", { field: "website", variant: "link", color: "$accent", visibility: "full" }),
        ],
        { name: "Signature", gap: 5 },
      ),
  },

  // ── Compact & reply ──────────────────────────────────────────────────────
  {
    id: "compact-reply",
    name: "Quick Reply",
    category: "Compact",
    description: "Name and direct line only. Designed as a Reply signature.",
    tags: ["reply", "short"],
    look: { palette: "noir", type: "safe-sans", theme: { size: 12 } },
    build: () =>
      stack(
        [
          row(
            [
              column([field("fullName", { text: t({ weight: 700 }) })]),
              column([field("title", { text: MUTED() })]),
              column([field("company", { text: MUTED() })]),
            ],
            { gap: 8 },
          ),
          contact(["mobile", "email"], { layout: "inline", labels: "short", separator: "none", gap: 8, text: SMALL() }),
        ],
        { name: "Signature", gap: 2 },
      ),
  },
  {
    id: "compact-card",
    name: "Pocket Card",
    category: "Compact",
    description: "A neat small logo with three lines of text.",
    tags: ["logo", "small"],
    look: { palette: "atelier", type: "classic", theme: { size: 12 } },
    build: () =>
      stack(
        [
          row(
            [
              column([image("logo", { width: 44 })], { box: { valign: "middle" } }),
              column(
                [
                  field("fullName", { text: NAME({ size: 16 }) }),
                  field("title", { text: SMALL({ color: "$muted" }) }),
                  contact(["phone", "email"], { layout: "inline", labels: "none", separator: "dot", text: SMALL() }),
                ],
                { gap: 1, box: { valign: "middle" } },
              ),
            ],
            { gap: 12, divider: { width: 1, color: "$accent" } },
          ),
        ],
        { name: "Signature" },
      ),
  },

  // ── Typographic ──────────────────────────────────────────────────────────
  {
    id: "type-display",
    name: "Display",
    category: "Typographic",
    description: "A dramatic display-weight name carries the whole design.",
    tags: ["large-type", "no-images"],
    look: { palette: "plum", type: "avant" },
    build: () =>
      stack(
        [
          field("fullName", { text: NAME({ size: 34, weight: 700, lineHeight: 1, tracking: -0.01 }) }),
          field("title", { text: t({ size: 13, color: "$accent", weight: 600 }) }),
          contact(["email", "phone", "website"], { layout: "inline", labels: "none", separator: "none", gap: 10, text: SMALL() }),
        ],
        { name: "Signature", gap: 6 },
      ),
  },
  {
    id: "type-stacked-caps",
    name: "Capitals",
    category: "Typographic",
    description: "All-caps, tracked, aligned to a strict baseline.",
    tags: ["caps", "tracked"],
    look: { palette: "forest", type: "geometric" },
    build: () =>
      stack(
        [
          field("fullName", { text: CAPS({ color: "$ink", size: 13, weight: 700, tracking: 0.2 }) }),
          field("title", { text: CAPS({ size: 10, tracking: 0.2 }) }),
          field("company", { text: CAPS({ size: 10, tracking: 0.2, color: "$accent" }) }),
          spacer(4),
          contact(["phone", "email", "website"], { gap: 2, labels: "short", text: CAPS({ size: 10, color: "$ink", tracking: 0.12 }) }),
        ],
        { name: "Signature", gap: 2 },
      ),
  },

  // ── Architectural ────────────────────────────────────────────────────────
  {
    id: "arch-grid",
    name: "Blueprint",
    category: "Architectural",
    description: "Framed grid with ruled cells, like a drawing title block.",
    tags: ["frame", "grid"],
    look: { palette: "noir", type: "studio", theme: { size: 12 } },
    build: () =>
      stack(
        [
          row(
            [
              column([field("fullName", { text: t({ font: "$display", size: 16, weight: 600 }) }), field("title", { text: SMALL({ color: "$muted" }) })], {
                gap: 2,
                box: { padX: 12, padY: 10 },
              }),
              column([contact(["phone", "email", "website"], { gap: 1, labels: "short", text: SMALL() })], {
                box: { padX: 12, padY: 10, borderWidth: 1, borderColor: "$ink", borderSides: "left" },
              }),
            ],
            { gap: 0, box: { borderWidth: 1, borderColor: "$ink" } },
          ),
        ],
        { name: "Signature" },
      ),
  },
  {
    id: "arch-plinth",
    name: "Plinth",
    category: "Architectural",
    description: "Name sits on a heavy base rule; logo set to the right.",
    tags: ["rule", "logo-right"],
    look: { palette: "slate", type: "studio" },
    build: () =>
      stack(
        [
          row(
            [
              column([field("fullName", { text: NAME({ size: 20, weight: 600 }) }), field("title", { text: MUTED() })], { gap: 2, box: { valign: "bottom" } }),
              column([image("logo", { width: 64 })], { box: { valign: "bottom", align: "right" } }),
            ],
            { gap: 40 },
          ),
          divider({ thickness: 4, color: "$ink", length: 360 }),
          contact(["phone", "email", "website"], { layout: "inline", labels: "short", separator: "none", gap: 10, text: SMALL() }),
        ],
        { name: "Signature", gap: 6 },
      ),
  },

  // ── Monogram ─────────────────────────────────────────────────────────────
  {
    id: "monogram-circle",
    name: "Initial Circle",
    category: "Monogram",
    description: "Live initials in a filled circle; no image hosting needed.",
    tags: ["initials", "no-images"],
    look: { palette: "navy", type: "classic" },
    build: () =>
      stack(
        [
          row(
            [
              column(
                [
                  field("fullName", {
                    format: "initials",
                    text: t({ font: "$display", size: 20, color: "#ffffff", align: "center", lineHeight: 1 }),
                    box: { background: "$ink", width: 52, padY: 16, radius: 26, align: "center" },
                  }),
                ],
                { box: { valign: "middle" } },
              ),
              column(
                [
                  field("fullName", { text: NAME({ size: 18 }) }),
                  field("title", { text: CAPS({ color: "$accent" }) }),
                  contact(["phone", "email"], { layout: "inline", labels: "none", separator: "dot", text: SMALL() }),
                ],
                { gap: 2, box: { valign: "middle" } },
              ),
            ],
            { gap: 14 },
          ),
        ],
        { name: "Signature" },
      ),
  },

  // ── Partnership ──────────────────────────────────────────────────────────
  {
    id: "partner-dual",
    name: "Dual Brand",
    category: "Partnership",
    description: "Primary and partner logos side by side, separated by a rule.",
    tags: ["partner", "two-logos"],
    look: { palette: "atelier", type: "modern" },
    build: () =>
      stack(
        [
          field("fullName", { text: NAME({ size: 18, weight: 600 }) }),
          field("title", { text: MUTED() }),
          contact(["phone", "email", "website"], { layout: "inline", labels: "none", separator: "dot", text: SMALL() }),
          row(
            [column([image("logo", { width: 96 })], { box: { valign: "middle" } }), column([image("partner", { width: 96 })], { box: { valign: "middle" } })],
            { gap: 18, divider: { width: 1, color: "$rule" }, visibility: "full" },
          ),
        ],
        { name: "Signature", gap: 6 },
      ),
  },
  {
    id: "partner-collab",
    name: "In Partnership",
    category: "Partnership",
    description: "“In partnership with” line and partner mark beneath your details.",
    tags: ["partner", "collaboration"],
    look: { palette: "ocean", type: "humanist" },
    build: () =>
      stack(
        [
          row(
            [
              column([image("logo", { width: 70 })], { box: { valign: "middle" } }),
              column(
                [
                  field("fullName", { text: NAME({ size: 18 }) }),
                  field("title", { text: MUTED() }),
                  contact(["email", "website"], { gap: 1, labels: "none", text: SMALL() }),
                ],
                { gap: 2 },
              ),
            ],
            { gap: 16 },
          ),
          stack([text("In partnership with", { text: CAPS({ size: 9 }) }), image("partner", { width: 84 })], { name: "Partner", gap: 4, visibility: "full" }),
        ],
        { name: "Signature", gap: 12 },
      ),
  },
];

export const TEMPLATE_MAP: Record<string, Template> = Object.fromEntries(TEMPLATES.map((tpl) => [tpl.id, tpl]));

export const CATEGORIES: TemplateCategory[] = [...new Set(TEMPLATES.map((tpl) => tpl.category))];

/** Profession keywords → suggested template ids. */
export const PROFESSION_SUGGESTIONS: { label: string; templates: string[] }[] = [
  { label: "Executive / founder", templates: ["exec-boardroom", "personal-founder", "exec-chair"] },
  { label: "Designer / creative", templates: ["creative-studio", "creative-split", "creative-gallery"] },
  { label: "Hospitality", templates: ["hosp-concierge", "hosp-terrace", "luxury-maison"] },
  { label: "Consultant / advisor", templates: ["consult-advisor", "services-counsel", "minimal-ledger"] },
  { label: "Real estate", templates: ["realestate-listing", "realestate-estate", "arch-plinth"] },
  { label: "Media / press", templates: ["media-broadcast", "media-press", "editorial-masthead"] },
  { label: "Technology", templates: ["tech-product", "tech-terminal", "minimal-line"] },
  { label: "Fashion / lifestyle", templates: ["fashion-lookbook", "fashion-atelier", "luxury-noir-card"] },
];

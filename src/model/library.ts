import { badge, button, column, contact, divider, field, image, qr, row, social, spacer, stack, text } from "./factory";
import type { SigNode } from "./types";

export type LibraryGroup = "Identity" | "Contact" | "Images" | "Actions" | "Content" | "Layout";

export interface LibraryItem {
  id: string;
  label: string;
  group: LibraryGroup;
  description: string;
  keywords: string;
  create: () => SigNode;
}

export const LIBRARY: LibraryItem[] = [
  // Identity
  {
    id: "name",
    label: "Name",
    group: "Identity",
    description: "Your name, connected to the profile",
    keywords: "full name display",
    create: () => field("fullName", { text: { font: "$display", size: 20, weight: 500 } }),
  },
  {
    id: "title",
    label: "Job title",
    group: "Identity",
    description: "Role or position",
    keywords: "position role",
    create: () => field("title", { text: { color: "$muted" } }),
  },
  {
    id: "company",
    label: "Company",
    group: "Identity",
    description: "Organisation name",
    keywords: "organisation business",
    create: () => field("company", { text: { weight: 600 } }),
  },
  {
    id: "department",
    label: "Department",
    group: "Identity",
    description: "Team or department",
    keywords: "team division",
    create: () => field("department", { text: { color: "$muted" } }),
  },
  {
    id: "pronouns",
    label: "Pronouns",
    group: "Identity",
    description: "e.g. she/her",
    keywords: "gender",
    create: () => field("pronouns", { text: { color: "$muted", size: 11 }, prefix: "(", suffix: ")" }),
  },
  {
    id: "tagline",
    label: "Tagline",
    group: "Identity",
    description: "A short line about you or your brand",
    keywords: "slogan motto quote",
    create: () => field("tagline", { text: { italic: true, color: "$muted" } }),
  },
  {
    id: "intro",
    label: "Sign-off",
    group: "Identity",
    description: "e.g. “Warm regards,”",
    keywords: "greeting closing regards",
    create: () => field("intro", { text: { italic: true } }),
  },
  {
    id: "monogram",
    label: "Monogram",
    group: "Identity",
    description: "Your initials in a tile",
    keywords: "initials letter mark",
    create: () =>
      field("fullName", {
        format: "initials",
        text: { font: "$display", size: 20, color: "#ffffff", align: "center" },
        box: { background: "$ink", width: 48, padY: 12, radius: 4, align: "center" },
      }),
  },

  // Contact
  {
    id: "contact-stacked",
    label: "Contact details",
    group: "Contact",
    description: "Phone, email, website in rows",
    keywords: "phone email website stacked",
    create: () => contact(["phone", "email", "website"]),
  },
  {
    id: "contact-inline",
    label: "Contact line",
    group: "Contact",
    description: "All details on one line",
    keywords: "inline separator",
    create: () => contact(["phone", "email", "website"], { layout: "inline", labels: "none" }),
  },
  {
    id: "contact-grid",
    label: "Contact grid",
    group: "Contact",
    description: "Two-column contact layout",
    keywords: "grid columns",
    create: () => contact(["phone", "mobile", "email", "website"], { layout: "grid" }),
  },
  { id: "email", label: "Email", group: "Contact", description: "Clickable email address", keywords: "mail", create: () => field("email") },
  { id: "phone", label: "Phone", group: "Contact", description: "Clickable phone number", keywords: "telephone call", create: () => field("phone") },
  { id: "mobile", label: "Mobile", group: "Contact", description: "Clickable mobile number", keywords: "cell", create: () => field("mobile") },
  { id: "website", label: "Website", group: "Contact", description: "Your website link", keywords: "url web link", create: () => field("website") },
  {
    id: "address",
    label: "Address",
    group: "Contact",
    description: "Office or studio address",
    keywords: "location office",
    create: () => field("address", { text: { color: "$muted" } }),
  },

  // Images
  { id: "logo", label: "Logo", group: "Images", description: "Company logo", keywords: "brand mark", create: () => image("logo") },
  { id: "headshot", label: "Headshot", group: "Images", description: "Portrait photo", keywords: "photo portrait avatar", create: () => image("headshot") },
  {
    id: "partner",
    label: "Partner logo",
    group: "Images",
    description: "Secondary or partner mark",
    keywords: "secondary partner",
    create: () => image("partner"),
  },
  {
    id: "banner",
    label: "Banner",
    group: "Images",
    description: "Promotional banner image",
    keywords: "promo promotion campaign",
    create: () => image("banner", { visibility: "full" }),
  },
  { id: "image", label: "Image", group: "Images", description: "Any artwork", keywords: "picture artwork", create: () => image("artwork") },
  {
    id: "social",
    label: "Social icons",
    group: "Images",
    description: "Links to your social profiles",
    keywords: "instagram linkedin x facebook",
    create: () => social(),
  },
  { id: "qr", label: "QR code", group: "Images", description: "Scannable link", keywords: "scan code", create: () => qr() },

  // Actions
  {
    id: "button",
    label: "Button",
    group: "Actions",
    description: "Call-to-action button",
    keywords: "cta link",
    create: () => button("Learn more", { field: "website" }),
  },
  {
    id: "booking",
    label: "Booking link",
    group: "Actions",
    description: "Schedule a meeting",
    keywords: "calendar appointment meeting",
    create: () => button("Book a meeting", { field: "booking", visibility: "full" }),
  },
  {
    id: "link",
    label: "Text link",
    group: "Actions",
    description: "Understated link with arrow",
    keywords: "cta",
    create: () => button("Visit our site", { field: "website", variant: "link", color: "$accent" }),
  },

  // Content
  { id: "text", label: "Text", group: "Content", description: "Free text", keywords: "paragraph copy", create: () => text("Your text here") },
  {
    id: "heading",
    label: "Heading",
    group: "Content",
    description: "Large display text",
    keywords: "title headline",
    create: () => text("Heading", { text: { font: "$display", size: 18, weight: 600 } }),
  },
  {
    id: "label",
    label: "Brand label",
    group: "Content",
    description: "Small tag or badge",
    keywords: "badge tag pill",
    create: () =>
      badge("NEW", { text: { size: 9, weight: 700, tracking: 0.16, color: "#ffffff" }, box: { background: "$accent", padX: 6, padY: 2, radius: 2 } }),
  },
  {
    id: "announcement",
    label: "Announcement",
    group: "Content",
    description: "Highlighted news strip",
    keywords: "news promo notice",
    create: () =>
      text("We’ve moved to a new studio — come visit.", {
        visibility: "full",
        text: { size: 12 },
        box: { background: "$surface", padX: 12, padY: 8, radius: 4 },
      }),
  },
  {
    id: "disclaimer",
    label: "Disclaimer",
    group: "Content",
    description: "Legal or confidentiality notice",
    keywords: "legal confidentiality notice",
    create: () =>
      text("This email and any attachments are confidential.", {
        name: "Disclaimer",
        visibility: "full",
        text: { size: 9.5, color: "$muted" },
        box: { width: 460 },
      }),
  },

  // Layout
  { id: "divider", label: "Divider", group: "Layout", description: "Horizontal rule", keywords: "line rule separator", create: () => divider() },
  {
    id: "vdivider",
    label: "Vertical rule",
    group: "Layout",
    description: "Vertical line",
    keywords: "line rule",
    create: () => divider({ orientation: "vertical", length: 48 }),
  },
  { id: "spacer", label: "Spacer", group: "Layout", description: "Empty vertical space", keywords: "gap space", create: () => spacer(12) },
  {
    id: "columns",
    label: "Two columns",
    group: "Layout",
    description: "Side-by-side layout",
    keywords: "row columns side",
    create: () => row([column([]), column([])]),
  },
  {
    id: "columns3",
    label: "Three columns",
    group: "Layout",
    description: "Three side-by-side areas",
    keywords: "row columns",
    create: () => row([column([]), column([]), column([])]),
  },
  {
    id: "group",
    label: "Group",
    group: "Layout",
    description: "Stack components together",
    keywords: "stack container section",
    create: () => stack([], { name: "Group", gap: 4 }),
  },
];

export const LIBRARY_GROUPS: LibraryGroup[] = ["Identity", "Contact", "Images", "Actions", "Content", "Layout"];

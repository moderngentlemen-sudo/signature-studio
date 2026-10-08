import { uid } from "../lib/id";
import { emptyFields } from "./profile";
import type {
  BadgeNode,
  BoxStyle,
  ButtonNode,
  ColumnNode,
  ContactItemKind,
  ContactNode,
  DividerNode,
  FieldNode,
  ImageNode,
  ImageRole,
  Project,
  ProfileKey,
  QrNode,
  RowNode,
  SigNode,
  SocialNode,
  SpacerNode,
  StackNode,
  TextNode,
  TextStyle,
  Theme,
  Visibility,
} from "./types";
import { PROJECT_SCHEMA, PROJECT_VERSION } from "./types";

export const DEFAULT_THEME: Theme = {
  colors: {
    ink: "#16150f",
    muted: "#6b675d",
    accent: "#a8834a",
    link: "#16150f",
    surface: "#f4efe6",
    rule: "#d8d0c2",
  },
  fonts: { display: "cormorant", body: "helvetica" },
  size: 13,
  lineHeight: 1.45,
  width: 560,
  scale: 1,
  align: "left",
  background: "transparent",
  gap: 6,
};

interface Common {
  name?: string;
  visibility?: Visibility;
  box?: BoxStyle;
  text?: TextStyle;
}

const base = (c: Common = {}) => ({
  id: uid("n"),
  visibility: c.visibility ?? ("both" as Visibility),
  ...(c.name ? { name: c.name } : {}),
  ...(c.box ? { box: c.box } : {}),
  ...(c.text ? { text: c.text } : {}),
});

export function stack(children: SigNode[], opts: Common & { gap?: number } = {}): StackNode {
  return { ...base(opts), type: "stack", props: { gap: opts.gap }, children };
}

export function column(children: SigNode[], opts: Common & { weight?: number; gap?: number } = {}): ColumnNode {
  return { ...base(opts), type: "column", props: { weight: opts.weight ?? 1, gap: opts.gap }, children };
}

export function row(columns: ColumnNode[], opts: Common & { gap?: number; divider?: { width: number; color: string } } = {}): RowNode {
  return { ...base(opts), type: "row", props: { gap: opts.gap ?? 20, divider: opts.divider }, children: columns };
}

export function field(key: ProfileKey, opts: Common & { prefix?: string; suffix?: string; format?: "initials"; link?: "auto" | "none" } = {}): FieldNode {
  return {
    ...base(opts),
    type: "field",
    props: { field: key, prefix: opts.prefix, suffix: opts.suffix, link: opts.link ?? "auto", format: opts.format },
  };
}

export function text(value: string, opts: Common & { href?: string } = {}): TextNode {
  return { ...base(opts), type: "text", props: { text: value, href: opts.href } };
}

export function badge(value: string, opts: Common & { href?: string } = {}): BadgeNode {
  return { ...base(opts), type: "badge", props: { text: value, href: opts.href } };
}

export function contact(kinds: ContactItemKind[] = ["phone", "email", "website"], opts: Common & Partial<ContactNode["props"]> = {}): ContactNode {
  return {
    ...base(opts),
    type: "contact",
    props: {
      items: kinds.map((kind) => ({ id: uid("c"), kind, visible: true })),
      layout: opts.layout ?? "stacked",
      labels: opts.labels ?? "short",
      separator: opts.separator ?? "dot",
      labelColor: opts.labelColor ?? "$accent",
      gap: opts.gap ?? 2,
      nowrap: opts.nowrap ?? true,
    },
  };
}

export function image(role: ImageRole, opts: Common & Partial<ImageNode["props"]> = {}): ImageNode {
  const defaults: Record<ImageRole, { width: number; shape: ImageNode["props"]["shape"]; aspect?: number }> = {
    logo: { width: 120, shape: "rect" },
    headshot: { width: 84, shape: "circle", aspect: 1 },
    partner: { width: 90, shape: "rect" },
    banner: { width: 480, shape: "rounded", aspect: 4 },
    artwork: { width: 160, shape: "rect" },
  };
  const d = defaults[role];
  return {
    ...base(opts),
    type: "image",
    props: {
      role,
      assetId: opts.assetId,
      width: opts.width ?? d.width,
      aspect: opts.aspect ?? d.aspect,
      crop: opts.crop ?? { x: 0, y: 0, zoom: 1 },
      shape: opts.shape ?? d.shape,
      radius: opts.radius ?? 8,
      alt: opts.alt ?? "",
      href: opts.href,
      tint: opts.tint,
    },
  };
}

export function social(opts: Common & Partial<SocialNode["props"]> = {}): SocialNode {
  return {
    ...base(opts),
    type: "social",
    props: {
      style: opts.style ?? "circle",
      size: opts.size ?? 22,
      gap: opts.gap ?? 6,
      color: opts.color ?? "#ffffff",
      background: opts.background ?? "$ink",
      hidden: opts.hidden ?? [],
    },
  };
}

export function button(label: string, opts: Common & Partial<ButtonNode["props"]> = {}): ButtonNode {
  return {
    ...base(opts),
    type: "button",
    props: {
      label,
      href: opts.href ?? "",
      field: opts.field,
      variant: opts.variant ?? "solid",
      color: opts.color ?? "$ink",
      textColor: opts.textColor ?? "#ffffff",
      radius: opts.radius ?? 4,
      padX: opts.padX ?? 16,
      padY: opts.padY ?? 8,
    },
  };
}

export function divider(opts: Common & Partial<DividerNode["props"]> = {}): DividerNode {
  return {
    ...base(opts),
    type: "divider",
    props: {
      orientation: opts.orientation ?? "horizontal",
      thickness: opts.thickness ?? 1,
      color: opts.color ?? "$rule",
      length: opts.length,
      style: opts.style ?? "solid",
    },
  };
}

export function spacer(size = 12, opts: Common = {}): SpacerNode {
  return { ...base(opts), type: "spacer", props: { size } };
}

export function qr(opts: Common & Partial<QrNode["props"]> = {}): QrNode {
  return {
    ...base(opts),
    type: "qr",
    props: {
      value: opts.value ?? "",
      field: opts.field ?? "website",
      size: opts.size ?? 72,
      color: opts.color ?? "$ink",
      background: opts.background ?? "#ffffff",
      alt: opts.alt ?? "QR code",
    },
  };
}

export function newProject(name = "Untitled signature"): Project {
  const now = Date.now();
  return {
    schema: PROJECT_SCHEMA,
    version: PROJECT_VERSION,
    id: uid("p"),
    name,
    createdAt: now,
    updatedAt: now,
    profile: { fields: emptyFields(), custom: [], socials: [] },
    theme: structuredClone(DEFAULT_THEME),
    root: stack([], { name: "Signature" }),
    assets: {},
    published: {},
  };
}

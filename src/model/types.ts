/**
 * Signature Studio project document (schema v1).
 *
 * One project is the single source of truth for both the Full and Reply
 * signatures. Every rendered output — the editor canvas, copied HTML,
 * exported files — is derived from this structure by `renderEmail`.
 */

export const PROJECT_SCHEMA = "signature-studio.project" as const;
export const PROJECT_VERSION = 1 as const;

export type Variant = "full" | "reply";
export type Visibility = "both" | "full" | "reply" | "hidden";

export type ProfileKey =
  | "fullName"
  | "displayName"
  | "title"
  | "company"
  | "department"
  | "pronouns"
  | "phone"
  | "mobile"
  | "email"
  | "website"
  | "address"
  | "tagline"
  | "intro"
  | "booking";

export type ProfileFields = Record<ProfileKey, string>;

export interface CustomField {
  id: string;
  label: string;
  value: string;
  /** Optional link target (tel:, mailto:, https:) */
  href?: string;
}

export type SocialPlatform =
  | "instagram"
  | "facebook"
  | "tiktok"
  | "linkedin"
  | "x"
  | "youtube"
  | "pinterest"
  | "threads"
  | "behance"
  | "dribbble"
  | "vimeo"
  | "github"
  | "custom";

export interface SocialLink {
  id: string;
  platform: SocialPlatform;
  url: string;
  /** Accessible name and fallback text. Defaults to the platform name. */
  label?: string;
  visible: boolean;
  /** Asset id of a custom uploaded icon (used for "custom" or overrides). */
  iconAssetId?: string;
}

export interface Profile {
  fields: ProfileFields;
  custom: CustomField[];
  socials: SocialLink[];
}

/** Colour value: a hex string or a theme token such as "$accent". */
export type ColorValue = string;
/** Font value: a font id from the library or a theme token ("$display" | "$body"). */
export type FontValue = string;

export interface ThemeColors {
  ink: string;
  muted: string;
  accent: string;
  link: string;
  surface: string;
  rule: string;
}

export interface Theme {
  colors: ThemeColors;
  fonts: { display: string; body: string };
  /** Base body font size in px (before scale). */
  size: number;
  lineHeight: number;
  /** Target width in px for the signature. */
  width: number;
  /** Global scale multiplier applied to every px value at render time. */
  scale: number;
  align: "left" | "center";
  /** Signature background; "transparent" leaves the email background. */
  background: string;
  /** Default vertical gap between stacked components (px). */
  gap: number;
}

export interface TextStyle {
  font?: FontValue;
  size?: number;
  weight?: number;
  italic?: boolean;
  /** Letter spacing in em. */
  tracking?: number;
  lineHeight?: number;
  transform?: "none" | "uppercase" | "lowercase" | "capitalize";
  color?: ColorValue;
  align?: "left" | "center" | "right";
  underline?: boolean;
}

export interface BoxStyle {
  padX?: number;
  padY?: number;
  background?: ColorValue;
  borderWidth?: number;
  borderColor?: ColorValue;
  /** Which sides the border is drawn on. */
  borderSides?: "all" | "top" | "bottom" | "left" | "right" | "y" | "x";
  radius?: number;
  /** Fixed width in px. Undefined = natural width. */
  width?: number;
  align?: "left" | "center" | "right";
  valign?: "top" | "middle" | "bottom";
}

interface NodeBase {
  id: string;
  /** User-facing layer name. Falls back to a generated label. */
  name?: string;
  visibility: Visibility;
  locked?: boolean;
  box?: BoxStyle;
  text?: TextStyle;
}

export interface StackNode extends NodeBase {
  type: "stack";
  props: { gap?: number };
  children: SigNode[];
}

export interface RowNode extends NodeBase {
  type: "row";
  props: { gap?: number; divider?: { width: number; color: ColorValue } };
  children: ColumnNode[];
}

export interface ColumnNode extends NodeBase {
  type: "column";
  /** Relative width weight; normalised across siblings. */
  props: { weight: number; gap?: number };
  children: SigNode[];
}

export interface FieldNode extends NodeBase {
  type: "field";
  props: {
    field: ProfileKey;
    /** Own text when detached from the profile. */
    text?: string;
    detached?: boolean;
    prefix?: string;
    suffix?: string;
    /** Link behaviour: automatic based on field type, or none. */
    link?: "auto" | "none";
    /** Presentation transform of the value (e.g. initials for monograms). */
    format?: "initials";
  };
}

export interface TextNode extends NodeBase {
  type: "text";
  props: { text: string; href?: string };
}

export type ContactItemKind = "phone" | "mobile" | "email" | "website" | "address" | "custom";

export interface ContactItem {
  id: string;
  kind: ContactItemKind;
  /** For kind === "custom": id of the profile custom field. */
  customId?: string;
  visible: boolean;
}

export type Separator = "dot" | "bar" | "slash" | "dash" | "bullet" | "diamond" | "none";

export interface ContactNode extends NodeBase {
  type: "contact";
  props: {
    items: ContactItem[];
    layout: "stacked" | "inline" | "grid";
    labels: "none" | "short" | "full";
    separator: Separator;
    labelColor?: ColorValue;
    /** Gap between rows (stacked/grid) or items (inline), px. */
    gap: number;
    nowrap?: boolean;
  };
}

export type ImageRole = "logo" | "headshot" | "partner" | "banner" | "artwork";
export type ImageShape = "rect" | "rounded" | "circle";

export interface ImageCrop {
  /** Pan offset of the image centre within the frame, -1..1. */
  x: number;
  y: number;
  /** Zoom ≥ 1 (1 = cover). */
  zoom: number;
}

export interface ImageNode extends NodeBase {
  type: "image";
  props: {
    role: ImageRole;
    /** Asset id; may reference a built-in asset ("builtin:…"). */
    assetId?: string;
    width: number;
    /** Frame aspect ratio (w/h). Undefined = natural image ratio. */
    aspect?: number;
    crop: ImageCrop;
    shape: ImageShape;
    radius: number;
    alt: string;
    href?: string;
    /** Optional tint for single-colour built-in artwork. */
    tint?: ColorValue;
  };
}

export type SocialIconStyle = "bare" | "circle" | "outline" | "tile" | "text" | "letter";

export interface SocialNode extends NodeBase {
  type: "social";
  props: {
    style: SocialIconStyle;
    size: number;
    gap: number;
    /** Glyph colour. */
    color: ColorValue;
    /** Shape background (circle/tile) or outline colour. */
    background: ColorValue;
    /** Social link ids hidden in this block only. */
    hidden: string[];
  };
}

export interface ButtonNode extends NodeBase {
  type: "button";
  props: {
    label: string;
    /** Link target. If empty and `field` is set, the profile value is used. */
    href: string;
    field?: ProfileKey;
    variant: "solid" | "outline" | "link";
    color: ColorValue;
    textColor: ColorValue;
    radius: number;
    padX: number;
    padY: number;
  };
}

export interface DividerNode extends NodeBase {
  type: "divider";
  props: {
    orientation: "horizontal" | "vertical";
    thickness: number;
    color: ColorValue;
    /** Length in px. Undefined = full available length. */
    length?: number;
    style: "solid" | "dotted" | "dashed";
  };
}

export interface SpacerNode extends NodeBase {
  type: "spacer";
  props: { size: number };
}

export interface QrNode extends NodeBase {
  type: "qr";
  props: {
    /** Encoded value. If empty, `field` value is used. */
    value: string;
    field?: ProfileKey;
    size: number;
    color: ColorValue;
    background: ColorValue;
    alt: string;
  };
}

export interface BadgeNode extends NodeBase {
  type: "badge";
  props: { text: string; href?: string };
}

export type SigNode =
  | StackNode
  | RowNode
  | ColumnNode
  | FieldNode
  | TextNode
  | ContactNode
  | ImageNode
  | SocialNode
  | ButtonNode
  | DividerNode
  | SpacerNode
  | QrNode
  | BadgeNode;

export type NodeType = SigNode["type"];
export type ContainerNode = StackNode | RowNode | ColumnNode;

export interface AssetMeta {
  id: string;
  name: string;
  mime: string;
  width: number;
  height: number;
  bytes: number;
  /** SHA-256 of the source bytes, for duplicate detection. */
  hash: string;
  createdAt: number;
}

export interface PublishedAsset {
  url: string;
  /** SHA-256 of the published derivative bytes. */
  hash: string;
  verifiedAt: number;
  bytes: number;
  width: number;
  height: number;
  mime: string;
}

export interface Project {
  schema: typeof PROJECT_SCHEMA;
  version: typeof PROJECT_VERSION;
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  templateId?: string;
  profile: Profile;
  theme: Theme;
  root: StackNode;
  assets: Record<string, AssetMeta>;
  /** Verified public derivatives, keyed by image request key. */
  published: Record<string, PublishedAsset>;
}

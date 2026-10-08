/**
 * The one renderer.
 *
 * `renderSignature` turns a Project into table-based, inline-styled email
 * HTML. In "edit" mode the same markup is annotated with data-ss-* hooks the
 * editor overlay uses for selection and inline editing; in "email" mode the
 * output is clean and must resolve every image to a verified public URL.
 */
import { esc, escText } from "../lib/escape";
import { safeHref } from "../lib/url";
import { assetMeta, BUILTINS } from "../model/builtins";
import { cropRect, frameSize } from "../model/crop";
import { fontStack } from "../model/fonts";
import { CONTACT_LABELS, fieldDisplay, fieldHref, fieldValue } from "../model/profile";
import { PLATFORM_MAP } from "../model/social";
import { visibleIn } from "../model/tree";
import type {
  BoxStyle,
  ButtonNode,
  ColumnNode,
  ContactNode,
  DividerNode,
  FieldNode,
  ImageNode,
  Project,
  QrNode,
  RowNode,
  Separator,
  SigNode,
  SocialLink,
  SocialNode,
  StackNode,
  TextStyle,
  Theme,
  Variant,
} from "../model/types";
import { qrSvg, socialIconSvg, svgDataUrl } from "./icons";

// ---------------------------------------------------------------------------
// Image requests: every image the output needs, described precisely enough
// for the publish pipeline to produce the exact derivative.
// ---------------------------------------------------------------------------

export type ImageRequest =
  | {
      kind: "asset";
      key: string;
      nodeId: string;
      label: string;
      assetId: string;
      /** Display size in CSS px (derivative is produced at 2×). */
      width: number;
      height: number;
      crop: { sx: number; sy: number; sw: number; sh: number };
      shape: ImageNode["props"]["shape"];
      radius: number;
      tint?: string;
    }
  | {
      kind: "icon";
      key: string;
      nodeId: string;
      label: string;
      platform: SocialLink["platform"];
      style: Exclude<SocialNode["props"]["style"], "text">;
      size: number;
      color: string;
      background: string;
      /** Custom uploaded icon (rendered as a circle-cropped asset). */
      assetId?: string;
    }
  | {
      kind: "qr";
      key: string;
      nodeId: string;
      label: string;
      value: string;
      size: number;
      color: string;
      background: string;
    };

export interface ResolvedImage {
  src: string;
}

export interface RenderOptions {
  variant: Variant;
  /**
   * edit: annotated, with placeholders and ghosts.
   * preview: what recipients see, using local image sources.
   * email: clean output with verified public image URLs only.
   */
  mode: "edit" | "preview" | "email";
  /** Email mode: returns the verified public URL, or null if not ready. */
  resolveImage?: (req: ImageRequest) => ResolvedImage | null;
  /** Edit mode: object URL for an uploaded asset's source. */
  sourceUrl?: (assetId: string) => string | null;
  /** Render with email fallback fonts only ("as recipients see it"). */
  fallbackFonts?: boolean;
  /** Edit mode: render components hidden in this variant as faded ghosts. */
  ghosts?: boolean;
}

export interface RenderIssue {
  level: "error" | "warning";
  nodeId?: string;
  message: string;
}

export interface RenderResult {
  html: string;
  images: ImageRequest[];
  issues: RenderIssue[];
}

interface Ctx {
  project: Project;
  theme: Theme;
  opts: RenderOptions;
  images: ImageRequest[];
  issues: RenderIssue[];
  edit: boolean;
  /** Use local sources for images (edit + preview). */
  local: boolean;
}

interface Inherited {
  text: Required<Omit<TextStyle, "underline">> & { underline: boolean };
  align: "left" | "center" | "right";
  /** Upper bound on available width in px (already scaled). */
  avail: number;
  ghost: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function resolveColor(theme: Theme, value: string | undefined, fallback = "#000000"): string {
  if (!value) return fallback;
  if (value.startsWith("$")) {
    const token = value.slice(1) as keyof Theme["colors"];
    return theme.colors[token] ?? fallback;
  }
  return value;
}

export function resolveFont(theme: Theme, value: string | undefined): string {
  if (!value) return theme.fonts.body;
  if (value === "$display") return theme.fonts.display;
  if (value === "$body") return theme.fonts.body;
  return value;
}

function css(decls: Record<string, string | number | undefined | null | false>): string {
  let out = "";
  for (const [k, v] of Object.entries(decls)) {
    if (v === undefined || v === null || v === false || v === "") continue;
    out += `${k}:${v};`;
  }
  return out;
}

const TABLE = 'cellpadding="0" cellspacing="0" border="0" role="presentation"';

function px(ctx: Ctx, value: number): number {
  return Math.round(value * ctx.theme.scale);
}

function textCss(ctx: Ctx, t: Inherited["text"], extra: Record<string, string | number | undefined> = {}) {
  const size = Math.max(1, Math.round(t.size * ctx.theme.scale * 10) / 10);
  return css({
    margin: 0,
    "font-family": fontStack(resolveFont(ctx.theme, t.font), ctx.opts.fallbackFonts),
    "font-size": `${size}px`,
    "line-height": `${Math.round(size * t.lineHeight)}px`,
    "font-weight": t.weight !== 400 ? t.weight : undefined,
    "font-style": t.italic ? "italic" : undefined,
    "letter-spacing": t.tracking ? `${Math.round(t.tracking * size * 100) / 100}px` : undefined,
    "text-transform": t.transform !== "none" ? t.transform : undefined,
    color: resolveColor(ctx.theme, t.color),
    "text-align": t.align,
    "mso-line-height-rule": "exactly",
    ...extra,
  });
}

function linkCss(ctx: Ctx, t: Inherited["text"], color?: string) {
  return css({
    color: color ?? resolveColor(ctx.theme, t.color),
    "text-decoration": t.underline ? "underline" : "none",
  });
}

function mergeText(parent: Inherited["text"], own?: TextStyle): Inherited["text"] {
  if (!own) return parent;
  const out = { ...parent };
  for (const [k, v] of Object.entries(own)) if (v !== undefined) (out as Record<string, unknown>)[k] = v;
  return out;
}

/** Add attributes to the first tag of an HTML fragment. */
function annotate(html: string, attrs: string): string {
  if (!attrs) return html;
  return html.replace(/^<([a-z]+)/i, `<$1 ${attrs}`);
}

function nodeAttrs(ctx: Ctx, node: SigNode, ghost: boolean): string {
  if (!ctx.edit) return "";
  return `data-ss-id="${node.id}" data-ss-type="${node.type}"${ghost ? ' data-ss-ghost="1"' : ""}${node.locked ? ' data-ss-locked="1"' : ""}`;
}

function borderCss(ctx: Ctx, box: BoxStyle): Record<string, string | undefined> {
  if (!box.borderWidth) return {};
  const line = `${px(ctx, box.borderWidth)}px solid ${resolveColor(ctx.theme, box.borderColor, "#d8d0c2")}`;
  const sides = box.borderSides ?? "all";
  const map: Record<string, string[]> = {
    all: ["border"],
    top: ["border-top"],
    bottom: ["border-bottom"],
    left: ["border-left"],
    right: ["border-right"],
    y: ["border-top", "border-bottom"],
    x: ["border-left", "border-right"],
  };
  return Object.fromEntries(map[sides].map((p) => [p, line]));
}

function hasBox(box?: BoxStyle): box is BoxStyle {
  return !!box && !!(box.padX || box.padY || box.background || box.borderWidth || box.width);
}

/** Wrap content in a single-cell table carrying padding/background/border/width. */
function boxWrap(ctx: Ctx, inner: string, box: BoxStyle | undefined, align: string): string {
  if (!hasBox(box)) return inner;
  const width = box.width ? px(ctx, box.width) : undefined;
  const bg = box.background ? resolveColor(ctx.theme, box.background) : undefined;
  const td = css({
    padding: box.padX || box.padY ? `${px(ctx, box.padY ?? 0)}px ${px(ctx, box.padX ?? 0)}px` : undefined,
    "background-color": bg,
    "border-radius": box.radius ? `${px(ctx, box.radius)}px` : undefined,
    width: width ? `${width}px` : undefined,
    "vertical-align": box.valign,
    "text-align": box.align ?? align,
    ...borderCss(ctx, box),
  });
  return `<table ${TABLE}${width ? ` width="${width}"` : ""} style="border-collapse:separate;${width ? `width:${width}px;` : ""}"><tr><td${bg ? ` bgcolor="${esc(bg)}"` : ""}${box.align ? ` align="${box.align}"` : ""} style="${td}">${inner}</td></tr></table>`;
}

function innerAvail(ctx: Ctx, avail: number, box?: BoxStyle): number {
  let w = box?.width ? px(ctx, box.width) : avail;
  if (box?.padX) w -= 2 * px(ctx, box.padX);
  if (box?.borderWidth) w -= 2 * px(ctx, box.borderWidth);
  return Math.max(16, Math.min(w, avail));
}

// ---------------------------------------------------------------------------
// Node renderers
// ---------------------------------------------------------------------------

function isShown(ctx: Ctx, node: SigNode): { show: boolean; ghost: boolean } {
  const visible = visibleIn(node.visibility, ctx.opts.variant);
  if (visible) return { show: true, ghost: false };
  if (ctx.edit && ctx.opts.ghosts) return { show: true, ghost: true };
  return { show: false, ghost: false };
}

function renderNode(ctx: Ctx, node: SigNode, inh: Inherited): string {
  const { show, ghost } = isShown(ctx, node);
  if (!show) return "";
  const isGhost = inh.ghost || ghost;
  const text = mergeText(inh.text, node.text);
  const align = node.box?.align ?? (node.text?.align as Inherited["align"]) ?? inh.align;
  const local: Inherited = {
    text: { ...text, align },
    align,
    avail: innerAvail(ctx, inh.avail, node.box),
    ghost: isGhost,
  };
  let body = "";
  try {
    switch (node.type) {
      case "stack":
        body = renderStack(ctx, node, local);
        break;
      case "column":
        body = renderStack(ctx, node, local);
        break;
      case "row":
        body = renderRow(ctx, node, local);
        break;
      case "field":
        body = renderField(ctx, node, local);
        break;
      case "text":
      case "badge":
        body = renderText(ctx, node.id, node.props.text, node.props.href, local);
        break;
      case "contact":
        body = renderContact(ctx, node, local);
        break;
      case "image":
        body = renderImage(ctx, node, local);
        break;
      case "social":
        body = renderSocial(ctx, node, local);
        break;
      case "button":
        body = renderButton(ctx, node, local);
        break;
      case "divider":
        body = renderDivider(ctx, node, local);
        break;
      case "spacer":
        body = `<table ${TABLE} style="border-collapse:collapse;"><tr><td height="${px(ctx, node.props.size)}" style="height:${px(ctx, node.props.size)}px;line-height:${px(ctx, node.props.size)}px;font-size:1px;">&nbsp;</td></tr></table>`;
        break;
      case "qr":
        body = renderQr(ctx, node, local);
        break;
    }
  } catch {
    // A malformed component (e.g. from an imported file) must never break
    // the whole signature.
    ctx.issues.push({ level: "error", nodeId: node.id, message: `A ${node.type} component is damaged and was left out.` });
    body = ctx.edit ? `<div style="padding:6px 8px;border:1px dashed #b4372f;color:#b4372f;font:11px Helvetica,Arial,sans-serif;">Damaged component</div>` : "";
  }
  if (!body) return "";
  let wrapped = boxWrap(ctx, body, node.box, align);
  if (ghost && ctx.edit) wrapped = `<div style="opacity:.28;">${wrapped}</div>`;
  return annotate(wrapped, nodeAttrs(ctx, node, ghost));
}

function renderStack(ctx: Ctx, node: StackNode | ColumnNode, inh: Inherited): string {
  const gap = px(ctx, node.props.gap ?? ctx.theme.gap);
  const rows: string[] = [];
  for (const child of node.children) {
    const html = renderNode(ctx, child, inh);
    if (!html) continue;
    const childAlign = child.box?.align ?? (child.text?.align as string | undefined) ?? inh.align;
    const pad = rows.length ? `padding-top:${gap}px;` : "";
    rows.push(`<tr><td align="${childAlign}" style="${pad}text-align:${childAlign};">${html}</td></tr>`);
  }
  if (!rows.length) {
    if (!ctx.edit) return "";
    return `<table ${TABLE} style="border-collapse:collapse;"><tr><td data-ss-empty="${node.id}" style="padding:10px 14px;border:1px dashed #b9ae98;color:#8a8170;font-family:Helvetica,Arial,sans-serif;font-size:11px;">Empty — drop components here</td></tr></table>`;
  }
  return `<table ${TABLE} style="border-collapse:collapse;">${rows.join("")}</table>`;
}

function renderRow(ctx: Ctx, node: RowNode, inh: Inherited): string {
  const cols = node.children.filter((c) => isShown(ctx, c).show);
  if (!cols.length) return ctx.edit ? renderStack(ctx, { ...node, type: "stack", children: [] } as never, inh) : "";
  const gap = px(ctx, node.props.gap ?? 20);
  const div = node.props.divider && node.props.divider.width > 0 ? node.props.divider : null;
  const fixed = cols.some((c) => c.box?.width);
  const gapsTotal = gap * (cols.length - 1) + (div ? px(ctx, div.width) * (cols.length - 1) : 0);
  // Width distribution: fixed columns keep their px; others share by weight
  // only when at least one column is fixed (otherwise natural widths).
  let widths: (number | undefined)[] = cols.map(() => undefined);
  if (fixed) {
    const fixedTotal = cols.reduce((s, c) => s + (c.box?.width ? px(ctx, c.box.width) : 0), 0);
    const flex = cols.filter((c) => !c.box?.width);
    const weightSum = flex.reduce((s, c) => s + (c.props.weight || 1), 0);
    const rest = Math.max(0, inh.avail - fixedTotal - gapsTotal);
    widths = cols.map((c) => (c.box?.width ? px(ctx, c.box.width) : flex.length ? Math.floor((rest * (c.props.weight || 1)) / weightSum) : undefined));
  }
  const cells: string[] = [];
  cols.forEach((col, i) => {
    const w = widths[i];
    const colAvail = w ?? Math.max(40, inh.avail - gapsTotal);
    const colAlign = col.box?.align ?? (col.text?.align as Inherited["align"]) ?? inh.align;
    const valign = col.box?.valign ?? "top";
    const colInh: Inherited = { ...inh, text: mergeText(inh.text, col.text), align: colAlign, avail: colAvail };
    const { ghost } = isShown(ctx, col);
    const inner = renderStack(ctx, col, { ...colInh, text: { ...colInh.text, align: colAlign }, ghost: inh.ghost || ghost });
    const box = col.box ?? {};
    const bg = box.background ? resolveColor(ctx.theme, box.background) : undefined;
    const tdCss = css({
      width: w ? `${w}px` : undefined,
      "vertical-align": valign,
      "text-align": colAlign,
      padding: box.padX || box.padY ? `${px(ctx, box.padY ?? 0)}px ${px(ctx, box.padX ?? 0)}px` : undefined,
      "background-color": bg,
      "border-radius": box.radius ? `${px(ctx, box.radius)}px` : undefined,
      ...borderCss(ctx, box),
      opacity: ghost && ctx.edit ? ".28" : undefined,
    });
    cells.push(
      `<td ${nodeAttrs(ctx, col, ghost)}${w ? ` width="${w}"` : ""} valign="${valign}" align="${colAlign}"${bg ? ` bgcolor="${esc(bg)}"` : ""} style="${tdCss}">${inner}</td>`.replace(
        "<td  ",
        "<td ",
      ),
    );
    if (i < cols.length - 1) {
      if (div) {
        const half = Math.round(gap / 2);
        cells.push(`<td width="${half}" style="width:${half}px;font-size:1px;line-height:1px;">&nbsp;</td>`);
        cells.push(
          `<td width="${px(ctx, div.width)}" style="width:${px(ctx, div.width)}px;background-color:${esc(resolveColor(ctx.theme, div.color))};font-size:1px;line-height:1px;" bgcolor="${esc(resolveColor(ctx.theme, div.color))}">&nbsp;</td>`,
        );
        cells.push(`<td width="${gap - half}" style="width:${gap - half}px;font-size:1px;line-height:1px;">&nbsp;</td>`);
      } else {
        cells.push(`<td width="${gap}" style="width:${gap}px;font-size:1px;line-height:1px;">&nbsp;</td>`);
      }
    }
  });
  return `<table ${TABLE} style="border-collapse:collapse;"><tr>${cells.join("")}</tr></table>`;
}

function editTextAttr(ctx: Ctx, nodeId: string): string {
  return ctx.edit ? ` data-ss-text="${nodeId}"` : "";
}

function renderField(ctx: Ctx, node: FieldNode, inh: Inherited): string {
  const { field, detached, prefix, suffix } = node.props;
  const raw = detached ? (node.props.text ?? "") : fieldValue(ctx.project.profile, field);
  let display = detached ? raw : fieldDisplay(ctx.project.profile, field);
  if (node.props.format === "initials") display = initials(display);
  if (!display.trim()) {
    if (!ctx.edit) return "";
    return `<div style="${textCss(ctx, inh.text, { opacity: ".45" })}"><span${editTextAttr(ctx, node.id)}>${esc(fieldPlaceholder(field))}</span></div>`;
  }
  const href = node.props.link === "none" || node.props.format ? null : safeHref(fieldHref(field, raw));
  let value = `<span${editTextAttr(ctx, node.id)}>${escText(display)}</span>`;
  if (href) value = `<a href="${esc(href)}" style="${linkCss(ctx, inh.text)}">${value}</a>`;
  const pre = prefix ? `<span>${esc(prefix)}</span>` : "";
  const post = suffix ? `<span>${esc(suffix)}</span>` : "";
  return `<div style="${textCss(ctx, inh.text)}">${pre}${value}${post}</div>`;
}

export function initials(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase())
    .filter((c) => /\p{L}/u.test(c))
    .slice(0, 3)
    .join("");
}

function fieldPlaceholder(field: FieldNode["props"]["field"]): string {
  const map: Record<string, string> = {
    fullName: "Your name",
    displayName: "Display name",
    title: "Job title",
    company: "Company",
    department: "Department",
    pronouns: "Pronouns",
    phone: "Phone",
    mobile: "Mobile",
    email: "Email",
    website: "Website",
    address: "Address",
    tagline: "Tagline",
    intro: "Introduction",
    booking: "Booking link",
  };
  return map[field] ?? "Field";
}

function renderText(ctx: Ctx, id: string, value: string, href: string | undefined, inh: Inherited): string {
  if (!value.trim()) {
    if (!ctx.edit) return "";
    return `<div style="${textCss(ctx, inh.text, { opacity: ".45" })}"><span${editTextAttr(ctx, id)}>Text</span></div>`;
  }
  let inner = `<span${editTextAttr(ctx, id)}>${escText(value)}</span>`;
  const safe = safeHref(href);
  if (safe) inner = `<a href="${esc(safe)}" style="${linkCss(ctx, inh.text)}">${inner}</a>`;
  return `<div style="${textCss(ctx, inh.text)}">${inner}</div>`;
}

const SEPARATORS: Record<Separator, string> = {
  dot: "·",
  bar: "|",
  slash: "/",
  dash: "–",
  bullet: "•",
  diamond: "◆",
  none: "",
};

function contactEntries(ctx: Ctx, node: ContactNode) {
  const { profile } = ctx.project;
  const out: { id: string; short: string; full: string; display: string; href: string | null }[] = [];
  for (const item of node.props.items) {
    if (!item.visible) continue;
    if (item.kind === "custom") {
      const cf = profile.custom.find((c) => c.id === item.customId);
      if (!cf || !cf.value.trim()) continue;
      out.push({ id: item.id, short: cf.label.slice(0, 1).toUpperCase(), full: cf.label, display: cf.value, href: safeHref(cf.href) });
      continue;
    }
    const meta = CONTACT_LABELS[item.kind];
    const raw = profile.fields[meta.field];
    if (!raw?.trim()) continue;
    out.push({
      id: item.id,
      short: meta.short,
      full: meta.full,
      display: fieldDisplay(profile, meta.field),
      href: item.kind === "address" ? null : safeHref(fieldHref(item.kind, raw)),
    });
  }
  return out;
}

function renderContact(ctx: Ctx, node: ContactNode, inh: Inherited): string {
  const entries = contactEntries(ctx, node);
  const p = node.props;
  if (!entries.length) {
    if (!ctx.edit) return "";
    return `<div style="${textCss(ctx, inh.text, { opacity: ".45" })}">Add phone, email or website in your profile</div>`;
  }
  const labelColor = resolveColor(ctx.theme, p.labelColor ?? "$accent");
  const label = (e: (typeof entries)[number]) =>
    p.labels === "none" ? "" : `<span style="color:${esc(labelColor)};font-weight:600;">${esc(p.labels === "short" ? e.short : e.full)}</span>&nbsp;&nbsp;`;
  const value = (e: (typeof entries)[number]) => {
    const v = escText(e.display);
    return e.href ? `<a href="${esc(e.href)}" style="${linkCss(ctx, inh.text)}">${v}</a>` : v;
  };
  const nowrap = p.nowrap ? "white-space:nowrap;" : "";
  const gap = px(ctx, p.gap);

  if (p.layout === "inline") {
    const sep = SEPARATORS[p.separator];
    const spaces = Math.max(1, Math.round(gap / 3));
    const pad = "&nbsp;".repeat(spaces);
    const joiner = sep
      ? `${pad}<span style="color:${esc(labelColor)};">${esc(sep)}</span>${pad}`
      : // "No separator" still needs readable spacing between items.
        `${pad}&nbsp;&nbsp;${pad} `;
    const items = entries.map((e) => `<span style="${nowrap}">${label(e)}${value(e)}</span>`);
    return `<div style="${textCss(ctx, inh.text)}">${items.join(joiner)}</div>`;
  }

  if (p.layout === "grid") {
    const rows: string[] = [];
    for (let i = 0; i < entries.length; i += 2) {
      const pair = entries.slice(i, i + 2);
      const pt = i ? `padding-top:${gap}px;` : "";
      rows.push(
        `<tr>${pair
          .map(
            (e, j) =>
              `<td valign="top" style="${pt}${j ? "padding-left:18px;" : ""}${textCss(ctx, inh.text, { "text-align": "left" })}${nowrap}">${label(e)}${value(e)}</td>`,
          )
          .join("")}${pair.length < 2 ? "<td></td>" : ""}</tr>`,
      );
    }
    return `<table ${TABLE} style="border-collapse:collapse;">${rows.join("")}</table>`;
  }

  const rows = entries.map((e, i) => `<tr><td style="${i ? `padding-top:${gap}px;` : ""}${textCss(ctx, inh.text)}${nowrap}">${label(e)}${value(e)}</td></tr>`);
  return `<table ${TABLE} style="border-collapse:collapse;">${rows.join("")}</table>`;
}

function imgTag(src: string, w: number, h: number, alt: string, extra = ""): string {
  return `<img src="${esc(src)}" width="${w}" height="${h}" alt="${esc(alt)}" style="display:block;width:${w}px;height:${h}px;border:0;outline:none;text-decoration:none;${extra}">`;
}

function wrapLink(html: string, href: string | null | undefined): string {
  const safe = safeHref(href ?? undefined);
  return safe ? `<a href="${esc(safe)}" style="text-decoration:none;display:inline-block;">${html}</a>` : html;
}

function alignedBlock(inner: string, align: string): string {
  return `<table ${TABLE} align="${align === "right" ? "right" : align === "center" ? "center" : "left"}" style="border-collapse:collapse;"><tr><td>${inner}</td></tr></table>`;
}

function renderImage(ctx: Ctx, node: ImageNode, inh: Inherited): string {
  const p = node.props;
  const meta = assetMeta(ctx.project, p.assetId);
  const width = Math.min(px(ctx, p.width), Math.floor(inh.avail));
  if (!meta || !p.assetId) {
    if (!ctx.edit) {
      return "";
    }
    const h = Math.round(width / (p.aspect ?? (p.role === "banner" ? 4 : p.role === "headshot" ? 1 : 2.4)));
    const radius = p.shape === "circle" ? "50%" : p.shape === "rounded" ? `${px(ctx, p.radius)}px` : "2px";
    return `<div data-ss-placeholder="${p.role}" style="width:${width}px;height:${h}px;border-radius:${radius};background:#efe9de;border:1px dashed #b9ae98;color:#8a8170;font:500 11px/1.2 Helvetica,Arial,sans-serif;display:flex;align-items:center;justify-content:center;text-align:center;">${esc(p.role === "headshot" ? "Photo" : p.role === "banner" ? "Banner" : p.role === "partner" ? "Partner logo" : p.role === "logo" ? "Logo" : "Image")}</div>`;
  }
  const frame = frameSize(width, p.aspect, meta.width, meta.height);
  const rect = cropRect(meta.width, meta.height, frame.aspect, p.crop);
  const tint = p.tint ? resolveColor(ctx.theme, p.tint) : undefined;
  const alt = p.alt || (BUILTINS[p.assetId]?.description ?? "");
  const req: ImageRequest = {
    kind: "asset",
    key: `asset|${meta.hash}|${frame.w}x${frame.h}|${rect.sx.toFixed(1)},${rect.sy.toFixed(1)},${rect.sw.toFixed(1)},${rect.sh.toFixed(1)}|${p.shape}|${p.shape === "rounded" ? px(ctx, p.radius) : 0}|${tint ?? ""}`,
    nodeId: node.id,
    label: node.name ?? alt ?? p.role,
    assetId: p.assetId,
    width: frame.w,
    height: frame.h,
    crop: rect,
    shape: p.shape,
    radius: p.shape === "rounded" ? px(ctx, p.radius) : 0,
    tint,
  };
  ctx.images.push(req);
  if (!alt.trim()) ctx.issues.push({ level: "warning", nodeId: node.id, message: `${req.label}: add alternative text for accessibility.` });

  let html: string;
  if (ctx.local) {
    const src = BUILTINS[p.assetId]?.url ?? ctx.opts.sourceUrl?.(p.assetId) ?? "";
    const k = frame.w / rect.sw;
    const radius = p.shape === "circle" ? "50%" : p.shape === "rounded" ? `${req.radius}px` : "0";
    const pos = `position:absolute;left:${(-rect.sx * k).toFixed(2)}px;top:${(-rect.sy * k).toFixed(2)}px;width:${(meta.width * k).toFixed(2)}px;height:${(meta.height * k).toFixed(2)}px;`;
    // Tinted single-colour artwork is previewed with a CSS mask; the published
    // PNG is recoloured exactly by the pipeline.
    const inner = tint
      ? `<div role="img" aria-label="${esc(alt)}" style="${pos}background:${esc(tint)};-webkit-mask:url('${esc(src)}') center/100% 100% no-repeat;mask:url('${esc(src)}') center/100% 100% no-repeat;"></div>`
      : `<img src="${esc(src)}" alt="${esc(alt)}" draggable="false" style="${pos}max-width:none;">`;
    html = `<div style="width:${frame.w}px;height:${frame.h}px;overflow:hidden;position:relative;border-radius:${radius};">${inner}</div>`;
  } else {
    const resolved = ctx.opts.resolveImage?.(req);
    if (!resolved) {
      ctx.issues.push({ level: "error", nodeId: node.id, message: `${req.label} is not published yet.` });
      return "";
    }
    html = imgTag(resolved.src, frame.w, frame.h, alt);
  }
  return alignedBlock(wrapLink(html, p.href), inh.align);
}

function renderSocial(ctx: Ctx, node: SocialNode, inh: Inherited): string {
  const p = node.props;
  const links = ctx.project.profile.socials.filter((s) => s.visible && s.url.trim() && !p.hidden.includes(s.id));
  if (!links.length) {
    if (!ctx.edit) return "";
    return `<div style="${textCss(ctx, inh.text, { opacity: ".45" })}">Add social links in your profile</div>`;
  }
  const color = resolveColor(ctx.theme, p.color);
  const background = resolveColor(ctx.theme, p.background);
  if (p.style === "text") {
    const items = links.map((s) => {
      const label = s.label || PLATFORM_MAP[s.platform].label;
      const href = safeHref(s.url.startsWith("http") ? s.url : `https://${s.url}`);
      return href ? `<a href="${esc(href)}" style="${linkCss(ctx, inh.text, color)}">${esc(label)}</a>` : esc(label);
    });
    return `<div style="${textCss(ctx, inh.text, { color })}">${items.join(`&nbsp;&nbsp;<span style="color:${esc(resolveColor(ctx.theme, "$rule"))};">·</span>&nbsp;&nbsp;`)}</div>`;
  }
  const size = px(ctx, p.size);
  const gap = px(ctx, p.gap);
  const cells = links.map((s, i) => {
    const label = s.label || PLATFORM_MAP[s.platform].label;
    const req: ImageRequest = {
      kind: "icon",
      key: `icon|${s.iconAssetId ? `custom:${ctx.project.assets[s.iconAssetId]?.hash}` : s.platform}|${p.style}|${size}|${color}|${background}`,
      nodeId: node.id,
      label: `${label} icon`,
      platform: s.platform,
      style: p.style as Exclude<SocialNode["props"]["style"], "text">,
      size,
      color,
      background,
      assetId: s.iconAssetId,
    };
    ctx.images.push(req);
    let src: string | null;
    if (ctx.local) {
      src = s.iconAssetId ? (ctx.opts.sourceUrl?.(s.iconAssetId) ?? null) : svgDataUrl(socialIconSvg(s.platform, req.style, size, color, background));
    } else {
      src = ctx.opts.resolveImage?.(req)?.src ?? null;
      if (!src) ctx.issues.push({ level: "error", nodeId: node.id, message: `${label} icon is not published yet.` });
    }
    if (!src) return "";
    const href = s.url.startsWith("http") ? s.url : `https://${s.url}`;
    const pad = i < links.length - 1 ? `padding-right:${gap}px;` : "";
    return `<td style="${pad}">${wrapLink(imgTag(src, size, size, label), href)}</td>`;
  });
  return `<table ${TABLE} align="${inh.align}" style="border-collapse:collapse;"><tr>${cells.join("")}</tr></table>`;
}

function renderButton(ctx: Ctx, node: ButtonNode, inh: Inherited): string {
  const p = node.props;
  const rawHref = p.href || (p.field ? (fieldHref(p.field, fieldValue(ctx.project.profile, p.field)) ?? "") : "");
  const href = safeHref(rawHref);
  if (!href) {
    ctx.issues.push({ level: "warning", nodeId: node.id, message: `Button "${p.label}" has no link${ctx.edit ? "" : " and was left out"}.` });
    if (!ctx.edit) return "";
  }
  const color = resolveColor(ctx.theme, p.color);
  const textColor = resolveColor(ctx.theme, p.textColor);
  const t = { ...inh.text, underline: p.variant === "link" };
  const label = `<span${editTextAttr(ctx, node.id)}>${esc(p.label || "Button")}</span>`;
  if (p.variant === "link") {
    const inner = href ? `<a href="${esc(href)}" style="${linkCss(ctx, t, color)}">${label}&nbsp;→</a>` : label;
    return `<div style="${textCss(ctx, t, { color })}">${inner}</div>`;
  }
  const solid = p.variant === "solid";
  const linkStyle = css({
    color: solid ? textColor : color,
    "text-decoration": "none",
    display: "inline-block",
    "font-weight": inh.text.weight >= 500 ? inh.text.weight : 600,
  });
  const td = css({
    "background-color": solid ? color : undefined,
    border: solid ? undefined : `1px solid ${color}`,
    "border-radius": `${px(ctx, p.radius)}px`,
    padding: `${px(ctx, p.padY)}px ${px(ctx, p.padX)}px`,
    ...Object.fromEntries(
      textCss(ctx, { ...inh.text, color: solid ? textColor : color, align: "center" })
        .split(";")
        .filter(Boolean)
        .map((d) => d.split(/:(.*)/s).slice(0, 2)),
    ),
  });
  const inner = href ? `<a href="${esc(href)}" style="${linkStyle}">${label}</a>` : label;
  return `<table ${TABLE} align="${inh.align}" style="border-collapse:separate;"><tr><td align="center"${solid ? ` bgcolor="${esc(color)}"` : ""} style="${td}">${inner}</td></tr></table>`;
}

function renderDivider(ctx: Ctx, node: DividerNode, inh: Inherited): string {
  const p = node.props;
  const color = resolveColor(ctx.theme, p.color);
  const t = Math.max(1, px(ctx, p.thickness));
  if (p.orientation === "vertical") {
    const h = px(ctx, p.length ?? 48);
    return `<table ${TABLE} align="${inh.align}" style="border-collapse:collapse;"><tr><td height="${h}" style="height:${h}px;border-left:${t}px ${p.style} ${esc(color)};font-size:1px;line-height:1px;">&nbsp;</td></tr></table>`;
  }
  const len = p.length ? Math.min(px(ctx, p.length), inh.avail) : null;
  const widthAttr = len ? `width="${len}" ` : 'width="100%" ';
  return `<table ${TABLE} ${widthAttr}align="${inh.align}" style="border-collapse:collapse;${len ? `width:${len}px;` : "width:100%;"}"><tr><td style="border-top:${t}px ${p.style} ${esc(color)};font-size:1px;line-height:1px;height:1px;">&nbsp;</td></tr></table>`;
}

function renderQr(ctx: Ctx, node: QrNode, inh: Inherited): string {
  const p = node.props;
  const raw = p.value || (p.field ? (fieldHref(p.field, fieldValue(ctx.project.profile, p.field)) ?? fieldValue(ctx.project.profile, p.field)) : "");
  if (!raw.trim()) {
    if (!ctx.edit) return "";
    return `<div style="${textCss(ctx, inh.text, { opacity: ".45" })}">QR code: add a value or website</div>`;
  }
  const size = px(ctx, p.size);
  const color = resolveColor(ctx.theme, p.color);
  const background = resolveColor(ctx.theme, p.background);
  const req: ImageRequest = {
    kind: "qr",
    key: `qr|${raw}|${size}|${color}|${background}`,
    nodeId: node.id,
    label: "QR code",
    value: raw,
    size,
    color,
    background,
  };
  ctx.images.push(req);
  let src: string | null;
  if (ctx.local) src = svgDataUrl(qrSvg(raw, size, color, background));
  else {
    src = ctx.opts.resolveImage?.(req)?.src ?? null;
    if (!src) {
      ctx.issues.push({ level: "error", nodeId: node.id, message: "QR code is not published yet." });
      return "";
    }
  }
  return alignedBlock(imgTag(src, size, size, p.alt || "QR code"), inh.align);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function renderSignature(project: Project, opts: RenderOptions): RenderResult {
  const theme = project.theme;
  const ctx: Ctx = { project, theme, opts, images: [], issues: [], edit: opts.mode === "edit", local: opts.mode !== "email" };
  const root = project.root;
  const inh: Inherited = {
    text: {
      font: "$body",
      size: theme.size,
      weight: 400,
      italic: false,
      tracking: 0,
      lineHeight: theme.lineHeight,
      transform: "none",
      color: "$ink",
      align: theme.align,
      underline: false,
    },
    align: theme.align,
    avail: Math.round(theme.width * theme.scale),
    ghost: false,
  };
  const content = renderNode(ctx, root, inh);
  const bg = theme.background && theme.background !== "transparent" ? resolveColor(theme, theme.background) : null;
  const outer = css({
    "border-collapse": "collapse",
    "background-color": bg ?? undefined,
  });
  const html = content
    ? `<table ${TABLE} style="${outer}"${bg ? ` bgcolor="${esc(bg)}"` : ""}><tr><td style="${css({
        "font-family": fontStack(resolveFont(theme, "$body"), opts.fallbackFonts),
        "font-size": `${Math.round(theme.size * theme.scale)}px`,
        color: resolveColor(theme, "$ink"),
        "text-align": theme.align,
        padding: bg ? `${px(ctx, 14)}px ${px(ctx, 16)}px` : undefined,
      })}">${content}</td></tr></table>`
    : "";
  // De-duplicate image requests by key.
  const seen = new Set<string>();
  const images = ctx.images.filter((r) => (seen.has(r.key) ? false : (seen.add(r.key), true)));
  return { html, images, issues: ctx.issues };
}

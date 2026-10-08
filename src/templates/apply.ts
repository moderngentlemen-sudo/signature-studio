import { stack } from "../model/factory";
import { PALETTES, TYPE_PRESETS } from "../model/presets";
import { cloneWithNewIds, walk } from "../model/tree";
import type { ImageNode, ImageRole, Project, SigNode, StackNode, Theme } from "../model/types";
import { DEFAULT_THEME } from "../model/factory";
import { TEMPLATE_MAP, type Template } from "./templates";

export interface ApplyOptions {
  /** Keep the project's current colours and fonts instead of the template's. */
  keepLook: boolean;
  /** Carry custom components (free text, buttons, QR, extra images) into an "Extras" group. */
  keepCustom: boolean;
}

export interface ApplySummary {
  /** Images that will be placed into matching slots of the new layout. */
  placedImages: number;
  /** Images with no matching slot (kept in Extras when keepCustom). */
  unplacedImages: number;
  /** Custom components (not derived from the profile). */
  customComponents: number;
}

const CUSTOM_TYPES = new Set<SigNode["type"]>(["text", "badge", "button", "qr"]);

function contentSignature(node: SigNode): string {
  switch (node.type) {
    case "text":
    case "badge":
      return `${node.type}|${node.props.text}|${node.props.href ?? ""}`;
    case "button":
      return `button|${node.props.label}|${node.props.href}|${node.props.field ?? ""}`;
    case "qr":
      return `qr|${node.props.value}|${node.props.field ?? ""}`;
    default:
      return node.type;
  }
}

/**
 * Nodes worth preserving: free content the profile can't regenerate. Content
 * that still matches the current template's stock content is not "custom".
 */
function collect(root: StackNode, templateId: string | undefined) {
  const stock = new Set<string>();
  const source = templateId ? TEMPLATE_MAP[templateId] : undefined;
  if (source) walk(source.build(), ({ node }) => void (CUSTOM_TYPES.has(node.type) && stock.add(contentSignature(node))));
  const images: ImageNode[] = [];
  const custom: SigNode[] = [];
  walk(root, ({ node }) => {
    if (node.type === "image" && node.props.assetId) images.push(node);
    else if (CUSTOM_TYPES.has(node.type) && !stock.has(contentSignature(node))) custom.push(node);
  });
  return { images, custom };
}

function slots(root: StackNode): ImageNode[] {
  const out: ImageNode[] = [];
  walk(root, ({ node }) => {
    if (node.type === "image") out.push(node);
  });
  return out;
}

function plan(project: Project, template: Template) {
  const next = template.build();
  const { images, custom: allCustom } = collect(project.root, project.templateId);
  // Edited content with a counterpart of the same name in the new layout
  // (e.g. "Disclaimer") is moved into that slot instead of into Extras.
  const custom: SigNode[] = [];
  for (const node of allCustom) {
    let slot: SigNode | null = null;
    if (node.name)
      walk(next, ({ node: n }) => {
        if (!slot && n.type === node.type && n.name === node.name) slot = n;
      });
    if (slot) Object.assign(slot as SigNode, { props: structuredClone(node.props), visibility: node.visibility });
    else custom.push(node);
  }
  const byRole = new Map<ImageRole, ImageNode[]>();
  for (const img of images) byRole.set(img.props.role, [...(byRole.get(img.props.role) ?? []), img]);
  const used = new Set<string>();
  const targetSlots = slots(next);
  for (const slot of targetSlots) {
    const pool = byRole.get(slot.props.role) ?? [];
    const match = pool.find((img) => !used.has(img.id));
    if (!match) continue;
    used.add(match.id);
    slot.props.assetId = match.props.assetId;
    slot.props.alt = match.props.alt;
    slot.props.href = match.props.href;
    if (match.props.tint && slot.props.tint === undefined) slot.props.tint = match.props.tint;
    // Keep framing only if the slot's frame shape is compatible.
    if ((slot.props.aspect ?? 0) === (match.props.aspect ?? 0)) slot.props.crop = { ...match.props.crop };
  }
  // Templates that tint a logo slot assume single-colour artwork; uploaded
  // full-colour logos should not be tinted.
  for (const slot of targetSlots) {
    if (slot.props.tint && slot.props.assetId && !slot.props.assetId.startsWith("builtin:")) slot.props.tint = undefined;
  }
  const unplaced = images.filter((img) => !used.has(img.id));
  return { next, unplaced, custom, placed: used.size };
}

export function summarizeApply(project: Project, template: Template): ApplySummary {
  const { unplaced, custom, placed } = plan(project, template);
  return { placedImages: placed, unplacedImages: unplaced.length, customComponents: custom.length };
}

export function templateTheme(template: Template, base: Theme = DEFAULT_THEME): Theme {
  const palette = PALETTES.find((p) => p.id === template.look.palette) ?? PALETTES[0];
  const type = TYPE_PRESETS.find((p) => p.id === template.look.type) ?? TYPE_PRESETS[0];
  return {
    ...DEFAULT_THEME,
    width: base.width,
    ...template.look.theme,
    colors: { ...palette.colors },
    fonts: { display: type.display, body: type.body },
  };
}

/** Apply a template to a project (mutates a draft). */
export function applyTemplate(draft: Project, template: Template, opts: ApplyOptions): ApplySummary {
  const { next, unplaced, custom, placed } = plan(draft, template);
  if (opts.keepCustom && (custom.length || unplaced.length)) {
    const extras = stack(
      [...custom, ...unplaced].map((n) => cloneWithNewIds(n)),
      { name: "Extras", gap: 6 },
    );
    next.children.push(extras);
  }
  draft.root = next;
  draft.templateId = template.id;
  if (!opts.keepLook) draft.theme = templateTheme(template, draft.theme);
  return { placedImages: placed, unplacedImages: unplaced.length, customComponents: custom.length };
}

/** Strict import boundary: data only, bounded trees and typed properties. */
import { z } from "zod";
import { emptyFields } from "./profile";
import { DEFAULT_THEME } from "./factory";
import { FONTS } from "./fonts";
import type { Project, SigNode } from "./types";
import { PROJECT_SCHEMA, PROJECT_VERSION } from "./types";

const id = z.string().regex(/^[a-zA-Z0-9_:-]{1,100}$/);
const color = z.string().regex(/^(#[\da-f]{3}(?:[\da-f]{3})?|\$(ink|muted|accent|link|surface|rule)|transparent)$/i);
const font = z.string().refine(v => v === "$display" || v === "$body" || FONTS.some(f => f.id === v), "Unknown font");
const num = (min = 0, max = 2400) => z.number().finite().min(min).max(max);
const str = z.string().max(20000);
const href = z.string().max(2048);
const key = z.enum(Object.keys(emptyFields()) as [keyof ReturnType<typeof emptyFields>, ...Array<keyof ReturnType<typeof emptyFields>>]);
const align = z.enum(["left", "center", "right"]);
const textStyle = z.object({ font: font.optional(), size: num(1, 200).optional(), weight: num(100, 900).optional(), italic: z.boolean().optional(), tracking: num(-1, 3).optional(), lineHeight: num(.5, 5).optional(), transform: z.enum(["none", "uppercase", "lowercase", "capitalize"]).optional(), color: color.optional(), align: align.optional(), underline: z.boolean().optional() });
const box = z.object({ padX: num().optional(), padY: num().optional(), background: color.optional(), borderWidth: num(0, 100).optional(), borderColor: color.optional(), borderSides: z.enum(["all", "top", "bottom", "left", "right", "y", "x"]).optional(), radius: num().optional(), width: num(1).optional(), align: align.optional(), valign: z.enum(["top", "middle", "bottom"]).optional() });
const base = { id, name: z.string().max(120).optional(), visibility: z.enum(["both", "full", "reply", "hidden"]).default("both"), locked: z.boolean().optional(), box: box.optional(), text: textStyle.optional() };
const platform = z.enum(["instagram", "facebook", "tiktok", "linkedin", "x", "youtube", "pinterest", "threads", "behance", "dribbble", "vimeo", "github", "custom"]);
const node = (type: string, props: z.ZodType) => z.object({ ...base, type: z.literal(type), props });

export const nodeSchema: z.ZodType<SigNode> = z.lazy(() => z.union([
  z.object({ ...base, type: z.literal("stack"), props: z.object({ gap: num().optional() }), children: z.array(nodeSchema).max(500) }),
  z.object({ ...base, type: z.literal("column"), props: z.object({ weight: num(.01, 1000), gap: num().optional() }), children: z.array(nodeSchema).max(500) }),
  z.object({ ...base, type: z.literal("row"), props: z.object({ gap: num().optional(), divider: z.object({ width: num(0, 100), color }).optional() }), children: z.array(nodeSchema).max(50) }),
  node("field", z.object({ field: key, text: str.optional(), detached: z.boolean().optional(), prefix: str.optional(), suffix: str.optional(), link: z.enum(["auto", "none"]).optional(), format: z.literal("initials").optional() })),
  node("text", z.object({ text: str, href: href.optional() })),
  node("badge", z.object({ text: str, href: href.optional() })),
  node("contact", z.object({ items: z.array(z.object({ id, kind: z.enum(["phone", "mobile", "email", "website", "address", "custom"]), customId: id.optional(), visible: z.boolean() })).max(100), layout: z.enum(["stacked", "inline", "grid"]), labels: z.enum(["none", "short", "full"]), separator: z.enum(["dot", "bar", "slash", "dash", "bullet", "diamond", "none"]), labelColor: color.optional(), gap: num(), nowrap: z.boolean().optional() })),
  node("image", z.object({ role: z.enum(["logo", "headshot", "partner", "banner", "artwork"]), assetId: id.optional(), width: num(1), aspect: num(.01, 100).optional(), crop: z.object({ x: num(-1, 1), y: num(-1, 1), zoom: num(1, 20) }), shape: z.enum(["rect", "rounded", "circle"]), radius: num(), alt: str, href: href.optional(), tint: color.optional() })),
  node("social", z.object({ style: z.enum(["bare", "circle", "outline", "tile", "text", "letter"]), size: num(1, 500), gap: num(), color, background: color, hidden: z.array(id).max(100) })),
  node("button", z.object({ label: str, href, field: key.optional(), variant: z.enum(["solid", "outline", "link"]), color, textColor: color, radius: num(), padX: num(), padY: num() })),
  node("divider", z.object({ orientation: z.enum(["horizontal", "vertical"]), thickness: num(0, 100), color, length: num().optional(), style: z.enum(["solid", "dotted", "dashed"]) })),
  node("spacer", z.object({ size: num() })),
  node("qr", z.object({ value: str, field: key.optional(), size: num(1, 1000), color, background: color, alt: str })),
]) as unknown as z.ZodType<SigNode>);

export const assetSchema = z.object({ id, name: z.string().max(300), mime: z.enum(["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"]), width: num(1, 100000), height: num(1, 100000), bytes: num(0, 20 * 1024 * 1024), hash: z.string().max(200), createdAt: num(0, Number.MAX_SAFE_INTEGER) });
const projectSchema = z.object({
  schema: z.literal(PROJECT_SCHEMA), version: z.literal(PROJECT_VERSION), id, name: z.string().max(200), createdAt: num(0, Number.MAX_SAFE_INTEGER), updatedAt: num(0, Number.MAX_SAFE_INTEGER), templateId: id.optional(),
  profile: z.object({ fields: z.record(z.string(), str), custom: z.array(z.object({ id, label: str, value: str, href: href.optional() })).max(100), socials: z.array(z.object({ id, platform, url: href, label: str.optional(), visible: z.boolean(), iconAssetId: id.optional() })).max(100) }),
  theme: z.object({ colors: z.object({ ink: color, muted: color, accent: color, link: color, surface: color, rule: color }), fonts: z.object({ display: font, body: font }), size: num(6, 40), lineHeight: num(.8, 3), width: num(200, 1200), scale: num(.3, 3), align: z.enum(["left", "center"]), background: color, gap: num(0, 80) }),
  root: nodeSchema, assets: z.record(id, assetSchema), published: z.record(z.string().max(2000), z.object({ url: href, hash: z.string().max(200), verifiedAt: num(0, Number.MAX_SAFE_INTEGER), bytes: num(0, 20 * 1024 * 1024), width: num(1, 100000), height: num(1, 100000), mime: z.string().max(100) })),
});

export class ImportError extends Error {}

function checkTree(input: unknown) {
  const seen = new Set<string>();
  let count = 0;
  const visit = (raw: unknown, depth: number, parent?: string) => {
    if (!raw || typeof raw !== "object" || depth > 24 || ++count > 1000) throw new ImportError("This component tree is too large or damaged.");
    const n = raw as { id: string; type: string; children?: unknown[] };
    if (seen.has(n.id)) throw new ImportError("Component IDs must be unique.");
    seen.add(n.id);
    if ((parent === "row" && n.type !== "column") || (parent && parent !== "row" && n.type === "column")) throw new ImportError("Invalid row or column structure.");
    const container = ["stack", "row", "column"].includes(n.type);
    if (container && !Array.isArray(n.children)) throw new ImportError("A container is missing its children.");
    if (!container && n.children !== undefined) throw new ImportError("Only containers can have children.");
    n.children?.forEach(c => visit(c, depth + 1, n.type));
  };
  visit(input, 0);
}
export function parseComponent(input: unknown): SigNode {
  checkTree(input);
  const parsed = nodeSchema.safeParse(input);
  if (!parsed.success) throw new ImportError("This component has invalid properties.");
  return parsed.data;
}
export function migrateProject(input: unknown): Project {
  if (!input || typeof input !== "object") throw new ImportError("This file isn't a Signature Studio project.");
  const raw = input as Record<string, unknown>;
  if (raw.schema !== PROJECT_SCHEMA) throw new ImportError("This file isn't a Signature Studio project.");
  if (Number(raw.version) > PROJECT_VERSION) throw new ImportError("This project was made with a newer version of Signature Studio.");
  if (raw.version !== PROJECT_VERSION) throw new ImportError("This project file has an unknown version.");
  checkTree(raw.root);
  const parsed = projectSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new ImportError(`This project file is damaged (${issue.path.join(".") || "root"}: ${issue.message}).`);
  }
  const p = parsed.data as Project;
  if (p.root.type !== "stack") throw new ImportError("Root must be a stack.");
  p.profile.fields = { ...emptyFields(), ...p.profile.fields };
  p.theme = { ...DEFAULT_THEME, ...p.theme };
  return p;
}
export interface ProjectFile { format: "signature-studio.file"; exportedAt: number; project: Project; sources: Record<string, string> }

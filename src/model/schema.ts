/**
 * Project file validation and versioned migration.
 *
 * Imports are non-destructive: a file is parsed, migrated to the current
 * version and validated into a *new* project. Nothing existing is touched
 * until the user confirms.
 */
import { z } from "zod";
import { emptyFields } from "./profile";
import { DEFAULT_THEME } from "./factory";
import type { Project } from "./types";
import { PROJECT_SCHEMA, PROJECT_VERSION } from "./types";

const visibility = z.enum(["both", "full", "reply", "hidden"]);
const nodeType = z.enum(["stack", "row", "column", "field", "text", "contact", "image", "social", "button", "divider", "spacer", "qr", "badge"]);

type NodeShape = { id: string; type: string; children?: NodeShape[] } & Record<string, unknown>;

export const nodeSchema: z.ZodType<NodeShape> = z.lazy(() =>
  z
    .object({
      id: z.string().min(1).max(64),
      type: nodeType,
      name: z.string().max(120).optional(),
      visibility: visibility.default("both"),
      locked: z.boolean().optional(),
      box: z.record(z.string(), z.unknown()).optional(),
      text: z.record(z.string(), z.unknown()).optional(),
      props: z.record(z.string(), z.unknown()),
      children: z.array(nodeSchema).optional(),
    })
    .loose(),
) as z.ZodType<NodeShape>;

const projectSchema = z.object({
  schema: z.literal(PROJECT_SCHEMA),
  version: z.literal(PROJECT_VERSION),
  id: z.string().min(1),
  name: z.string().max(200),
  createdAt: z.number(),
  updatedAt: z.number(),
  templateId: z.string().optional(),
  profile: z.object({
    fields: z.record(z.string(), z.string()),
    custom: z.array(z.object({ id: z.string(), label: z.string(), value: z.string(), href: z.string().optional() })),
    socials: z.array(
      z.object({
        id: z.string(),
        platform: z.string(),
        url: z.string().max(2048),
        label: z.string().optional(),
        visible: z.boolean(),
        iconAssetId: z.string().optional(),
      }),
    ),
  }),
  theme: z.object({
    colors: z.record(z.string(), z.string()),
    fonts: z.object({ display: z.string(), body: z.string() }),
    size: z.number().min(6).max(40),
    lineHeight: z.number().min(0.8).max(3),
    width: z.number().min(200).max(1200),
    scale: z.number().min(0.3).max(3),
    align: z.enum(["left", "center"]),
    background: z.string(),
    gap: z.number().min(0).max(80),
  }),
  root: nodeSchema,
  assets: z.record(
    z.string(),
    z.object({
      id: z.string(),
      name: z.string(),
      mime: z.string(),
      width: z.number(),
      height: z.number(),
      bytes: z.number(),
      hash: z.string(),
      createdAt: z.number(),
    }),
  ),
  published: z.record(
    z.string(),
    z.object({ url: z.string(), hash: z.string(), verifiedAt: z.number(), bytes: z.number(), width: z.number(), height: z.number(), mime: z.string() }),
  ),
});

/** Migration steps keyed by the version they upgrade *from*. */
const MIGRATIONS: Record<number, (raw: Record<string, unknown>) => Record<string, unknown>> = {
  // Example for the future: 1: (raw) => ({ ...raw, version: 2, ... }),
};

export class ImportError extends Error {}

export function migrateProject(input: unknown): Project {
  if (!input || typeof input !== "object") throw new ImportError("This file isn't a Signature Studio project.");
  let raw = input as Record<string, unknown>;
  if (raw.schema !== PROJECT_SCHEMA) throw new ImportError("This file isn't a Signature Studio project.");
  let version = Number(raw.version);
  if (!Number.isInteger(version) || version < 1) throw new ImportError("This project file has an unknown version.");
  if (version > PROJECT_VERSION) throw new ImportError("This project was made with a newer version of Signature Studio.");
  while (version < PROJECT_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) throw new ImportError(`No migration path from version ${version}.`);
    raw = step(raw);
    version = Number(raw.version);
  }
  const parsed = projectSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new ImportError(`This project file is damaged (${issue.path.join(".") || "root"}: ${issue.message}).`);
  }
  const p = parsed.data as unknown as Project;
  if (p.root.type !== "stack") throw new ImportError("This project file is damaged (root must be a stack).");
  p.profile.fields = { ...emptyFields(), ...p.profile.fields };
  p.theme = { ...DEFAULT_THEME, ...p.theme, colors: { ...DEFAULT_THEME.colors, ...p.theme.colors } };
  return p;
}

/** Portable project file: the project plus embedded source images. */
export interface ProjectFile {
  format: "signature-studio.file";
  exportedAt: number;
  project: Project;
  /** assetId → data URL of the original upload. */
  sources: Record<string, string>;
}

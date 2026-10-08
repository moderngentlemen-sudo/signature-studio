/**
 * Email readiness: derive → hash → publish → verify → render.
 * Copy / install / HTML download are enabled only when this succeeds.
 */
import { create } from "zustand";
import { sha256Hex } from "../lib/hash";
import { TEST_HOST_ENABLED, isTestHostUrl } from "../lib/url";
import type { Project, Variant } from "../model/types";
import { renderSignature, type ImageRequest } from "../render/email";
import { validateEmailHtml, type ValidationProblem } from "../render/validate";
import { useEditor } from "../state/store";
import { deriveImage } from "./derive";
import { hostFromConfig, verifyPublicImage, type HostConfig } from "./host";

export type ImageState = "pending" | "preparing" | "ready" | "attention" | "failed";

export interface ImageStatus {
  key: string;
  label: string;
  nodeId: string;
  state: ImageState;
  message?: string;
  url?: string;
}

interface PublishState {
  statuses: Record<string, ImageStatus>;
  running: Variant | null;
}

export const usePublish = create<PublishState>(() => ({ statuses: {}, running: null }));

const REVERIFY_MS = 6 * 60 * 60 * 1000;

const testNote = (url: string) => (isTestHostUrl(url) ? "Ready on the TEST host. Not visible to real recipients." : undefined);

function setStatus(s: ImageStatus) {
  usePublish.setState((st) => ({ statuses: { ...st.statuses, [s.key]: s } }));
}

/** Image requests a variant actually uses (nothing hidden, nothing empty). */
export function imageRequests(project: Project, variant: Variant): ImageRequest[] {
  return renderSignature(project, { variant, mode: "email", resolveImage: () => null }).images;
}

/** Final email HTML using verified URLs only. */
export function emailHtml(project: Project, variant: Variant, fallbackFonts = false) {
  const result = renderSignature(project, {
    variant,
    mode: "email",
    fallbackFonts,
    resolveImage: (req) => {
      const p = project.published[req.key];
      return p ? { src: p.url } : null;
    },
  });
  const problems: ValidationProblem[] = [
    ...result.issues.filter((i) => i.level === "error").map((i) => ({ level: "error" as const, message: i.message })),
    ...validateEmailHtml(result.html, { allowTestHost: TEST_HOST_ENABLED }),
  ];
  return { html: result.html, problems, ready: !problems.some((p) => p.level === "error"), images: result.images };
}

async function pool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(limit, queue.length) }, async () => {
      while (queue.length) await fn(queue.shift()!);
    }),
  );
}

/** Prepare every image used by a variant. Resolves with final readiness. */
export async function prepareVariant(variant: Variant, hostConfig: HostConfig | undefined, opts: { force?: boolean } = {}) {
  const editor = useEditor.getState();
  const project = editor.project;
  if (!project) throw new Error("No project open.");
  const requests = imageRequests(project, variant);
  usePublish.setState({ running: variant });
  const host = hostFromConfig(hostConfig);
  try {
    await pool(requests, 3, async (req) => {
      const base = { key: req.key, label: req.label, nodeId: req.nodeId };
      const cached = useEditor.getState().project!.published[req.key];
      if (cached && !opts.force) {
        if (Date.now() - cached.verifiedAt < REVERIFY_MS) {
          setStatus({ ...base, state: "ready", url: cached.url, message: testNote(cached.url) });
          return;
        }
        setStatus({ ...base, state: "preparing", message: "Re-checking public access…" });
        const v = await verifyPublicImage(cached.url);
        if (v.ok) {
          useEditor.getState().editLive((d) => void (d.published[req.key].verifiedAt = Date.now()));
          setStatus({ ...base, state: "ready", url: cached.url, message: testNote(cached.url) });
          return;
        }
      }
      if (!host) {
        setStatus({ ...base, state: "attention", message: "Image hosting isn't set up yet. Add an image host in Settings." });
        return;
      }
      try {
        setStatus({ ...base, state: "preparing", message: "Preparing image…" });
        const derivative = await deriveImage(req, (id) => project.assets[id]?.mime);
        const hash = await sha256Hex(derivative.blob);
        setStatus({ ...base, state: "preparing", message: "Publishing…" });
        const url = await host.publish(`s/${hash}.${derivative.ext}`, derivative.blob, derivative.mime);
        setStatus({ ...base, state: "preparing", message: "Verifying public access…" });
        const v = await verifyPublicImage(url, { width: derivative.width, height: derivative.height });
        if (!v.ok) {
          setStatus({ ...base, state: "failed", message: v.message });
          return;
        }
        useEditor.getState().editLive((d) => {
          d.published[req.key] = {
            url,
            hash,
            verifiedAt: Date.now(),
            bytes: v.bytes ?? derivative.blob.size,
            width: derivative.width,
            height: derivative.height,
            mime: derivative.mime,
          };
        });
        setStatus({ ...base, state: "ready", url, message: testNote(url) });
      } catch (err) {
        setStatus({ ...base, state: "failed", message: err instanceof Error ? err.message : "Something went wrong." });
      }
    });
  } finally {
    usePublish.setState({ running: null });
  }
  return emailHtml(useEditor.getState().project!, variant);
}

/**
 * Image hosting adapter + public-access verification.
 *
 * Objects are content-addressed (`s/<sha256>.<ext>`): immutable, deduplicated
 * and free of personal data. A successful upload is never enough — every URL
 * is fetched back anonymously and decoded before it counts as ready.
 */
import { isAcceptableImageUrl, isTestHostUrl } from "../lib/url";

export interface HostConfig {
  /** Base URL of the upload API, e.g. https://img.signature.studio */
  endpoint: string;
  /** Upload key (never bundled; entered by the workspace owner). */
  token?: string;
}

export interface AssetHost {
  readonly label: string;
  /** Upload (idempotent). Returns the public URL. */
  publish(path: string, blob: Blob, mime: string): Promise<string>;
}

export class HostError extends Error {
  constructor(
    message: string,
    readonly kind: "config" | "auth" | "network" | "rejected" = "network",
  ) {
    super(message);
  }
}

/** Talks to the Signature Studio image Worker (see /worker) or a compatible API. */
export class HttpAssetHost implements AssetHost {
  readonly label: string;
  constructor(private config: HostConfig) {
    this.label = new URL(config.endpoint).host;
  }

  async publish(path: string, blob: Blob, mime: string): Promise<string> {
    const url = `${this.config.endpoint.replace(/\/$/, "")}/${path}`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: "PUT",
        body: blob,
        headers: {
          "Content-Type": mime,
          ...(this.config.token ? { Authorization: `Bearer ${this.config.token}` } : {}),
        },
        credentials: "omit",
      });
    } catch {
      throw new HostError(`Couldn't reach the image host (${this.label}).`, "network");
    }
    if (res.status === 401 || res.status === 403) throw new HostError("The image host rejected the upload key.", "auth");
    if (!res.ok) throw new HostError(`The image host refused the image (${res.status}).`, "rejected");
    const body = (await res.json().catch(() => ({}))) as { url?: string };
    return body.url ?? url;
  }
}

export function hostFromConfig(config: HostConfig | undefined): AssetHost | null {
  const endpoint = config?.endpoint?.trim() || (import.meta.env.VITE_ASSET_HOST as string | undefined);
  if (!endpoint) return null;
  try {
    return new HttpAssetHost({ endpoint, token: config?.token });
  } catch {
    return null;
  }
}

export interface Verification {
  ok: boolean;
  /** Accepted only because this is a test build using the local dev host. */
  testOnly?: boolean;
  message?: string;
  width?: number;
  height?: number;
  bytes?: number;
  mime?: string;
}

/**
 * Confirm an image is reachable by anyone: public HTTPS, no cookies, right
 * MIME type, decodes, and has the expected dimensions.
 */
export async function verifyPublicImage(url: string, expected?: { width: number; height: number }): Promise<Verification> {
  if (!isAcceptableImageUrl(url)) {
    return { ok: false, message: "This address isn't publicly reachable (it must be HTTPS on a public domain)." };
  }
  let res: Response;
  try {
    res = await fetch(url, { credentials: "omit", cache: "no-store", mode: "cors", redirect: "follow" });
  } catch {
    return { ok: false, message: "The image couldn't be fetched anonymously (network or CORS error)." };
  }
  if (!res.ok) return { ok: false, message: `The image returned HTTP ${res.status}.` };
  const mime = (res.headers.get("content-type") ?? "").split(";")[0].trim();
  if (!/^image\/(png|jpeg|gif)$/.test(mime)) return { ok: false, message: `The image has the wrong type (${mime || "unknown"}).` };
  const blob = await res.blob();
  try {
    const bmp = await createImageBitmap(blob);
    const { width, height } = bmp;
    bmp.close();
    if (expected) {
      const okRatio = Math.abs(width / height - expected.width / expected.height) < 0.05;
      if (!okRatio || width < expected.width) return { ok: false, message: "The hosted image has unexpected dimensions." };
    }
    return { ok: true, width, height, bytes: blob.size, mime, testOnly: isTestHostUrl(url) };
  } catch {
    return { ok: false, message: "The hosted file isn't a decodable image." };
  }
}

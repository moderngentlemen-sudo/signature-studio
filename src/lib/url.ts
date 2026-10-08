/**
 * URL helpers. Every href that reaches rendered HTML passes through
 * `safeHref`, which allows only http(s), mailto and tel.
 */

const ALLOWED = new Set(["http:", "https:", "mailto:", "tel:"]);

export function safeHref(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;
  // Reject control characters / whitespace tricks ("java\nscript:")
  if (/[\u0000-\u001f\u007f]/.test(value)) return null;
  try {
    const url = new URL(value);
    if (!ALLOWED.has(url.protocol)) return null;
    return url.href;
  } catch {
    return null;
  }
}

/** Turn user input like "moderngentlemen.co" into an https URL. */
export function normalizeWebUrl(raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return v;
  if (v.startsWith("//")) return `https:${v}`;
  return `https://${v}`;
}

/** Display form of a website: without protocol, www and trailing slash. */
export function displayWebUrl(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/$/, "");
}

export function telHref(phone: string): string | null {
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.replace(/\+/g, "").length < 3) return null;
  return `tel:${digits}`;
}

export function mailtoHref(email: string): string | null {
  const v = email.trim();
  if (!/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(v)) return null;
  return `mailto:${v}`;
}

/** Image URLs allowed in Gmail-bound HTML. */
export function isPublicImageUrl(src: string): boolean {
  try {
    const u = new URL(src);
    if (u.protocol !== "https:") return false;
    const host = u.hostname;
    if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return false;
    if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(host)) return false;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
    if (host === "[::1]") return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Test-only escape hatch: builds made with VITE_TEST_HOST=1 accept the local
 * dev image host (http://localhost) so the publish flow can be exercised
 * end-to-end. The UI labels such builds prominently; never enable in production.
 */
export const TEST_HOST_ENABLED = (import.meta as { env?: Record<string, string> }).env?.VITE_TEST_HOST === "1";

export function isTestHostUrl(src: string): boolean {
  try {
    const u = new URL(src);
    return u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1");
  } catch {
    return false;
  }
}

export function isAcceptableImageUrl(src: string, allowTestHost = TEST_HOST_ENABLED): boolean {
  return isPublicImageUrl(src) || (allowTestHost && isTestHostUrl(src));
}

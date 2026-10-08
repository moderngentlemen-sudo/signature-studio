const MAP: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function esc(value: string): string {
  return value.replace(/[&<>"']/g, (c) => MAP[c]);
}

/** Escape text and preserve intentional line breaks. */
export function escText(value: string): string {
  return esc(value).replace(/\r?\n/g, "<br>");
}

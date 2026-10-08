const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/** Short random id, collision-safe enough for per-document node ids. */
export function uid(prefix = ""): string {
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return prefix ? `${prefix}_${out}` : out;
}

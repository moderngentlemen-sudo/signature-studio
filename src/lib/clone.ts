import { current, isDraft } from "immer";

/** Deep clone that also works on Immer drafts (structuredClone can't clone proxies). */
export function deepClone<T>(value: T): T {
  return structuredClone(isDraft(value) ? current(value) : value);
}

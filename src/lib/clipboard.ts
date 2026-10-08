/**
 * Copy a signature as *rich* content (text/html + text/plain), so pasting
 * into Gmail's signature editor yields the formatted signature, not code.
 */
export async function copyRich(html: string, plain: string): Promise<void> {
  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([plain], { type: "text/plain" }),
        }),
      ]);
      return;
    } catch {
      /* fall through to the selection-based copy */
    }
  }
  // Fallback: select rendered content and use the legacy copy command.
  const holder = document.createElement("div");
  holder.contentEditable = "true";
  holder.style.cssText = "position:fixed;left:-10000px;top:0;opacity:0;";
  holder.innerHTML = html;
  document.body.appendChild(holder);
  const range = document.createRange();
  range.selectNodeContents(holder);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
  const ok = document.execCommand("copy");
  sel?.removeAllRanges();
  holder.remove();
  if (!ok) throw new Error("Your browser blocked copying. Try again, or use Download HTML.");
}

export async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

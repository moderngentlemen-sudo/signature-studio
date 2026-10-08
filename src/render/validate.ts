import { isAcceptableImageUrl, safeHref } from "../lib/url";

/** Gmail rejects signatures longer than 10,000 characters. */
export const GMAIL_SIGNATURE_LIMIT = 10_000;

export interface ValidationProblem {
  level: "error" | "warning";
  message: string;
}

const FORBIDDEN_TAGS = ["script", "style", "iframe", "object", "embed", "form", "input", "link", "meta", "svg", "video", "audio"];

/**
 * Validate HTML intended for pasting into Gmail. Errors block copying and
 * installation; warnings are shown in the readiness panel.
 */
export function validateEmailHtml(html: string, opts: { allowTestHost?: boolean } = {}): ValidationProblem[] {
  const problems: ValidationProblem[] = [];
  if (!html.trim()) {
    problems.push({ level: "error", message: "This signature is empty." });
    return problems;
  }
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  for (const tag of FORBIDDEN_TAGS) {
    if (doc.body.querySelector(tag)) problems.push({ level: "error", message: `Contains a <${tag}> element, which email clients strip or block.` });
  }
  doc.body.querySelectorAll("*").forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      if (attr.name.startsWith("on")) problems.push({ level: "error", message: `Contains an event handler attribute (${attr.name}).` });
      if (attr.name.startsWith("data-ss")) problems.push({ level: "error", message: "Contains editor annotations." });
      if (attr.name === "class" || attr.name === "id")
        problems.push({ level: "warning", message: `Contains a ${attr.name} attribute that email clients ignore.` });
    }
  });
  doc.body.querySelectorAll("img").forEach((img) => {
    const src = img.getAttribute("src") ?? "";
    if (src.startsWith("data:")) problems.push({ level: "error", message: "An image is embedded as a data: URL. Gmail will not display it." });
    else if (src.startsWith("blob:")) problems.push({ level: "error", message: "An image points to a temporary blob: URL." });
    else if (!isAcceptableImageUrl(src, opts.allowTestHost ?? false))
      problems.push({ level: "error", message: `An image is not hosted at a public HTTPS address (${src.slice(0, 60) || "empty"}).` });
    if (!img.getAttribute("alt")) problems.push({ level: "warning", message: "An image has no alternative text." });
    if (!img.getAttribute("width") || !img.getAttribute("height")) problems.push({ level: "warning", message: "An image has no explicit width/height." });
  });
  doc.body.querySelectorAll("a").forEach((a) => {
    const href = a.getAttribute("href") ?? "";
    if (!safeHref(href)) problems.push({ level: "error", message: `A link has an unsafe or invalid address (${href.slice(0, 60) || "empty"}).` });
  });
  if (html.length > GMAIL_SIGNATURE_LIMIT) {
    problems.push({
      level: "error",
      message: `The signature is ${html.length.toLocaleString()} characters; Gmail accepts at most ${GMAIL_SIGNATURE_LIMIT.toLocaleString()}. Remove a few components or simplify styling.`,
    });
  } else if (html.length > GMAIL_SIGNATURE_LIMIT * 0.85) {
    problems.push({ level: "warning", message: `The signature is close to Gmail's 10,000-character limit (${html.length.toLocaleString()}).` });
  }
  // Deduplicate identical messages.
  const seen = new Set<string>();
  return problems.filter((p) => (seen.has(p.message) ? false : (seen.add(p.message), true)));
}

/** Wrap a signature fragment as a standalone HTML document for download. */
export function htmlDocument(fragment: string, title: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title.replace(/[<>&"]/g, "")}</title>
</head>
<body style="margin:0;padding:24px;background:#ffffff;">
<!-- Signature Studio: email signature start -->
${fragment}
<!-- Signature Studio: email signature end -->
</body>
</html>
`;
}

/** Plain-text version for the clipboard's text/plain flavour. */
export function htmlToPlainText(html: string): string {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  const lines: string[] = [];
  const walk = (el: Element) => {
    if (el.tagName === "TR" || el.tagName === "DIV") {
      const t = (el as HTMLElement).textContent?.replace(/ /g, " ").replace(/\s+/g, " ").trim();
      if (t && !el.querySelector("tr, div")) lines.push(t);
    }
    Array.from(el.children).forEach(walk);
  };
  walk(doc.body);
  return lines.join("\n");
}

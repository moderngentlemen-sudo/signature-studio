import { describe, expect, it } from "vitest";
import { renderSignature, type ImageRequest } from "./email";
import { validateEmailHtml, GMAIL_SIGNATURE_LIMIT } from "./validate";
import { createProject } from "../templates/starter";
import { TEMPLATES } from "../templates/templates";
import { contact, field, image, text } from "../model/factory";
import type { Project } from "../model/types";

const hosted = (req: ImageRequest) => ({ src: `https://img.example.com/s/${encodeURIComponent(req.key).slice(0, 40)}.png` });

function withLogo(p: Project): Project {
  p.assets["a_logo"] = { id: "a_logo", name: "logo.png", mime: "image/png", width: 400, height: 200, bytes: 1000, hash: "h1", createdAt: 0 };
  return p;
}

describe("renderSignature", () => {
  it("renders every template in both variants as valid, Gmail-sized email HTML", () => {
    for (const tpl of TEMPLATES) {
      const p = createProject({ templateId: tpl.id, sample: true });
      for (const variant of ["full", "reply"] as const) {
        const r = renderSignature(p, { variant, mode: "email", resolveImage: hosted });
        const errors = validateEmailHtml(r.html).filter((x) => x.level === "error");
        expect(errors, `${tpl.id}/${variant}: ${errors.map((e) => e.message).join("; ")}`).toEqual([]);
        expect(r.html.length).toBeLessThan(GMAIL_SIGNATURE_LIMIT);
      }
    }
  });

  it("has at least 36 distinct templates", () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(36);
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(TEMPLATES.length);
  });

  it("never emits editor annotations or data/blob images in email mode", () => {
    const p = createProject({ templateId: "exec-boardroom", sample: true });
    const r = renderSignature(p, { variant: "full", mode: "email", resolveImage: hosted });
    expect(r.html).not.toMatch(/data-ss|data:|blob:|<script/);
  });

  it("annotates nodes in edit mode", () => {
    const p = createProject({ templateId: "minimal-ledger", sample: true });
    const r = renderSignature(p, { variant: "full", mode: "edit" });
    expect(r.html).toContain(`data-ss-id="${p.root.id}"`);
  });

  it("reports unresolved images as errors and omits them", () => {
    const p = withLogo(createProject({ templateId: "exec-boardroom", sample: true }));
    const logo = (p.root.children[0] as any).children[0].children[0];
    logo.props.assetId = "a_logo";
    const r = renderSignature(p, { variant: "full", mode: "email", resolveImage: () => null });
    expect(r.issues.some((i) => i.level === "error" && i.nodeId === logo.id)).toBe(true);
    expect(r.html).not.toContain("<img");
  });

  it("respects Full/Reply visibility exactly as set", () => {
    const p = createProject({ templateId: "minimal-ledger", sample: true });
    p.root.children.push(text("FULL-ONLY", { visibility: "full" }), text("REPLY-ONLY", { visibility: "reply" }), text("HIDDEN", { visibility: "hidden" }));
    const full = renderSignature(p, { variant: "full", mode: "email" }).html;
    const reply = renderSignature(p, { variant: "reply", mode: "email" }).html;
    expect(full).toContain("FULL-ONLY");
    expect(full).not.toContain("REPLY-ONLY");
    expect(reply).toContain("REPLY-ONLY");
    expect(reply).not.toContain("FULL-ONLY");
    expect(full + reply).not.toContain("HIDDEN");
  });

  it("updates every connected field from the profile and honours detached overrides", () => {
    const p = createProject({ templateId: "minimal-ledger", sample: true });
    const detached = field("title");
    detached.props.detached = true;
    detached.props.text = "Independent title";
    p.root.children.push(detached);
    p.profile.fields.title = "Managing Partner";
    const html = renderSignature(p, { variant: "full", mode: "email" }).html;
    expect(html).toContain("Managing Partner");
    expect(html).toContain("Independent title");
  });

  it("keeps readable spacing when no separator is chosen", () => {
    const p = createProject({ sample: true });
    p.root.children = [contact(["phone", "email"], { layout: "inline", separator: "none", labels: "none", gap: 6 })];
    const html = renderSignature(p, { variant: "full", mode: "email" }).html;
    expect(html).toMatch(/0182<\/a><\/span>(&nbsp;){3,}/);
  });

  it("escapes user content and drops unsafe links", () => {
    const p = createProject({ sample: true });
    p.profile.fields.fullName = '<img src=x onerror="alert(1)">';
    p.root.children = [field("fullName"), text("click", { href: "javascript:alert(1)" })];
    const html = renderSignature(p, { variant: "full", mode: "email" }).html;
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("javascript:");
    expect(validateEmailHtml(html).filter((x) => x.level === "error")).toEqual([]);
  });

  it("applies global scale to sizes", () => {
    const p = createProject({ sample: true });
    p.root.children = [image("logo", { assetId: "a_logo", width: 100 })];
    withLogo(p);
    p.theme.scale = 0.5;
    const r = renderSignature(p, { variant: "full", mode: "email", resolveImage: hosted });
    expect(r.html).toContain('width="50"');
  });
});

describe("validateEmailHtml", () => {
  it("rejects data:, blob:, http and localhost images", () => {
    for (const src of ["data:image/png;base64,AAA", "blob:https://x/1", "http://x.com/a.png", "https://localhost/a.png", "/a.png"]) {
      const problems = validateEmailHtml(`<table><tr><td><img src="${src}" alt="a" width="1" height="1"></td></tr></table>`);
      expect(
        problems.some((p) => p.level === "error"),
        src,
      ).toBe(true);
    }
  });
  it("flags Gmail's 10,000-character limit", () => {
    const big = `<div>${"x".repeat(GMAIL_SIGNATURE_LIMIT + 1)}</div>`;
    expect(validateEmailHtml(big).some((p) => p.level === "error" && p.message.includes("10,000"))).toBe(true);
  });
});

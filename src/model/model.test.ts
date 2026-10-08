import { describe, expect, it } from "vitest";
import { column, row, stack, text } from "./factory";
import { duplicateNode, findNode, groupNode, locate, moveNode, removeNode, ungroupNode, visibleIn } from "./tree";
import { createProject } from "../templates/starter";
import { applyTemplate, summarizeApply } from "../templates/apply";
import { TEMPLATE_MAP } from "../templates/templates";
import { migrateProject, ImportError } from "./schema";
import { detectPlatform } from "./social";
import { safeHref, normalizeWebUrl, isPublicImageUrl } from "../lib/url";
import { cropRect } from "./crop";
import { formatPhone } from "./profile";
import { walk } from "./tree";
import type { ImageNode } from "./types";

function tree() {
  const a = text("A");
  const b = text("B");
  const c = text("C");
  const colL = column([a]);
  const colR = column([b]);
  const r = row([colL, colR]);
  const root = stack([r, c]);
  return { root, a, b, c, colL, colR, r };
}

describe("tree operations", () => {
  it("moves nodes between columns and within a parent", () => {
    const t = tree();
    expect(moveNode(t.root, t.a.id, t.colR.id, 1)).toBe(true);
    expect(t.colR.children.map((n) => n.id)).toEqual([t.b.id, t.a.id]);
    expect(t.colL.children).toHaveLength(0);
    // move c to index 0 of root
    expect(moveNode(t.root, t.c.id, t.root.id, 0)).toBe(true);
    expect(t.root.children[0].id).toBe(t.c.id);
  });

  it("adjusts index when moving down within the same parent", () => {
    const x = text("x"),
      y = text("y"),
      z = text("z");
    const root = stack([x, y, z]);
    moveNode(root, x.id, root.id, 2); // drop between y and z
    expect(root.children.map((n) => (n as any).props.text)).toEqual(["y", "x", "z"]);
  });

  it("refuses illegal moves", () => {
    const t = tree();
    expect(moveNode(t.root, t.r.id, t.colL.id, 0)).toBe(false); // into own descendant
    expect(moveNode(t.root, t.a.id, t.r.id, 0)).toBe(false); // non-column into row
    expect(moveNode(t.root, t.colL.id, t.root.id, 0)).toBe(false); // column into stack
  });

  it("duplicates with fresh ids, groups and ungroups", () => {
    const t = tree();
    const copy = duplicateNode(t.root, t.c.id)!;
    expect(copy).not.toBe(t.c.id);
    expect(findNode(t.root, copy)).toBeTruthy();
    const g = groupNode(t.root, t.c.id)!;
    expect(locate(t.root, t.c.id)!.parent!.id).toBe(g);
    expect(ungroupNode(t.root, g)).toBe(true);
    expect(locate(t.root, t.c.id)!.parent!.id).toBe(t.root.id);
    expect(removeNode(t.root, t.c.id)!.id).toBe(t.c.id);
  });

  it("visibility rules are literal", () => {
    expect(visibleIn("reply", "reply")).toBe(true);
    expect(visibleIn("reply", "full")).toBe(false);
    expect(visibleIn("both", "reply")).toBe(true);
    expect(visibleIn("hidden", "full")).toBe(false);
  });
});

describe("template application", () => {
  it("keeps profile, socials and images, and carries custom content to Extras", () => {
    const p = createProject({ templateId: "exec-boardroom", sample: true });
    p.assets.a1 = { id: "a1", name: "l", mime: "image/png", width: 10, height: 10, bytes: 1, hash: "h", createdAt: 0 };
    let logo: ImageNode | null = null;
    walk(p.root, ({ node }) => {
      if (node.type === "image" && node.props.role === "logo") logo = node;
    });
    logo!.props.assetId = "a1";
    logo!.props.alt = "Company logo";
    p.root.children.push(text("My custom note"));
    const socials = p.profile.socials.length;
    const summary = summarizeApply(p, TEMPLATE_MAP["corp-standard"]);
    expect(summary.placedImages).toBe(1);
    expect(summary.customComponents).toBe(1);
    applyTemplate(p, TEMPLATE_MAP["corp-standard"], { keepLook: false, keepCustom: true });
    let placed: ImageNode | null = null;
    let note = false;
    walk(p.root, ({ node }) => {
      if (node.type === "image" && node.props.assetId === "a1") placed = node;
      if (node.type === "text" && node.props.text === "My custom note") note = true;
    });
    expect(placed!.props.alt).toBe("Company logo");
    expect(note).toBe(true);
    expect(p.profile.socials).toHaveLength(socials);
    expect(p.profile.fields.fullName).toBe("Alexander Grant");
  });

  it("can keep the current look", () => {
    const p = createProject({ templateId: "exec-boardroom" });
    p.theme.colors.accent = "#123456";
    applyTemplate(p, TEMPLATE_MAP["luxury-maison"], { keepLook: true, keepCustom: false });
    expect(p.theme.colors.accent).toBe("#123456");
  });

  it("does not tint uploaded full-colour logos", () => {
    const p = createProject({ templateId: "exec-boardroom" });
    walk(p.root, ({ node }) => {
      if (node.type === "image" && node.props.role === "logo") node.props.assetId = "a9";
    });
    applyTemplate(p, TEMPLATE_MAP["luxury-maison"], { keepLook: false, keepCustom: false });
    walk(p.root, ({ node }) => {
      if (node.type === "image" && node.props.role === "logo") expect(node.props.tint).toBeUndefined();
    });
  });
});

describe("project files", () => {
  it("round-trips through migrateProject", () => {
    const p = createProject({ sample: true });
    const back = migrateProject(JSON.parse(JSON.stringify(p)));
    expect(back.root).toEqual(p.root);
    expect(back.profile.fields.fullName).toBe("Alexander Grant");
  });
  it("rejects foreign, future and damaged files", () => {
    expect(() => migrateProject({ hello: 1 })).toThrow(ImportError);
    const p = createProject();
    expect(() => migrateProject({ ...p, version: 99 })).toThrow(/newer/);
    expect(() => migrateProject({ ...p, root: { id: "x", type: "bogus", props: {} } })).toThrow(ImportError);
  });
});

describe("helpers", () => {
  it("detects social platforms", () => {
    expect(detectPlatform("instagram.com/abc")).toBe("instagram");
    expect(detectPlatform("https://www.linkedin.com/in/x")).toBe("linkedin");
    expect(detectPlatform("twitter.com/x")).toBe("x");
    expect(detectPlatform("https://example.com")).toBe("custom");
  });
  it("sanitises urls", () => {
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("java\nscript:alert(1)")).toBeNull();
    expect(safeHref("mailto:a@b.co")).toBe("mailto:a@b.co");
    expect(normalizeWebUrl("example.com")).toBe("https://example.com");
    expect(isPublicImageUrl("https://192.168.1.2/x.png")).toBe(false);
    expect(isPublicImageUrl("https://img.example.com/x.png")).toBe(true);
  });
  it("computes cover crops", () => {
    const r = cropRect(400, 200, 1, { x: 0, y: 0, zoom: 1 });
    expect(r).toEqual({ sx: 100, sy: 0, sw: 200, sh: 200 });
    const z = cropRect(400, 200, 1, { x: 1, y: 0, zoom: 2 });
    expect(z.sw).toBe(100);
    expect(z.sx).toBe(300);
  });
  it("formats phone numbers", () => {
    expect(formatPhone("4165550182")).toBe("+1 416 555 0182");
    expect(formatPhone("+44 20 7946 0958")).toBe("+44 20 7946 0958");
  });
});

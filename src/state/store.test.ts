import { beforeEach, describe, expect, it } from "vitest";
import { useEditor } from "./store";
import { createProject } from "../templates/starter";

describe("history", () => {
  beforeEach(() => useEditor.getState().load(createProject({ sample: true })));

  it("undoes and redoes edits", () => {
    const s = useEditor.getState();
    s.edit((d) => void (d.profile.fields.title = "One"));
    s.edit((d) => void (d.profile.fields.title = "Two"));
    useEditor.getState().undo();
    expect(useEditor.getState().project!.profile.fields.title).toBe("One");
    useEditor.getState().redo();
    expect(useEditor.getState().project!.profile.fields.title).toBe("Two");
  });

  it("coalesces rapid edits with the same key into one step", () => {
    const before = useEditor.getState().project!.profile.fields.title;
    for (const v of ["C", "Cr", "Cre", "Crea"]) useEditor.getState().edit((d) => void (d.profile.fields.title = v), "title");
    useEditor.getState().undo();
    expect(useEditor.getState().project!.profile.fields.title).toBe(before);
  });

  it("treats a gesture as one undo step", () => {
    const s = useEditor.getState();
    const before = s.project!.theme.scale;
    s.beginGesture();
    for (let i = 1; i <= 10; i++) useEditor.getState().editLive((d) => void (d.theme.scale = 1 - i / 100));
    useEditor.getState().endGesture();
    expect(useEditor.getState().project!.theme.scale).toBeCloseTo(0.9);
    useEditor.getState().undo();
    expect(useEditor.getState().project!.theme.scale).toBe(before);
  });
});

describe("edits on drafts", () => {
  it("duplicates and applies templates inside an undoable edit", async () => {
    const { duplicateNode } = await import("../model/tree");
    const { applyTemplate } = await import("../templates/apply");
    const { TEMPLATE_MAP } = await import("../templates/templates");
    const { text } = await import("../model/factory");
    useEditor.getState().load(createProject({ sample: true }));
    const note = text("Custom note");
    useEditor.getState().edit((d) => void d.root.children.push(note));
    useEditor.getState().edit((d) => void duplicateNode(d.root, note.id));
    expect(JSON.stringify(useEditor.getState().project!.root).match(/Custom note/g)).toHaveLength(2);
    useEditor.getState().edit((d) => void applyTemplate(d, TEMPLATE_MAP["luxury-maison"], { keepLook: false, keepCustom: true }));
    expect(JSON.stringify(useEditor.getState().project!.root)).toContain("Custom note");
  });
});

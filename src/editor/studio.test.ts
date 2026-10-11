import { beforeEach, describe, expect, it } from "vitest";
import { column, contact, field, image, newProject, row, stack, text } from "../model/factory";
import { findNode, walk } from "../model/tree";
import { migrateProject, parseComponent } from "../model/schema";
import { TEMPLATES } from "../templates/templates";
import { createProject } from "../templates/starter";
import { applyTemplate } from "../templates/apply";
import { useEditor } from "../state/store";
import { bulkStyle, groupMany, previewPerson, proposeLayout } from "./studio";
import { duplicateSelected, moveSelectionTo, moveTo, removeSelected } from "./actions";
import { applyInlineText } from "./Canvas";
import { parseContactText } from "./contactImport";
import { renderSignature } from "../render/email";
import { contrast, designChecks } from "./assist";

beforeEach(()=>useEditor.getState().load(newProject()));
describe("safe import boundary",()=>{
  it("round-trips every shipped template",()=>{ for(const t of TEMPLATES) expect(migrateProject(createProject({templateId:t.id})).root.type).toBe("stack"); });
  it.each(['n\" onclick=\"alert(1)',"n<script>"])("rejects markup in IDs: %s",id=>{ const p=newProject();p.root.id=id; expect(()=>migrateProject(p)).toThrow(); });
  it("rejects style breakouts, unsafe fonts and non-finite widths",()=>{
    for(const bad of [{text:{color:'#fff;position:fixed'}},{text:{font:'Arial";}'}},{box:{width:Infinity}}]) {
      const p=newProject();Object.assign(p.root,bad);expect(()=>migrateProject(p)).toThrow();
    }
  });
  it("rejects missing children, duplicate IDs, illegal rows and malformed props",()=>{
    const p=newProject();const a=text("a");p.root.children=[a,{...a}];expect(()=>migrateProject(p)).toThrow();
    expect(()=>parseComponent({...row([]),children:[text("illegal")]})).toThrow();
    expect(()=>parseComponent({...stack([]),children:undefined})).toThrow();
    expect(()=>parseComponent({...contact(),props:{layout:"nonsense"}})).toThrow();
  });
  it("rejects excessive nesting and strips unrecognized properties",()=>{
    let n=stack([]); for(let i=0;i<30;i++) n=stack([n]); expect(()=>parseComponent(n)).toThrow();
    expect(parseComponent({...text("safe"),unknown:"discard"})).not.toHaveProperty("unknown");
  });
});
describe("editor proposals and multi-selection",()=>{
  it("preserves leaf content and font sizes across every layout proposal",()=>{
    const p=newProject();const first=text("First",{text:{size:21}});p.root.children=[row([column([first]),column([contact()])])];
    const original=JSON.stringify(p);
    for(const fix of ["spacing","contacts","columns","stack"] as const) {
      const proposal=proposeLayout(p,fix);
      expect(migrateProject(proposal).root.type).toBe("stack");
      expect(findNode(proposal.root,first.id)?.text?.size).toBe(21);
      expect(JSON.stringify(proposal.root)).toContain("First");
    }
    expect(JSON.stringify(p)).toBe(original);
  });
  it("does not repair descendants of a locked section",()=>{
    const p=newProject();const block=stack([contact(undefined,{layout:"inline",nowrap:true})]);block.locked=true;p.root.children=[block];
    expect(proposeLayout(p,"contacts").root).toEqual(p.root);
  });
  it("keeps locked column structures intact when stacking",()=>{
    const p=newProject();const c=column([text("Locked")]);c.locked=true;p.root.children=[row([c])];
    expect(proposeLayout(p,"stack").root.children[0].type).toBe("row");
  });
  it("normalizes ancestor/descendant selections and bulk edits once",()=>{
    const p=newProject();const group=stack([text("a"),text("b")]);p.root.children=[group,text("c")];useEditor.getState().load(p);
    useEditor.getState().selectMany([group.id,group.children[0].id]);expect(useEditor.getState().selections).toEqual([group.id]);
    useEditor.getState().selectMany(group.children.map(n=>n.id));bulkStyle({size:18,color:"$accent"},{padX:4});
    expect(useEditor.getState().past).toHaveLength(1);
    expect(findNode(useEditor.getState().project!.root,group.children[1].id)?.text?.size).toBe(18);
    useEditor.getState().undo();expect(useEditor.getState().project!.root).toEqual(p.root);
  });
  it("duplicates and removes normalized selections in one undo step",()=>{
    const p=newProject();p.root.children=[text("a"),text("b")];useEditor.getState().load(p);useEditor.getState().selectMany(p.root.children.map(n=>n.id));
    duplicateSelected();expect(useEditor.getState().project!.root.children).toHaveLength(4);
    expect(useEditor.getState().selections).toHaveLength(2);expect(useEditor.getState().past).toHaveLength(1);
    removeSelected();expect(useEditor.getState().project!.root.children).toHaveLength(2);
    useEditor.getState().undo();expect(useEditor.getState().project!.root.children).toHaveLength(4);
  });
  it("groups adjacent nodes without changing reading order",()=>{
    const p=newProject();p.root.children=[text("a"),text("b"),text("c")];useEditor.getState().load(p);useEditor.getState().selectMany(p.root.children.slice(0,2).map(n=>n.id));groupMany();
    const g=useEditor.getState().project!.root.children[0];expect(g.type).toBe("stack");expect("children" in g && g.children.map(n=>n.id)).toEqual(p.root.children.slice(0,2).map(n=>n.id));expect(useEditor.getState().past).toHaveLength(1);
  });
  it("rejects non-adjacent grouping without moving intervening content",()=>{
    const p=newProject();p.root.children=[text("a"),text("b"),text("c")];useEditor.getState().load(p);useEditor.getState().selectMany([p.root.children[0].id,p.root.children[2].id]);groupMany();expect(useEditor.getState().project!.root).toEqual(p.root);
  });
  it("moves several nodes atomically and rejects cycles",()=>{
    const p=newProject();const a=text("a"),b=text("b"),dest=stack([text("c")]);p.root.children=[a,b,dest];useEditor.getState().load(p);useEditor.getState().selectMany([a.id,b.id]);
    expect(moveSelectionTo(a.id,{kind:"insert",parentId:dest.id,index:1})).toBe(true);
    const current=useEditor.getState().project!;expect(migrateProject(current)).toBeTruthy();expect(current.root.children).toHaveLength(1);
    expect((findNode(current.root,dest.id) as typeof dest).children.map(n=>n.type==="text" ? n.props.text:"")).toEqual(["c","a","b"]);
    expect(useEditor.getState().past).toHaveLength(1);
    useEditor.getState().selectMany([dest.id]);expect(moveTo(dest.id,{kind:"beside",targetId:a.id,side:"left"})).toBe(false);expect(useEditor.getState().project).toBe(current);
  });
  it("keeps profile samples out of document/history",()=>{
    const p=createProject();useEditor.getState().load(p);
    expect(previewPerson(p,"long").profile.fields.fullName).not.toBe(p.profile.fields.fullName);
    expect(previewPerson(p,"international").profile.fields.fullName).toContain("山田");
    expect(useEditor.getState().project).toEqual(p);expect(useEditor.getState().past).toHaveLength(0);
  });
  it("keeps detached field content when applying another template",()=>{
    const p=createProject();const detached=field("title");detached.props.detached=true;detached.props.text="Custom consultant";p.root.children.push(detached);
    applyTemplate(p,TEMPLATES[1],{keepLook:false,keepCustom:true});
    let preserved=false;walk(p.root,({node})=>{if(node.type==="field" && node.props.detached && node.props.text==="Custom consultant") preserved=true;});
    expect(preserved).toBe(true);
  });
  it("preserves a website URL after no-op inline editing",()=>{
    const p=newProject();p.profile.fields.website="https://www.example.com/path?utm_source=signature";const n=field("website");p.root.children=[n];useEditor.getState().load(p);
    applyInlineText(n.id,"example.com/path?utm_source=signature");expect(useEditor.getState().project!.profile.fields.website).toBe(p.profile.fields.website);
  });
});
describe("diagnostics and reviewed import",()=>{
  it("resolves inherited contrast and ignores hidden content",()=>{
    const p=newProject();const child=text("Low contrast");p.root.children=[stack([child],{text:{color:"#aaa"},box:{background:"#fff"}}),text("hidden",{visibility:"hidden",text:{size:4}})];
    const checks=designChecks(p,0);expect(checks.some(c=>c.nodeId===child.id && c.message.includes("contrast"))).toBe(true);
    expect(checks.some(c=>c.message.includes("4.0px"))).toBe(false);expect(contrast("#fff","#000")).toBe(21);
  });
  it("flags unsafe links and missing functional alternative text",()=>{
    const p=newProject();const n=text("Click",{href:"javascript:alert(1)"});p.root.children=[n,image("logo",{assetId:"builtin:mg-monogram",href:"https://example.com"})];
    expect(designChecks(p,0).filter(c=>c.level==="warning").length).toBeGreaterThanOrEqual(2);p.root.children.push(image("logo",{assetId:"constructor",alt:"Unknown source"}));expect(designChecks(p,0).some(c=>c.message.includes("metadata is missing"))).toBe(true);expect(renderSignature(p,{variant:"full",mode:"email"}).issues.some(i=>i.level==="error")).toBe(true);
  });
  it("parses labelled text conservatively",()=>{
    const result=parseContactText("Name: Alex Morgan\nEmail: alex@example.com\nUnlabelled: ignore\nhttps://example.com");expect(result.map(s=>s.field)).toEqual(["fullName","email","website"]);expect(parseContactText("Alex Morgan 555 1234")).toEqual([]);expect(parseContactText("constructor: value\n__proto__: value")).toEqual([]);
  });
  it("parses vCard cell numbers, folded lines and escaped characters",()=>{
    const result=parseContactText("BEGIN:VCARD\nFN:Élodie Nguyễn\nORG:Modern Gentlemen;Studio\nTEL;TYPE=CELL:+1 555 555 1212\nTITLE:Creative \n Director\nEND:VCARD");
    expect(result.find(s=>s.field==="mobile")?.value).toContain("+1");expect(result.find(s=>s.field==="title")?.value).toBe("Creative Director");
  });
});

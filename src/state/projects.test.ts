import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { image, newProject as documentProject, text } from "../model/factory";
import type { Project } from "../model/types";
import { useEditor } from "./store";
const mocks=vi.hoisted(()=>({projects:new Map<string,Project>(),blobs:new Map<string,Blob>(),fail:false,serial:0,stop:null as null|(()=>void)}));
vi.mock("../storage/db",()=>({
  localProjects:{
    load:vi.fn(async(id:string)=>mocks.projects.get(id)??null),
    save:vi.fn(async(p:Project)=>{if(mocks.fail)throw new Error("Quota");mocks.projects.set(p.id,structuredClone(p));}),
    list:vi.fn(async()=>[...mocks.projects.values()].map(p=>({id:p.id,name:p.name,updatedAt:p.updatedAt}))),
    remove:vi.fn(async(id:string)=>{mocks.projects.delete(id);})
  },
  assetStore:{get:vi.fn(async(id:string)=>mocks.blobs.get(id)??null),put:vi.fn(async(id:string,b:Blob)=>{mocks.blobs.set(id,b);})},
  versionStore:{list:vi.fn(async()=>[]),add:vi.fn(async()=>{})}
}));
vi.mock("./prefs",()=>({updatePrefs:vi.fn()}));
vi.mock("./assets",()=>({
  MAX_UPLOAD_BYTES:15*1024*1024,
  hydrateSources:vi.fn(async()=>[]),
  blobToDataUrl:vi.fn(async()=>"data:image/png;base64,aGVsbG8="),
  ingestFile:vi.fn(async(b:Blob,name:string)=>{const id="a_fresh_"+ ++mocks.serial;mocks.blobs.set(id,b);return {id,name,mime:"image/png",width:64,height:32,bytes:5,hash:"hash",createdAt:Date.now()};})
}));
import { deleteProject, duplicateProject, flushSave, importProjectFile, newProject, openProject, startAutosave } from "./projects";
import { localProjects } from "../storage/db";
beforeEach(()=>{mocks.projects.clear();mocks.blobs.clear();mocks.fail=false;useEditor.setState({project:null,past:[],future:[],selection:null,selections:[]});});
afterEach(()=>{mocks.stop?.();mocks.stop=null;vi.useRealTimers();});
it("blocks switching and New when saving fails, preserving unsaved edits",async()=>{
  const a=await newProject({sample:false}), b=documentProject("other");mocks.projects.set(b.id,b);
  useEditor.getState().edit(d=>{d.profile.fields.title="Unsaved";});
  const before=useEditor.getState().project;mocks.fail=true;
  expect(await openProject(b.id)).toBe(false);expect(useEditor.getState().project).toBe(before);expect(useEditor.getState().saveState).toBe("error");
  await expect(newProject()).rejects.toThrow();expect(useEditor.getState().project?.id).toBe(a.id);
});
it("forks a conflict and keeps the new identity across undo, redo and saves",async()=>{
  const a=await newProject({sample:false});useEditor.getState().edit(d=>{d.profile.fields.title="My work";});
  mocks.projects.set(a.id,{...a,updatedAt:Date.now()+100000,profile:{...a.profile,fields:{...a.profile.fields,title:"Other tab"}}});
  expect(await flushSave()).toBe(true);const copy=useEditor.getState().project!;expect(copy.id).not.toBe(a.id);
  useEditor.getState().undo();expect(useEditor.getState().project?.id).toBe(copy.id);
  useEditor.getState().redo();await flushSave();expect(useEditor.getState().project?.id).toBe(copy.id);
  expect(mocks.projects.get(a.id)?.profile.fields.title).toBe("Other tab");
});
it("duplicates the latest unsaved document",async()=>{
  const a=await newProject({sample:false});useEditor.getState().edit(d=>{d.profile.fields.title="Immediate edit";});
  const copy=await duplicateProject(a.id);expect(copy?.profile.fields.title).toBe("Immediate edit");expect(copy?.id).not.toBe(a.id);
});
it("does not resurrect a dirty deleted project after debounce",async()=>{
  vi.useFakeTimers();const a=await newProject({sample:false});mocks.stop=startAutosave();useEditor.getState().edit(d=>{d.name="Dirty";});
  await deleteProject(a.id);await vi.advanceTimersByTimeAsync(1500);expect(mocks.projects.has(a.id)).toBe(false);expect(useEditor.getState().project?.id).not.toBe(a.id);
});
it("imports missing asset metadata under fresh identities and clears verified URLs",async()=>{
  const p=documentProject();p.assets.shared={id:"shared",name:"Logo",mime:"image/png",width:64,height:32,bytes:5,hash:"hash",createdAt:1};p.root.children=[image("logo",{assetId:"shared"})];
  mocks.blobs.set("shared",new Blob(["original"]));p.published.cached={url:"https://example.com/logo.png",verifiedAt:Date.now(),hash:"hash",bytes:5,width:64,height:32,mime:"image/png"};
  const fresh=await importProjectFile(JSON.stringify(p));const freshId=Object.keys(fresh.assets)[0];
  expect(freshId).not.toBe("shared");expect(fresh.published).toEqual({});expect(fresh.root.children[0].type==="image" && fresh.root.children[0].props.assetId).toBe(freshId);expect(mocks.blobs.get("shared")?.size).toBe(8);
});
it("remaps embedded images and custom social icons without overwriting blobs",async()=>{
  const p=documentProject();p.assets.shared={id:"shared",name:"Logo",mime:"image/png",width:64,height:32,bytes:5,hash:"hash",createdAt:1};p.root.children=[image("logo",{assetId:"shared"})];p.profile.socials=[{id:"social",platform:"custom",url:"https://example.com",visible:true,iconAssetId:"shared"}];
  mocks.blobs.set("shared",new Blob(["original"]));
  const fresh=await importProjectFile(JSON.stringify({format:"signature-studio.file",project:p,sources:{shared:"data:image/png;base64,aGVsbG8="}}));
  const id=Object.keys(fresh.assets)[0];expect(id).not.toBe("shared");expect(fresh.profile.socials[0].iconAssetId).toBe(id);expect(mocks.blobs.get("shared")?.size).toBe(8);
});
it("rejects an invalid image envelope before saving a project",async()=>{
  const p=documentProject();p.assets.bad={id:"bad",name:"x",mime:"image/png",width:1,height:1,bytes:1,hash:"x",createdAt:1};
  await expect(importProjectFile(JSON.stringify({format:"signature-studio.file",project:p,sources:{bad:"https://evil.example/image"}}))).rejects.toThrow();
  expect(mocks.projects.size).toBe(0);
});
it("preserves an edit made while a project is loading",async()=>{
  const a=await newProject({sample:false}),b=documentProject("other");mocks.projects.set(b.id,b);
  const load=vi.mocked(localProjects.load);const normal=load.getMockImplementation()!;
  load.mockImplementation(async id=>{const result=await normal(id);if(id===b.id)useEditor.getState().edit(d=>{d.root.children.push(text("During load"));});return result;});
  await openProject(b.id);load.mockImplementation(normal);
  expect(JSON.stringify(mocks.projects.get(a.id)?.root)).toContain("During load");
});

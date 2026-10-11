import { beforeEach, expect, it, vi } from "vitest";
import { image, newProject } from "../model/factory";
import { useEditor } from "../state/store";
const mocks=vi.hoisted(()=>({verify:vi.fn(async()=>({ok:false,message:"Gone"}))}));
vi.mock("./host",()=>({hostFromConfig:()=>null,verifyPublicImage:mocks.verify}));
vi.mock("./derive",()=>({deriveImage:vi.fn()}));
import { emailHtml, imageRequests, prepareVariant } from "./prepare";
beforeEach(()=>{mocks.verify.mockReset();mocks.verify.mockResolvedValue({ok:false,message:"Gone"});useEditor.getState().load(newProject());});
it("does not permit stale images and removes failed cache entries",async()=>{
  const p=newProject();p.root.children=[image("logo",{assetId:"builtin:mg-monogram",alt:"Company"})];
  const req=imageRequests(p,"full")[0];expect(req).toBeTruthy();p.published[req.key]={url:"https://cdn.example.com/logo.png",hash:"hash",verifiedAt:Date.now()-7*60*60*1000,bytes:1,width:120,height:60,mime:"image/png"};
  useEditor.getState().load(p);expect(emailHtml(p,"full").ready).toBe(false);
  const result=await prepareVariant("full",undefined);expect(result.ready).toBe(false);expect(useEditor.getState().project!.published[req.key]).toBeUndefined();
});
it("force preparation invalidates even a recently verified image",async()=>{
  const p=newProject();p.root.children=[image("logo",{assetId:"builtin:mg-monogram",alt:"Company"})];
  const req=imageRequests(p,"full")[0];p.published[req.key]={url:"https://cdn.example.com/logo.png",hash:"hash",verifiedAt:Date.now(),bytes:1,width:120,height:60,mime:"image/png"};useEditor.getState().load(p);
  expect(emailHtml(p,"full").ready).toBe(true);expect((await prepareVariant("full",undefined,{force:true})).ready).toBe(false);
});
it("does not write asynchronous verification into a newly opened project",async()=>{
  const p=newProject();p.root.children=[image("logo",{assetId:"builtin:mg-monogram",alt:"Company"})];const req=imageRequests(p,"full")[0];p.published[req.key]={url:"https://cdn.example.com/logo.png",hash:"hash",verifiedAt:1,bytes:1,width:120,height:60,mime:"image/png"};useEditor.getState().load(p);
  const other=newProject();mocks.verify.mockImplementationOnce(async()=>{useEditor.getState().load(other);return {ok:true,message:""};});
  await expect(prepareVariant("full",undefined)).rejects.toThrow("changed");expect(useEditor.getState().project).toBe(other);expect(other.published).toEqual({});
});

import { createRequire } from "node:module";
import { writeFile, mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
const require=createRequire(new URL("../package.json",import.meta.url));
const { chromium, expect }=require("@playwright/test");
const browser=await chromium.launch({...(process.env.BROWSER_EXECUTABLE_PATH ? {executablePath:process.env.BROWSER_EXECUTABLE_PATH}:{}),headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.route("https://fonts.googleapis.com/**",r=>r.abort());
await context.route("https://fonts.gstatic.com/**",r=>r.abort());
const page=await context.newPage();
const errors=[];page.on("pageerror",e=>errors.push(e.message));
const reports=[];
async function step(name,run) { await run(); reports.push({name,passed:true}); console.log("PASS "+name); }
const stage=()=>page.locator("[data-testid=stage] .stage-host");
const snapshot=()=>page.evaluate(async()=>{const {useEditor}=await import("/src/state/store.ts");const p=useEditor.getState().project;return JSON.stringify({root:p.root,profile:p.profile,theme:p.theme});});
const close=()=>page.locator("dialog[open]").getByRole("button",{name:"Close",exact:true}).click();
try {
 await page.goto(process.env.STUDIO_URL??"http://127.0.0.1:5182");
 await page.getByTestId("ob-sample").click();await expect(page.getByTestId("stage")).toBeVisible();
 await page.getByRole("button",{name:"Advanced",exact:true}).click();
 await step("template audition cancels without changing the document",async()=>{
  const before=await snapshot();await page.getByTestId("tab-templates").click();
  await page.getByLabel("Compare Maison").check();await page.getByLabel("Compare Boardroom").check();
  await page.getByRole("button",{name:/Compare 2 selected/}).click();
  await expect(page.getByTestId("apply-template")).toBeVisible();
  assert.ok(await page.locator("dialog[open] .preview-card").count()>=3);
  await page.getByRole("button",{name:"Keep my current colours and fonts"}).count();
  await close();assert.equal(await snapshot(),before);
 });
 await step("layout fix applies once and undo restores the design",async()=>{
  const before=await snapshot();await page.getByRole("button",{name:"Fix layout",exact:true}).first().click();
  await page.getByRole("button",{name:/Stack columns vertically/}).click();
  await page.getByRole("button",{name:"Apply layout fix",exact:true}).click();
  assert.notEqual(await snapshot(),before);await page.getByRole("button",{name:"Undo",exact:true}).first().click();assert.equal(await snapshot(),before);
 });
 await step("shift-click selects several and bulk typography is undoable",async()=>{
  const fields=stage().locator("[data-ss-type=field]");
  await fields.nth(0).click();await fields.nth(1).click({modifiers:["Shift"]});
  await expect(page.getByTestId("bulk-inspector")).toBeVisible();
  const before=await snapshot();await page.getByLabel("Selection text size",{exact:true}).fill("19");await page.getByLabel("Selection text size",{exact:true}).press("Tab");
  const sizes=await page.evaluate(async()=>{const {useEditor}=await import("/src/state/store.ts");const {findNode}=await import("/src/model/tree.ts");const st=useEditor.getState();return st.selections.map(id=>findNode(st.project.root,id).text.size);});
  assert.deepEqual(sizes,[19,19]);await page.getByRole("button",{name:"Undo",exact:true}).first().click();assert.equal(await snapshot(),before);
 });
 await step("preview fixtures, image blocking and dialog handoff are safe",async()=>{
  const before=await snapshot();await page.getByRole("button",{name:"Preview lab",exact:true}).click();
  await page.getByLabel("Sample content",{exact:true}).selectOption("international");
  await expect(page.getByTestId("preview-lab").getByText("Élodie Nguyễn 山田",{exact:false}).first()).toBeVisible();
  assert.equal(await page.locator("dialog[open] .preview-card").count(),6);
  const blocked=page.getByRole("region",{name:"Images blocked",exact:true});assert.equal(await blocked.locator("img").count(),0);
  assert.equal(await snapshot(),before);
  await page.getByRole("button",{name:"Review layout fixes",exact:true}).click();await expect(page.getByTestId("layout-fix")).toBeVisible();await close();
 });
 await step("native Enter activates a toolbar button",async()=>{
  const b=page.getByRole("button",{name:"Preview lab",exact:true});await b.focus();await page.keyboard.press("Enter");await expect(page.getByTestId("preview-lab")).toBeVisible();await close();
 });
 await step("contact import reviews selected fields and supports undo",async()=>{
  await page.getByTestId("tab-profile").click();const before=await snapshot();
  await page.getByRole("button",{name:"Import contact details",exact:true}).click();
  await page.getByLabel("Contact text or vCard").fill("Name: Jordan Ellis\nTitle: Head of Brand\nEmail: jordan@example.com");
  await page.getByLabel("Import Full name",{exact:true}).uncheck();await page.getByRole("button",{name:"Apply selected fields"}).click();
  await expect(page.getByTestId("profile-title")).toHaveValue("Head of Brand");
  await expect(page.getByTestId("profile-fullName")).toHaveValue("Alexander Grant");
  await page.getByRole("button",{name:"Undo",exact:true}).first().click();assert.equal(await snapshot(),before);
 });
 await step("canvas links never navigate away",async()=>{
  const before=page.url();await stage().locator("a").first().click();assert.equal(page.url(),before);
 });
 await step("malicious import is rejected in the actual browser",async()=>{
  assert.equal(await page.evaluate(async()=>{const f=await import("/src/model/factory.ts");const life=await import("/src/state/projects.ts");const p=f.newProject();p.root.children=[f.text("x")];p.root.children[0].id='n"><img src=x onerror=window.__bad=1>';try{await life.importProjectFile(JSON.stringify(p));return false;}catch{return true;}}),true);
 });
 await step("importing images never overwrites another project source",async()=>{
  const result=await page.evaluate(async()=>{
   const f=await import("/src/model/factory.ts"),assets=await import("/src/state/assets.ts"),db=await import("/src/storage/db.ts"),life=await import("/src/state/projects.ts"),hash=await import("/src/lib/hash.ts");
   const c=document.createElement("canvas");c.width=c.height=8;const ctx=c.getContext("2d");ctx.fillStyle="red";ctx.fillRect(0,0,8,8);const red=await new Promise(r=>c.toBlob(r,"image/png"));ctx.fillStyle="blue";ctx.fillRect(0,0,8,8);const blue=await new Promise(r=>c.toBlob(r,"image/png"));
   const meta=await assets.ingestFile(red,"Original");const p=f.newProject();p.assets[meta.id]=meta;p.root.children=[f.image("logo",{assetId:meta.id})];await db.localProjects.save(p);const file=JSON.parse(await life.exportProjectFile(p));file.sources[meta.id]=await assets.blobToDataUrl(blue);const copy=await life.importProjectFile(JSON.stringify(file));
   return {sourceHash:await hash.sha256Hex(await db.assetStore.get(meta.id)),originalHash:meta.hash,oldId:meta.id,newId:copy.root.children[0].props.assetId};
  });assert.equal(result.sourceHash,result.originalHash);assert.notEqual(result.oldId,result.newId);
 });
 await step("saved image components carry sources into another project",async()=>{
  assert.equal(await page.evaluate(async()=>{
   const f=await import("/src/model/factory.ts"),assets=await import("/src/state/assets.ts"),{useEditor}=await import("/src/state/store.ts"),lib=await import("/src/editor/library.ts"),actions=await import("/src/editor/actions.ts");
   const c=document.createElement("canvas");c.width=c.height=16;c.getContext("2d").fillRect(0,0,16,16);const blob=await new Promise(r=>c.toBlob(r,"image/png"));const meta=await assets.ingestFile(blob,"Portable image");const p=f.newProject();p.assets[meta.id]=meta;const n=f.image("logo",{assetId:meta.id});p.root.children=[n];useEditor.getState().load(p);await lib.saveComponent(n,"Portable image");const item=lib.useLibrary.getState().components[0];await lib.importComponents([item]);const fresh=lib.useLibrary.getState().components[0];useEditor.getState().load(f.newProject());actions.insertNode(fresh.node,undefined,fresh.assets);const target=useEditor.getState().project;
   return !!target.assets[target.root.children[0].props.assetId] && !!assets.sourceUrl(target.root.children[0].props.assetId) && target.root.children[0].props.assetId!==meta.id;
  }),true);
 });
 await step("hidden-only container drop resolves safely",async()=>{
  const rootId=await page.evaluate(async()=>{const f=await import("/src/model/factory.ts"),{useEditor}=await import("/src/state/store.ts");const p=f.newProject();p.root.children=[f.text("Hidden",{visibility:"hidden"})];useEditor.getState().load(p);useEditor.getState().set({ghosts:false,mode:"advanced",leftPanel:"add"});return p.root.id;});
  const from=await page.getByTestId("lib-text").boundingBox();const to=await stage().locator("[data-ss-id='"+rootId+"']").boundingBox();
  assert.ok(from&&to);await page.mouse.move(from.x+20,from.y+10);await page.mouse.down();await page.mouse.move(from.x+35,from.y+20,{steps:4});await page.mouse.move(to.x+10,to.y+to.height/2,{steps:8});await page.mouse.up();
  await expect(stage().getByText("Your text here")).toBeVisible();
 });
 await step("visual version comparison and restore remain available",async()=>{
  await page.evaluate(async()=>{const {createProject}=await import("/src/templates/starter.ts"),{useEditor}=await import("/src/state/store.ts");useEditor.getState().load(createProject());});
  await page.getByLabel("More tools",{exact:true}).click();await page.getByRole("button",{name:"History",exact:true}).click();await page.getByLabel("Name this version").fill("3.0 review");await page.getByRole("button",{name:"Save version",exact:true}).click();await page.getByRole("button",{name:"Compare version",exact:true}).first().click();assert.equal(await page.locator("dialog[open] .preview-card").count(),2);await close();
 });
 await step("phone-sized guided flow can add an image and open previews",async()=>{
  await page.setViewportSize({width:390,height:844});await page.evaluate(async()=>{const {useEditor}=await import("/src/state/store.ts");useEditor.getState().set({mode:"simple",mobileSheet:"left"});});
  await page.getByRole("button",{name:/Logo & photo/}).click();await page.getByRole("button",{name:"Add photo",exact:true}).click();
  await page.getByRole("button",{name:"Preview lab",exact:true}).click();await expect(page.getByTestId("preview-lab")).toBeVisible();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);assert.equal(overflow,false);await close();
 });
 assert.deepEqual(errors,[]);
 await page.setViewportSize({width:1440,height:1000});await page.getByRole("button",{name:"Preview lab",exact:true}).click();
 if(process.env.QA_OUTPUT) { await mkdir(process.env.QA_OUTPUT,{recursive:true});await page.screenshot({path:process.env.QA_OUTPUT+"/Signature-Studio-3-Preview.png",fullPage:true}); }
 console.log(JSON.stringify({passed:reports.length,pageErrors:errors,checks:reports},null,2));
} catch(e) {
 console.error(e);if(process.env.QA_OUTPUT){await mkdir(process.env.QA_OUTPUT,{recursive:true});await page.screenshot({path:process.env.QA_OUTPUT+"/Signature-Studio-3-QA-Failure.png",fullPage:true}).catch(()=>{});}
 process.exitCode=1;
} finally { if(process.env.QA_OUTPUT) await writeFile(process.env.QA_OUTPUT+"/Signature-Studio-3-Browser-Results.json",JSON.stringify({checks:reports,pageErrors:errors,success:!process.exitCode},null,2));await browser.close(); }

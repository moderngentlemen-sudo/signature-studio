import { useMemo, useState } from "react";
import { useEditor } from "../../state/store";
import { Modal, Segmented, Select, TextInput, Toggle } from "../../ui/controls";
import { PreviewFrame } from "../PreviewFrame";
import { applyDesign, LAYOUT_FIXES, previewPerson, proposeLayout, type LayoutFix, type PreviewPerson } from "../studio";
import type { Variant } from "../../model/types";
import { designChecks } from "../assist";
import { FIELD_META } from "../../model/profile";
import { parseContactText } from "../contactImport";

const close = () => useEditor.getState().openDialog(null);
export function LayoutFixDialog() {
  const open = useEditor(s => s.dialog === "layoutFix");
  const project = useEditor(s => s.project);
  const variant = useEditor(s => s.variant);
  const [choice, setChoice] = useState<LayoutFix>("contacts");
  const proposal = useMemo(() => project && open ? proposeLayout(project,choice) : null,[project,choice,open]);
  if (!project || !proposal) return null;
  return <Modal open={open} wide onClose={close} title="Fix layout" subtitle="Compare a structural change before applying it. Font sizes and content are preserved." testId="layout-fix"
    footer={<><button className="btn ghost" onClick={close}>Cancel</button><button className="btn primary" onClick={()=>{applyDesign(proposal);close();useEditor.getState().toast("Layout fix applied","success",{label:"Undo",run:()=>useEditor.getState().undo()});}}>Apply layout fix</button></>}>
    <div className="fix-options" role="group" aria-label="Layout repair">
      {LAYOUT_FIXES.map(f=><button key={f.id} className="fix-option" aria-pressed={choice===f.id} onClick={()=>setChoice(f.id)}><strong>{f.label}</strong><span>{f.detail}</span></button>)}
    </div>
    <div className="preview-grid"><PreviewFrame project={project} title="Before" variant={variant}/><PreviewFrame project={proposal} title="After" variant={variant}/></div>
    <p className="hint">Locked sections stay unchanged. Width badges show the measured result; a proposal may need a second fix for your content. Each applied fix can be undone once.</p>
  </Modal>;
}
export function PreviewLabDialog() {
  const open = useEditor(s => s.dialog === "previewLab");
  const project = useEditor(s => s.project);
  const measured = useEditor(s => s.measuredWidth);
  const [person,setPerson] = useState<PreviewPerson>("current");
  const [variant,setVariant] = useState<Variant>("full");
  const [fallback,setFallback] = useState(true);
  const [narrow,setNarrow] = useState("320");
  const sample = useMemo(()=>project && open ? previewPerson(project,person):null,[project,person,open]);
  const checks = useMemo(()=>project && open ? designChecks(project,measured,variant):[],[project,measured,variant,open]);
  if(!project || !sample) return null;
  return <Modal open={open} wide onClose={close} title="Preview lab" subtitle="Browser simulations for layout diagnostics. Dark background is a contrast check; actual Gmail and Outlook rendering still requires a test email." testId="preview-lab">
    <div className="lab-controls">
      <Select label="Sample content" value={person} onChange={setPerson} options={[{value:"current",label:"My actual details"},{value:"long",label:"Long name and job title"},{value:"missing",label:"Missing optional details"},{value:"international",label:"Multilingual details"}]}/>
      <Select label="Narrow layout target" value={narrow} onChange={setNarrow} options={[{value:"320",label:"320px"},{value:"375",label:"375px"},{value:"480",label:"480px"}]}/>
      <div className="field"><div className="label">Variant</div><Segmented label="Preview lab variant" value={variant} onChange={setVariant} options={[{value:"full",label:"Full"},{value:"reply",label:"Reply"}]}/></div>
    </div>
    <Toggle label="Use recipient fallback fonts" checked={fallback} onChange={setFallback}/>
    <p className="hint">Sample content is temporary and never changes your profile. Narrow previews probe a different target width; they do not claim automatic responsive behavior in every email app.</p>
    <div className="preview-grid">
      <PreviewFrame project={sample} title="Light background" variant={variant} fallbackFonts={fallback}/>
      <PreviewFrame project={sample} title="Dark background diagnostic" variant={variant} dark fallbackFonts={fallback}/>
      <PreviewFrame project={sample} title={narrow+"px layout probe"} variant={variant} width={Number(narrow)} fallbackFonts={fallback}/>
      <PreviewFrame project={sample} title="Images blocked" variant={variant} imagesOff fallbackFonts={fallback}/>
      <PreviewFrame project={sample} title={variant === "full" ? "Reply comparison" : "Full comparison"} variant={variant === "full" ? "reply" : "full"} fallbackFonts={fallback}/>
      <PreviewFrame project={sample} title="Original fonts comparison" variant={variant} fallbackFonts={!fallback}/>
    </div>
    <h3>Checks for your actual design</h3>
    <ul className="readiness">
      {!checks.length && <li>No design warnings detected. Send a test email to verify the installed result.</li>}
      {checks.map((c,i)=><li key={i}><span className="what">{c.message}<small>{c.level === "warning" ? "Needs review" : "Information"}</small></span>{c.nodeId && <button className="btn small" onClick={()=>{close();useEditor.getState().select(c.nodeId!);useEditor.getState().set({mobileSheet:"right"});}}>Select component</button>}</li>)}
    </ul>
    <button className="btn" onClick={()=>useEditor.getState().openDialog("layoutFix")}>Review layout fixes</button>
  </Modal>;
}
export function ContactImportDialog() {
  const open = useEditor(s => s.dialog === "contactImport");
  const project = useEditor(s => s.project);
  const [input,setInput] = useState("");
  const [excluded,setExcluded] = useState<string[]>([]);
  const suggestions=useMemo(()=>parseContactText(input),[input]);
  if(!project) return null;
  return <Modal open={open} onClose={close} title="Import contact details" subtitle="Paste a vCard or contact text. Review detected fields before replacing your current values." testId="contact-import"
    footer={<><button className="btn ghost" onClick={close}>Cancel</button><button className="btn primary" disabled={!suggestions.some(s=>!excluded.includes(s.field))} onClick={()=>{useEditor.getState().edit(d=>{suggestions.filter(s=>!excluded.includes(s.field)).forEach(s=>{d.profile.fields[s.field]=s.value;});});close();useEditor.getState().toast("Contact details imported","success",{label:"Undo",run:()=>useEditor.getState().undo()});}}>Apply selected fields</button></>}>
    <TextInput label="Contact text or vCard" multiline value={input} onChange={v=>{setInput(v.slice(0,20000));setExcluded([]);}} placeholder={"Name: Alex Morgan\nTitle: Creative Director\nEmail: alex@example.com"}/>
    <label className="btn small">Open vCard or text file<input hidden type="file" accept=".vcf,.vcard,.txt" onChange={async e=>{const f=e.target.files?.[0];e.target.value="";if(!f)return;if(f.size>20000){useEditor.getState().toast("Use a contact file under 20KB","error");return;}setInput(await f.text());setExcluded([]);}}/></label>
    <ul className="readiness">{suggestions.map(s=><li key={s.field}><input type="checkbox" aria-label={"Import "+FIELD_META[s.field].label} checked={!excluded.includes(s.field)} onChange={()=>setExcluded(v=>v.includes(s.field)?v.filter(f=>f!==s.field):[...v,s.field])}/><span className="what">{FIELD_META[s.field].label}: {s.value}<small>Current: {project.profile.fields[s.field] || "empty"} · {s.source}</small></span></li>)}</ul>
    {!suggestions.length && <p className="hint">Use labelled lines (Name, Title, Company, Email, Website, Phone) or a vCard. Unlabelled names and phone numbers are left for you to identify.</p>}
  </Modal>;
}

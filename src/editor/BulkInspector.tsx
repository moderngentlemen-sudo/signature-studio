import { useEffect, useState } from "react";
import { findNode, nodeLabel, walk } from "../model/tree";
import { FONTS } from "../model/fonts";
import type { BoxStyle, TextStyle, Visibility } from "../model/types";
import { useEditor } from "../state/store";
import { ColorField, Section, Select } from "../ui/controls";
import { duplicateSelected, groupSelected, nudgeOrder, removeSelected } from "./actions";
import { bulkStyle, equalizeSelection, selectedNodes } from "./studio";

let format: { text?: TextStyle; box?: BoxStyle } | null = null;
export function BulkInspector() {
  const project = useEditor(s => s.project)!;
  const ids = useEditor(s => s.selections);
  const nodes = selectedNodes(project);
  const [, refresh] = useState(0);
  const mixed = <T,>(values: T[]): T | undefined => values.length && values.every(v => v === values[0]) ? values[0] : undefined;
  const textNodes = nodes.filter(n => ["text","field","badge","contact","button","row","stack","column"].includes(n.type));
  const size = mixed(textNodes.map(n => n.text?.size));
  const color = mixed(textNodes.map(n => n.text?.color));
  const font = mixed(textNodes.map(n => n.text?.font));
  const visibility = mixed(nodes.map(n => n.visibility));
  return <div data-testid="bulk-inspector">
    <div className="panel-head"><h2>{ids.length} selected</h2><p>{nodes.length} editable. Shift-click or use the layer checkboxes to add components.</p></div>
    <Section title="Typography">
      <Select label="Font for selection" value={font ?? ""} options={[{value:"",label:"Mixed / inherited"},{value:"$body",label:"Brand body"},{value:"$display",label:"Brand display"},...FONTS.map(f=>({value:f.id,label:f.label}))]} onChange={v=>v && bulkStyle({font:v})}/>
      <BulkNumber label="Text size (px)" ariaLabel="Selection text size" min={8} max={72} value={size} onCommit={v=>bulkStyle({size:v})}/>
      <ColorField label={color ? "Text colour" : "Text colour · mixed / inherited"} value={color} onChange={v=>bulkStyle({color:v})} allowInherit />
      <div className="row"><button className="btn small" onClick={()=>bulkStyle({weight:700})}>Bold</button><button className="btn small" onClick={()=>bulkStyle({weight:400})}>Regular</button></div>
    </Section>
    <Section title="Spacing and visibility">
      <Select label="Shows in" value={visibility ?? ""} options={[{value:"",label:"Mixed"},...(["both","full","reply","hidden"] as Visibility[]).map(value=>({value,label:value === "both" ? "Full and Reply" : value}))]} onChange={value=>{ if(value) useEditor.getState().edit(d=>nodes.forEach(n=>{const target=findNode(d.root,n.id); if(target) target.visibility=value as Visibility;})); }}/>
      {(["padX","padY"] as const).map(key=><BulkNumber key={key} label={key === "padX" ? "Horizontal padding" : "Vertical padding"} ariaLabel={key === "padX" ? "Selection horizontal padding" : "Selection vertical padding"} min={0} max={80} value={mixed(nodes.map(n=>n.box?.[key]))} onCommit={v=>bulkStyle({}, {[key]:v})}/>)}
      <button className="btn small" onClick={equalizeSelection}>Match spacing and column weights</button>
    </Section>
    <Section title="Format and selection">
      <div className="button-wrap">
        <button className="btn small" onClick={()=>{ const n=nodes.find(n=>n.id===useEditor.getState().selection) ?? nodes[0]; if(n) {format=structuredClone({text:n.text,box:n.box});refresh(v=>v+1);} }}>Copy primary format</button>
        <button className="btn small" disabled={!format} onClick={()=>{ if(format) bulkStyle(format.text ?? {},format.box); }}>Apply copied format</button>
        <button className="btn small" onClick={()=>{const types=new Set(nodes.map(n=>n.type)); const similar:string[]=[]; walk(project.root,({node})=>{if(types.has(node.type) && node.id!==project.root.id) similar.push(node.id);}); useEditor.getState().selectMany(similar);}}>Select similar types</button>
      </div>
      <p className="hint">Primary component: {nodes.find(n=>n.id===useEditor.getState().selection) ? nodeLabel(nodes.find(n=>n.id===useEditor.getState().selection)!) : "locked"}. Copied format changes styling only.</p>
    </Section>
    <Section title="Arrange">
      <div className="button-wrap">
        <button className="btn small" onClick={()=>nudgeOrder(-1)}>Move up</button><button className="btn small" onClick={()=>nudgeOrder(1)}>Move down</button>
        <button className="btn small" onClick={groupSelected}>Group adjacent</button>
        <button className="btn small" onClick={duplicateSelected}>Duplicate selection</button>
        <button className="btn small danger" onClick={removeSelected}>Delete selection</button>
      </div>
    </Section>
  </div>;
}

function BulkNumber({label,ariaLabel,value,min,max,onCommit}:{label:string;ariaLabel:string;value:number|undefined;min:number;max:number;onCommit:(v:number)=>void}) {
 const [draft,setDraft]=useState(value === undefined ? "" : String(value));
 useEffect(()=>setDraft(value === undefined ? "" : String(value)),[value]);
 return <label className="field">{label}<input className="input" aria-label={ariaLabel} type="number" min={min} max={max} value={draft} placeholder="Mixed / inherited" onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur();}} onBlur={()=>{const number=Number(draft);if(draft && Number.isFinite(number)) onCommit(Math.max(min,Math.min(max,number)));else setDraft(value === undefined ? "" : String(value));}}/></label>;
}

/**
 * Design assistance: Auto-Fit, compact Reply preset and design checks.
 */
import { walk, isContainer, visibleIn } from "../model/tree";
import { fontDef } from "../model/fonts";
import { resolveColor, resolveFont, renderSignature } from "../render/email";
import type { Project, SigNode, StackNode, TextStyle, Variant } from "../model/types";
import { useEditor } from "../state/store";

/** Smallest legible size (px) Auto-Fit will allow. */
export const MIN_READABLE = 10;

function smallestFont(project: Project): number {
  let min = project.theme.size;
  walk(project.root, ({ node }) => {
    if (node.text?.size) min = Math.min(min, node.text.size);
  });
  return min;
}

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

/**
 * Scale the whole signature so its rendered width fits the target width,
 * never letting the smallest text drop below MIN_READABLE px.
 */
export async function autoFit(): Promise<{ ok: boolean; message: string }> {
  const st = useEditor.getState();
  const project = st.project;
  if (!project) return { ok: false, message: "" };
  const target = project.theme.width;
  const floor = MIN_READABLE / smallestFont(project);
  st.beginGesture();
  let scale = project.theme.scale;
  for (let i = 0; i < 4; i++) {
    const measured = useEditor.getState().measuredWidth;
    if (!measured) break;
    const natural = measured / scale;
    let next = Math.min(1, target / natural);
    next = Math.floor(next * 100) / 100;
    if (next < floor) next = Math.ceil(floor * 100) / 100;
    if (Math.abs(next - scale) < 0.005) break;
    scale = next;
    useEditor.getState().editLive((d) => void (d.theme.scale = next));
    await nextFrame();
  }
  useEditor.getState().endGesture();
  const measured = useEditor.getState().measuredWidth;
  if (measured > target + 1) {
    return {
      ok: false,
      message: `Scaled to ${Math.round(scale * 100)}%, the smallest size that keeps text readable. It is still ${Math.round(measured - target)}px wider than the target. Try stacking columns or removing a contact item.`,
    };
  }
  return { ok: true, message: scale < 1 ? `Scaled to ${Math.round(scale * 100)}% to fit ${target}px.` : `Fits ${target}px at full size.` };
}

/**
 * Compact Reply preset: marks secondary components as Full-only. Every change
 * is an explicit, visible visibility setting (and one undo step).
 */
export function applyCompactReply(): number {
  let changed = 0;
  useEditor.getState().edit((d) => {
    walk(d.root as StackNode, ({ node }) => {
      if (node.visibility !== "both") return;
      const secondary =
        (node.type === "image" && (node.props.role === "banner" || node.props.role === "partner" || node.props.role === "artwork")) ||
        node.type === "social" ||
        node.type === "qr" ||
        node.type === "button" ||
        (node.type === "text" && (node.name === "Disclaimer" || (node.box?.background && node.props.text.length > 20))) ||
        (node.type === "field" && ["tagline", "intro", "address", "department", "booking"].includes(node.props.field));
      if (secondary) {
        node.visibility = "full";
        changed++;
      }
    });
  });
  return changed;
}


import { assetMeta } from "../model/builtins";
import { cropRect, frameSize } from "../model/crop";
import { fieldValue } from "../model/profile";
import { safeHref } from "../lib/url";
// --- Design checks ---------------------------------------------------------------
export interface Check {
  level: "warning" | "info";
  nodeId?: string;
  message: string;
}
function luminance(hex: string): number {
  const expanded = /^#[0-9a-f]{3}$/i.test(hex) ? "#"+hex.slice(1).split("").map(c=>c+c).join("") : hex;
  const m = /^#?([0-9a-f]{6})$/i.exec(expanded);
  if (!m) return 1;
  const n = parseInt(m[1],16);
  const c = [(n>>16)&255,(n>>8)&255,n&255].map(v=>{const s=v/255;return s<=0.04045?s/12.92:((s+0.055)/1.055)**2.4;});
  return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2];
}
export function contrast(a:string,b:string):number {
  const [l1,l2]=[luminance(a),luminance(b)].sort((x,y)=>y-x);
  return (l1+0.05)/(l2+0.05);
}
export function designChecks(project: Project, measuredWidth:number, variant: Variant = "full"): Check[] {
  const checks:Check[]=[];
  const theme=project.theme;
  const bg=theme.background && theme.background!=="transparent"?resolveColor(theme,theme.background):"#ffffff";
  if(measuredWidth>theme.width+1) checks.push({level:"warning",message:`The signature is ${Math.round(measuredWidth)}px wide, beyond the ${theme.width}px target. Review layout fixes.`});
  const fonts=new Set<string>();
  const warn=(node:SigNode,message:string)=>checks.push({level:"warning",nodeId:node.id,message});
  const link=(node:SigNode,href:string|undefined,required=false)=>{
    if(href?.trim() && !safeHref(href)) warn(node,"This link target is unsafe or invalid and will not be clickable.");
    else if(required && !href?.trim()) warn(node,"This button has no link target. Set a URL or connected profile field.");
  };
  const visit=(node:SigNode,parent:TextStyle,background:string)=>{
    if(!visibleIn(node.visibility,variant)) return;
    const style={...parent};
    for(const [key,value] of Object.entries(node.text??{})) if(value!==undefined) (style as Record<string,unknown>)[key]=value;
    const local=node.box?.background && node.box.background!=="transparent"?resolveColor(theme,node.box.background):background;
    const size=(style.size??theme.size)*theme.scale;
    const weight=style.weight??400;
    const textlike=["field","text","badge","contact","button"].includes(node.type) || (node.type==="social" && node.props.style==="text");
    const meaningful=node.type==="field" ? !!(node.props.detached ? node.props.text : fieldValue(project.profile,node.props.field)) :
      node.type==="text" || node.type==="badge" ? !!node.props.text.trim() : true;
    if(textlike && meaningful) {
      fonts.add(resolveFont(theme,style.font));
      if(size<MIN_READABLE) warn(node,`Text is ${size.toFixed(1)}px after scaling. Increase it to at least ${MIN_READABLE}px.`);
      let fg=resolveColor(theme,style.color??"$ink");
      let surface=local;
      if(node.type==="button") { fg=resolveColor(theme,node.props.variant==="solid"?node.props.textColor:node.props.color); if(node.props.variant==="solid") surface=resolveColor(theme,node.props.color); }
      const ratio=contrast(fg,surface);
      const threshold=size>=24 || (size>=18.66 && weight>=700) ? 3 : 4.5;
      if(ratio<threshold) warn(node,`Text contrast is ${ratio.toFixed(2)}:1; aim for ${threshold}:1 at this size. Inherited colours and background are included.`);
      if(node.type==="contact" && node.props.labels!=="none") {
        const ratio=contrast(resolveColor(theme,node.props.labelColor??"$accent"),local);
        if(ratio<threshold) warn(node,`Contact label contrast is ${ratio.toFixed(2)}:1; choose a darker or lighter label colour.`);
      }
    }
    if(node.type==="text" || node.type==="badge" || node.type==="image") link(node,node.props.href);
    if(node.type==="button") link(node,node.props.href || (node.props.field ? fieldValue(project.profile,node.props.field):""),true);
    if(node.type==="image" && node.props.assetId) {
      const meta=assetMeta(project,node.props.assetId);
      if(!meta) warn(node,"Image source metadata is missing. Replace or re-import the image.");
      if(!node.props.alt.trim()) warn(node,node.props.href?"A linked image needs alternative text that explains its destination.":"An image is missing alternative text.");
      if(meta && meta.mime!=="image/svg+xml") {
        const frame=frameSize(node.props.width,node.props.aspect,meta.width,meta.height);
        const crop=cropRect(meta.width,meta.height,frame.aspect,node.props.crop);
        if(crop.sw<frame.w*theme.scale*2 || crop.sh<frame.h*theme.scale*2) checks.push({level:"info",nodeId:node.id,message:"This crop has fewer than 2 source pixels per display pixel. It may appear soft on high-resolution screens."});
      }
    }
    if(node.type==="qr" && !node.props.alt.trim()) warn(node,"The QR code needs alternative text describing its destination.");
    if(node.type==="social") project.profile.socials.filter(s=>s.visible && !node.props.hidden.includes(s.id)).forEach(s=>link(node,s.url));
    if(isContainer(node)) node.children.forEach(child=>visit(child,style,local));
  };
  visit(project.root,{size:theme.size,color:"$ink",font:"$body",weight:400},bg);
  for(const f of fonts) { const def=fontDef(f); if(!def.safe) checks.push({level:"info",message:`${def.label} is a web font. Most recipients will see ${def.seenAs}.`}); }
  const html=renderSignature(project,{variant,mode:"email",resolveImage:req=>({src:project.published[req.key]?.url??"https://assets.example.com/diagnostic.png"})}).html;
  const bytes=new TextEncoder().encode(html).length;
  if(bytes>90*1024) checks.push({level:"warning",message:`Signature HTML is approximately ${Math.round(bytes/1024)}KB. Reduce blocks or styling to leave room for the rest of the email.`});
  return checks;
}

import type { ProfileKey } from "../model/types";
export interface ContactSuggestion { field: ProfileKey; value: string; source: string; }
const labels: Record<string, ProfileKey> = { name:"fullName", fullname:"fullName", title:"title", role:"title", company:"company", organization:"company", department:"department", phone:"phone", tel:"phone", mobile:"mobile", email:"email", website:"website", url:"website", address:"address", booking:"booking", pronouns:"pronouns", tagline:"tagline" };
/** Local, conservative parsing. Suggestions are never applied without review. */
export function parseContactText(raw: string): ContactSuggestion[] {
  const suggestions = new Map<ProfileKey,ContactSuggestion>();
  const vcard = /^BEGIN:VCARD/im.test(raw);
  const unfolded = raw.replace(/\r?\n[ \t]/g,"");
  const decode = (v:string) => v.replace(/\\n/gi," ").replace(/\\([,;\\])/g,"$1").trim();
  for(const line of unfolded.split(/\r?\n/).slice(0,200)) {
    const match = /^([^:]{1,80}):\s*(.{1,500})$/.exec(line);
    if (!match) continue;
    const key = match[1].toLowerCase();
    let field: ProfileKey | undefined;
    let value = decode(match[2]);
    if(vcard) {
      const base = key.split(";")[0].replace(/^item\d+\./,"");
      if (base === "fn") field="fullName";
      if (base === "title") field="title";
      if (base === "org") {field="company";value=value.split(";").filter(Boolean).join(" · ");}
      if (base === "email") field="email";
      if (base === "url") field="website";
      if (base === "tel") field=/cell|mobile/.test(key)?"mobile":"phone";
      if (base === "adr") {field="address";value=value.split(";").filter(Boolean).join(", ");}
    } else { const label=key.replace(/[ _-]/g,""); if (Object.hasOwn(labels,label)) field=labels[label]; }
    if(field && value && !suggestions.has(field)) suggestions.set(field,{field,value,source:match[1]});
  }
  if (!vcard) {
    const email = raw.match(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+/i)?.[0];
    const website = raw.match(/https?:\/\/[^\s<>"]+/i)?.[0];
    if(email && !suggestions.has("email")) suggestions.set("email",{field:"email",value:email,source:"Detected email"});
    if(website && !suggestions.has("website")) suggestions.set("website",{field:"website",value:website,source:"Detected website"});
  }
  return [...suggestions.values()];
}

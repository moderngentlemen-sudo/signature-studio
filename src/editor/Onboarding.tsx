import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { TEMPLATE_MAP, type Template } from "../templates/templates";
import { TemplateGrid } from "./panels/TemplatesPanel";
import { newProject } from "../state/projects";
import { updatePrefs } from "../state/prefs";
import { emptyFields, SAMPLE_PROFILE } from "../model/profile";
import { createProject, SAMPLE_SOCIALS } from "../templates/starter";
import { useEditor } from "../state/store";
import type { ProfileFields } from "../model/types";

/**
 * First run: a few details and a layout, then straight into the editor.
 * Template previews use whatever the user has typed so far.
 */
export function Onboarding({ onDone }: { onDone: () => void }) {
  const [fields, setFields] = useState<ProfileFields>(emptyFields());
  const [picked, setPicked] = useState<Template | null>(TEMPLATE_MAP["exec-boardroom"]);
  const hasDetails = !!fields.fullName.trim();

  // Feed typed details into the previews (via a lightweight draft project).
  const draft = useMemo(() => {
    const p = createProject({ sample: !hasDetails, fields: hasDetails ? fields : undefined });
    return p;
  }, [fields, hasDetails]);

  const start = async (sample: boolean) => {
    await newProject({
      templateId: picked?.id ?? "exec-boardroom",
      name: sample ? "Sample signature" : `${fields.fullName.trim() || "My"} signature`,
      fields: sample ? SAMPLE_PROFILE : fields,
      socials: sample ? SAMPLE_SOCIALS() : [],
    });
    updatePrefs({ onboarded: true });
    useEditor.getState().set({ mode: "simple" });
    onDone();
    setTimeout(() => window.dispatchEvent(new Event("ss:fit")), 50);
  };

  const set = (k: keyof ProfileFields, v: string) => setFields((f) => ({ ...f, [k]: v }));

  return (
    <div className="onboarding" role="dialog" aria-modal="true" aria-labelledby="ob-title">
      <div className="onboarding-inner">
        <span className="chip brass">Signature Studio</span>
        <h1 id="ob-title">A signature worth sending.</h1>
        <p className="lede">Add your details, choose a layout, and install it in Gmail with images that actually show up. It takes about three minutes.</p>
        <div className="grid3" style={{ marginBottom: 22, maxWidth: 760 }}>
          <input
            className="input"
            placeholder="Your name"
            aria-label="Your name"
            value={fields.fullName}
            onChange={(e) => set("fullName", e.target.value)}
            data-testid="ob-name"
          />
          <input className="input" placeholder="Job title" aria-label="Job title" value={fields.title} onChange={(e) => set("title", e.target.value)} />
          <input className="input" placeholder="Company" aria-label="Company" value={fields.company} onChange={(e) => set("company", e.target.value)} />
          <input className="input" placeholder="Email" type="email" aria-label="Email" value={fields.email} onChange={(e) => set("email", e.target.value)} />
          <input className="input" placeholder="Phone" type="tel" aria-label="Phone" value={fields.phone} onChange={(e) => set("phone", e.target.value)} />
          <input className="input" placeholder="Website" aria-label="Website" value={fields.website} onChange={(e) => set("website", e.target.value)} />
        </div>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap" }}>
          <strong style={{ fontSize: 15 }}>Choose a starting layout</strong>
          <span className="muted">You can switch any time without losing your work.</span>
        </div>
        <TemplateGrid compact previewProfile={draft.profile} pickedId={picked?.id} onPick={setPicked} />
        <div
          className="row"
          style={{
            position: "sticky",
            bottom: 0,
            padding: "16px 0",
            background: "linear-gradient(transparent, var(--paper) 30%)",
            justifyContent: "flex-end",
            flexWrap: "wrap",
          }}
        >
          <button className="btn ghost" onClick={() => start(true)} data-testid="ob-sample">
            Explore with sample details
          </button>
          <button className="btn primary" style={{ height: 40, padding: "0 18px" }} onClick={() => start(false)} data-testid="ob-start">
            Start with {picked?.name ?? "this layout"} <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

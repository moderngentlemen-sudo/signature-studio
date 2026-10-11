import { useMemo, useState } from "react";
import { ArrowRight, Check, LayoutTemplate, Loader2, Monitor, ShieldCheck, Sparkles } from "lucide-react";
import { TEMPLATE_MAP, type Template } from "../templates/templates";
import { TemplateGrid } from "./panels/TemplatesPanel";
import { TemplateThumb } from "./TemplateThumb";
import { StudioMark } from "./Shell";
import { newProject } from "../state/projects";
import { updatePrefs } from "../state/prefs";
import { emptyFields, SAMPLE_PROFILE } from "../model/profile";
import { createProject, SAMPLE_SOCIALS } from "../templates/starter";
import { useEditor } from "../state/store";
import type { ProfileFields } from "../model/types";

const DETAILS: { key: keyof ProfileFields; label: string; placeholder: string; type?: string; autoComplete: string }[] = [
  { key: "fullName", label: "Your name", placeholder: "Alex Morgan", autoComplete: "name" },
  { key: "title", label: "Job title", placeholder: "Creative director", autoComplete: "organization-title" },
  { key: "company", label: "Company", placeholder: "Your company or studio", autoComplete: "organization" },
  { key: "email", label: "Email", placeholder: "alex@example.com", type: "email", autoComplete: "email" },
  { key: "phone", label: "Phone", placeholder: "+1 555 012 3456", type: "tel", autoComplete: "tel" },
  { key: "website", label: "Website", placeholder: "yourwebsite.com", autoComplete: "url" },
];

/** A welcoming first run with real, live template previews and visible field labels. */
export function Onboarding({ onDone }: { onDone: () => void }) {
  const [fields, setFields] = useState<ProfileFields>(emptyFields());
  const [picked, setPicked] = useState<Template | null>(TEMPLATE_MAP["exec-boardroom"]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const hasDetails = !!fields.fullName.trim();
  const draft = useMemo(() => createProject({ sample: !hasDetails, fields: hasDetails ? fields : undefined }), [fields, hasDetails]);

  const start = async (sample: boolean) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await newProject({
        templateId: picked?.id ?? "exec-boardroom",
        name: sample ? "Sample signature" : `${fields.fullName.trim() || "My"} signature`,
        fields: sample ? SAMPLE_PROFILE : fields,
        socials: sample ? SAMPLE_SOCIALS() : [],
      });
      updatePrefs({ onboarded: true, mode: "simple" });
      useEditor.getState().set({ mode: "simple" });
      onDone();
      setTimeout(() => window.dispatchEvent(new Event("ss:fit")), 50);
    } catch {
      setError("We couldn’t save your signature. Please allow site storage and try again.");
      setBusy(false);
    }
  };

  return (
    <main className="onboarding" aria-labelledby="ob-title">
      <div className="onboarding-inner">
        <header className="welcome-nav">
          <div className="brand">
            <StudioMark />
            <span className="brand-wordmark">
              Signature <strong>Studio</strong>
              <span className="version-label">3.0</span>
            </span>
          </div>
          <span className="welcome-nav-note">
            <ShieldCheck size={15} />
            Your workspace. Your signature.
          </span>
        </header>
        <section className="welcome-hero">
          <div className="welcome-copy">
            <span className="eyebrow">
              <Sparkles size={14} />A thoughtful finishing touch
            </span>
            <h1 id="ob-title">
              A small detail.
              <br />
              <em>A lasting impression.</em>
            </h1>
            <p className="lede">
              Create a signature that feels like you. Start with a considered layout, add your details, and make every sign-off your own.
            </p>
            <div className="welcome-benefits">
              <span>
                <LayoutTemplate size={16} />
                Beautiful starting layouts
              </span>
              <span>
                <Monitor size={16} />
                Live previews as you edit
              </span>
              <span>
                <Check size={16} />
                Guided Gmail installation
              </span>
            </div>
            <a className="welcome-anchor" href="#welcome-details">
              Let’s make it yours <ArrowRight size={17} />
            </a>
          </div>
          <div className="welcome-preview">
            <div className="email-window-head">
              <span className="window-dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <span>A better sign-off starts here</span>
              <span className="preview-live">
                <span className="live-dot" />
                Live
              </span>
            </div>
            <div className="email-window-body">
              <p className="email-greeting">Hi there,</p>
              <div className="email-lines" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <p className="email-signoff">Warm regards,</p>
              <TemplateThumb template={picked ?? TEMPLATE_MAP["exec-boardroom"]} profile={draft.profile} scale={0.68} />
            </div>
            <div className="email-window-foot">
              <span>{picked?.name} layout</span>
              <span>{hasDetails ? "Your details, in real time" : "Sample details · yours come next"}</span>
            </div>
          </div>
        </section>
        <section className="welcome-details" id="welcome-details" aria-labelledby="details-title">
          <div className="welcome-section-head">
            <span className="step-badge">01</span>
            <div>
              <h2 id="details-title">Start with your details</h2>
              <p>Add what you’d like to share. You can change everything in the editor.</p>
            </div>
            <span className="chip">All fields optional</span>
          </div>
          <div className="welcome-fields">
            {DETAILS.map((f) => (
              <label className="field" key={f.key}>
                <span className="label">{f.label}</span>
                <input
                  className="input"
                  type={f.type ?? "text"}
                  autoComplete={f.autoComplete}
                  placeholder={f.placeholder}
                  value={fields[f.key]}
                  onChange={(e) => setFields((current) => ({ ...current, [f.key]: e.target.value }))}
                  data-testid={f.key === "fullName" ? "ob-name" : undefined}
                />
              </label>
            ))}
          </div>
        </section>
        <section className="welcome-layouts" aria-labelledby="layouts-title">
          <div className="welcome-section-head">
            <span className="step-badge">02</span>
            <div>
              <h2 id="layouts-title">Find your starting point</h2>
              <p>Choose a layout that fits your style. Make it your own in the editor.</p>
            </div>
          </div>
          <TemplateGrid compact previewProfile={draft.profile} pickedId={picked?.id} onPick={setPicked} />
        </section>
        <footer className="welcome-footer">
          <p>
            <ShieldCheck size={16} />
            Your work is saved in this browser. Export a copy to keep a backup.
          </p>
          <div className="welcome-actions">
            <button className="btn ghost" disabled={busy} onClick={() => start(true)} data-testid="ob-sample">
              Explore with sample details
            </button>
            <button className="btn primary" disabled={busy} onClick={() => start(false)} data-testid="ob-start">
              {busy ? <Loader2 className="spin" size={17} /> : <ArrowRight size={17} />} Start with {picked?.name ?? "this layout"}
            </button>
          </div>
          {error && (
            <p className="welcome-error" role="alert">
              {error}
            </p>
          )}
        </footer>
      </div>
    </main>
  );
}

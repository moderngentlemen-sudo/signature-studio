import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, CheckCircle2, Copy, ExternalLink, Loader2, RefreshCw, Settings, ShieldCheck, XCircle } from "lucide-react";
import { useEditor } from "../../state/store";
import { Modal, Toggle } from "../../ui/controls";
import { emailHtml, imageRequests, prepareVariant, usePublish, type ImageState } from "../../publish/prepare";
import { copyRich } from "../../lib/clipboard";
import { htmlToPlainText } from "../../render/validate";
import { updatePrefs, usePrefs } from "../../state/prefs";
import type { Variant } from "../../model/types";

const STEPS = ["Check", "Full", "Reply", "Defaults", "Verify"] as const;

const STATE_LABEL: Record<ImageState, string> = {
  pending: "Waiting",
  preparing: "Preparing",
  ready: "Ready",
  attention: "Needs attention",
  failed: "Could not prepare",
};

export function InstallDialog() {
  const open = useEditor((s) => s.dialog === "install");
  const close = () => useEditor.getState().openDialog(null);
  const [step, setStep] = useState(0);
  const [same, setSame] = useState(false);
  useEffect(() => {
    if (open) setStep(0);
  }, [open]);
  const steps = same ? (["Check", "Full", "Defaults", "Verify"] as const) : STEPS;
  const current = steps[Math.min(step, steps.length - 1)];

  return (
    <Modal
      open={open}
      onClose={close}
      wide
      testId="install-dialog"
      title="Install in Gmail"
      subtitle="Prepare your images, copy each signature, and set Gmail's defaults."
      footer={
        <>
          {step > 0 && (
            <button className="btn ghost" onClick={() => setStep(step - 1)}>
              Back
            </button>
          )}
          <span className="spacer" />
          {step < steps.length - 1 ? (
            <button className="btn primary" onClick={() => setStep(step + 1)} data-testid="install-next">
              Continue
            </button>
          ) : (
            <button className="btn primary" onClick={close}>
              Done
            </button>
          )}
        </>
      }
    >
      <nav className="steps" aria-label="Installation steps">
        {steps.map((s, i) => (
          <button key={s} aria-current={i === step ? "step" : undefined} className={i < step ? "done" : ""} onClick={() => setStep(i)}>
            {i + 1}. {s === "Full" ? "Copy Full" : s === "Reply" ? "Copy Reply" : s}
          </button>
        ))}
      </nav>
      {current === "Check" && <CheckStep same={same} setSame={setSame} />}
      {current === "Full" && <CopyStep variant="full" same={same} />}
      {current === "Reply" && <CopyStep variant="reply" same={false} />}
      {current === "Defaults" && <DefaultsStep same={same} />}
      {current === "Verify" && <VerifyStep />}
    </Modal>
  );
}

// ---------------------------------------------------------------------------

function useReadiness(variant: Variant) {
  const project = useEditor((s) => s.project!);
  const statuses = usePublish((s) => s.statuses);
  const result = useMemo(() => emailHtml(project, variant), [project, variant]);
  const requests = useMemo(() => imageRequests(project, variant), [project, variant]);
  return { result, requests, statuses };
}

function CheckStep({ same, setSame }: { same: boolean; setSame: (v: boolean) => void }) {
  const consent = usePrefs((s) => s.publishConsent);
  const host = usePrefs((s) => s.host);
  const running = usePublish((s) => s.running);
  const openDialog = useEditor((s) => s.openDialog);
  const full = useReadiness("full");
  const reply = useReadiness("reply");
  const needsImages = full.requests.length + reply.requests.length > 0;

  const prepareAll = async (force = false) => {
    await prepareVariant("full", host, { force });
    if (!same) await prepareVariant("reply", host, { force });
  };

  useEffect(() => {
    if (consent && needsImages && !running) void prepareAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consent]);

  return (
    <div>
      <Toggle
        label="Use the same signature for new emails and replies"
        checked={same}
        onChange={setSame}
        hint="Skip the Reply variant and install only the Full signature."
      />
      {needsImages && !consent ? (
        <div className="callout brass" style={{ marginBottom: 14 }}>
          <ShieldCheck size={18} />
          <div style={{ display: "grid", gap: 8 }}>
            <div>
              <strong>Your signature images will be published.</strong> Recipients' email apps download images from the web, so the images in your signature are
              copied to a permanent public link. Only the email-ready versions are published, at random addresses with no personal details in them. Your
              originals stay private in this browser.
            </div>
            <div>
              <button className="btn primary small" onClick={() => updatePrefs({ publishConsent: true })} data-testid="consent">
                I understand, prepare my images
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <VariantReadiness title="Full signature" variant="full" r={full} />
      {!same && <VariantReadiness title="Reply signature" variant="reply" r={reply} />}
      {needsImages && consent && (
        <div className="row" style={{ marginTop: 4 }}>
          <button className="btn small" disabled={!!running} onClick={() => prepareAll(true)}>
            <RefreshCw size={13} /> {running ? "Preparing…" : "Retry all"}
          </button>
          <button className="btn small ghost" onClick={() => openDialog("settings")}>
            <Settings size={13} /> Image hosting settings
          </button>
        </div>
      )}
    </div>
  );
}

function VariantReadiness({ title, variant, r }: { title: string; variant: Variant; r: ReturnType<typeof useReadiness> }) {
  const select = useEditor((s) => s.select);
  const set = useEditor((s) => s.set);
  const errors = r.result.problems.filter((p) => p.level === "error" && !/not published yet/.test(p.message));
  const warnings = r.result.problems.filter((p) => p.level === "warning");
  return (
    <section style={{ marginBottom: 16 }} data-testid={`readiness-${variant}`}>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
        <strong>{title}</strong>
        {r.result.ready ? (
          <span className="chip ok">
            <Check size={12} /> Ready to copy
          </span>
        ) : (
          <span className="chip warn">Not ready</span>
        )}
      </div>
      <ul className="readiness">
        {r.requests.length === 0 && (
          <li>
            <CheckCircle2 size={16} color="var(--ok)" />
            <span className="what">
              No images to prepare
              <small>Text-only signatures paste directly.</small>
            </span>
          </li>
        )}
        {r.requests.map((req) => {
          const st = r.statuses[req.key];
          const published = useEditor.getState().project!.published[req.key];
          const state: ImageState = published && (!st || st.state === "ready") ? "ready" : (st?.state ?? "pending");
          return (
            <li key={req.key}>
              {state === "ready" ? (
                <CheckCircle2 size={16} color="var(--ok)" />
              ) : state === "preparing" ? (
                <Loader2 size={16} className="spin" />
              ) : state === "failed" ? (
                <XCircle size={16} color="var(--err)" />
              ) : state === "attention" ? (
                <AlertTriangle size={16} color="var(--warn)" />
              ) : (
                <span style={{ width: 16, height: 16, borderRadius: 8, border: "1.5px solid var(--line-strong)" }} />
              )}
              <span className="what">
                {req.label}
                <small>{st?.message ?? STATE_LABEL[state]}</small>
              </span>
              {(state === "failed" || state === "attention") && (
                <button
                  className="btn small"
                  onClick={() => {
                    set({ dialog: null, variant });
                    select(req.nodeId);
                  }}
                >
                  Show
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {errors.map((e) => (
        <div className="callout err" key={e.message} style={{ marginBottom: 6 }}>
          <XCircle size={15} /> {e.message}
        </div>
      ))}
      {warnings.slice(0, 3).map((w) => (
        <div className="callout warn" key={w.message} style={{ marginBottom: 6 }}>
          <AlertTriangle size={15} /> {w.message}
        </div>
      ))}
    </section>
  );
}

function CopyStep({ variant, same }: { variant: Variant; same: boolean }) {
  const project = useEditor((s) => s.project!);
  const toast = useEditor((s) => s.toast);
  const [copied, setCopied] = useState(false);
  const { html, ready, problems } = useMemo(() => emailHtml(project, variant), [project, variant]);
  const name = variant === "full" ? "Full" : "Reply";

  const copy = async () => {
    try {
      await copyRich(html, htmlToPlainText(html));
      setCopied(true);
      toast(`${name} signature copied`, "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Copy failed", "error");
    }
  };

  return (
    <div className="image-editor" style={{ gridTemplateColumns: "1.1fr 1fr" }}>
      <div className="copy-card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <strong>{name} signature</strong>
          {ready ? <span className="chip ok">Ready</span> : <span className="chip warn">Not ready</span>}
        </div>
        <div className="preview" dangerouslySetInnerHTML={{ __html: html }} />
        <button className="btn brass" disabled={!ready} onClick={copy} data-testid={`copy-${variant}`}>
          {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Copied. Now paste it into Gmail" : `Copy ${name} signature`}
        </button>
        {!ready && <div className="hint">{problems.find((p) => p.level === "error")?.message ?? "Go back to Check to prepare images."}</div>}
      </div>
      <ol className="instructions">
        <li>
          <div>
            Open{" "}
            <a href="https://mail.google.com/mail/u/0/#settings/general" target="_blank" rel="noreferrer">
              Gmail settings <ExternalLink size={11} />
            </a>{" "}
            → <strong>See all settings</strong> → <strong>General</strong>.
          </div>
        </li>
        <li>
          <div>
            Scroll to <strong>Signature</strong> and click <strong>+ Create new</strong>. Name it{" "}
            <em>
              “{project.name} · {name}”
            </em>
            .
          </div>
        </li>
        <li>
          <div>
            Click into the empty signature box and paste (<span className="kbd">⌘</span> <span className="kbd">V</span> or <span className="kbd">Ctrl</span>{" "}
            <span className="kbd">V</span>).
          </div>
        </li>
        <li>
          <div>
            {same || variant === "reply" ? (
              <>
                Continue to <strong>Defaults</strong>. Don't save yet; you'll set defaults on the same page.
              </>
            ) : (
              <>Repeat for the Reply signature on the next step. Gmail keeps both on the same settings page.</>
            )}
          </div>
        </li>
      </ol>
    </div>
  );
}

function DefaultsStep({ same }: { same: boolean }) {
  const name = useEditor((s) => s.project!.name);
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="callout">
        Gmail chooses which signature to insert using two settings below your signatures, called <strong>Signature defaults</strong>. Signature Studio creates
        two separate signatures from your one design, and Gmail inserts the right one automatically.
      </div>
      <ol className="instructions">
        <li>
          <div>
            Under <strong>Signature defaults</strong>, choose your sending address if you have more than one (<em>send mail as</em> addresses each have their
            own defaults).
          </div>
        </li>
        <li>
          <div>
            Set <strong>For new emails use</strong> → <em>“{name} · Full”</em>.
          </div>
        </li>
        <li>
          <div>
            Set <strong>On reply/forward use</strong> →{" "}
            <em>
              “{name} · {same ? "Full" : "Reply"}”
            </em>
            .
          </div>
        </li>
        <li>
          <div>
            Optional: tick <em>Insert signature before quoted text in replies</em> to keep replies tidy.
          </div>
        </li>
        <li>
          <div>
            Scroll to the bottom and click <strong>Save Changes</strong>.
          </div>
        </li>
      </ol>
      <div className="callout warn">
        <AlertTriangle size={15} />
        <span>Installed signatures don't update automatically. When you change your design here, copy and paste it into Gmail again.</span>
      </div>
    </div>
  );
}

function VerifyStep() {
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const items = [
    ["compose", "Open a new email: your Full signature appears."],
    ["reply", "Reply to an email: your Reply signature appears."],
    ["send", "Send a test email to yourself or a colleague."],
    ["images", "In the received email, the logo and icons display."],
    ["links", "Tapping the phone, email and website links works."],
  ];
  return (
    <div>
      <p className="muted" style={{ marginTop: 0 }}>
        A quick real-world check confirms everything arrived as designed. Previews are approximate; a received email is the real test.
      </p>
      <ul className="readiness">
        {items.map(([k, label]) => (
          <li key={k}>
            <input
              type="checkbox"
              id={`v-${k}`}
              checked={!!checks[k]}
              onChange={(e) => setChecks({ ...checks, [k]: e.target.checked })}
              style={{ accentColor: "var(--ok)" }}
            />
            <label className="what" htmlFor={`v-${k}`}>
              {label}
            </label>
          </li>
        ))}
      </ul>
      {Object.values(checks).filter(Boolean).length === items.length ? (
        <div className="callout ok">
          <CheckCircle2 size={16} /> Your signature is installed and working.
        </div>
      ) : (
        <details>
          <summary style={{ cursor: "pointer", fontWeight: 500 }}>Something isn't right?</summary>
          <ul className="muted" style={{ paddingLeft: 18 }}>
            <li>
              <strong>Images missing:</strong> some email apps hide images until the recipient allows them. In Gmail, images from verified public links display
              by default.
            </li>
            <li>
              <strong>Formatting lost:</strong> make sure you pasted into the signature box in Settings, not into a plain-text field, and that Gmail isn't in
              Plain text mode.
            </li>
            <li>
              <strong>Wrong signature on replies:</strong> re-check Signature defaults for the address you're sending from.
            </li>
            <li>
              <strong>Gmail says the signature is too long:</strong> Gmail allows 10,000 characters. Remove a component or two and copy again.
            </li>
          </ul>
        </details>
      )}
    </div>
  );
}

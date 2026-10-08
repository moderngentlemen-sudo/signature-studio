import { useRef } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Plus, Trash2, Upload } from "lucide-react";
import { useEditor } from "../../state/store";
import { FIELD_META, PROFILE_FIELDS, formatPhone } from "../../model/profile";
import { PLATFORMS, PLATFORM_MAP, detectPlatform } from "../../model/social";
import { ICON_PATHS } from "../../model/iconPaths";
import type { ProfileKey, SocialPlatform } from "../../model/types";
import { TextInput } from "../../ui/controls";
import { uid } from "../../lib/id";
import { normalizeWebUrl } from "../../lib/url";
import { ACCEPT_ATTR, ingestFile, UploadError } from "../../state/assets";

export function ProfileFields({ keys }: { keys?: ProfileKey[] }) {
  const fields = useEditor((s) => s.project!.profile.fields);
  const edit = useEditor((s) => s.edit);
  const list = keys ? keys.map((k) => FIELD_META[k]) : PROFILE_FIELDS;
  return (
    <>
      {list.map((f) => (
        <TextInput
          key={f.key}
          label={f.label}
          value={fields[f.key]}
          placeholder={f.placeholder}
          multiline={f.multiline}
          type={f.key === "email" ? "email" : f.key === "phone" || f.key === "mobile" ? "tel" : "text"}
          hint={f.key === "displayName" ? "Shown instead of full name" : undefined}
          testId={`profile-${f.key}`}
          onChange={(v) => edit((d) => void (d.profile.fields[f.key] = v), `profile:${f.key}`)}
          onBlur={() => {
            if ((f.key === "phone" || f.key === "mobile") && fields[f.key]) {
              const formatted = formatPhone(fields[f.key]);
              if (formatted !== fields[f.key]) edit((d) => void (d.profile.fields[f.key] = formatted));
            }
          }}
        />
      ))}
    </>
  );
}

function CustomFields() {
  const custom = useEditor((s) => s.project!.profile.custom);
  const edit = useEditor((s) => s.edit);
  return (
    <>
      {custom.map((c, i) => (
        <div key={c.id} className="grid2" style={{ gridTemplateColumns: "1fr 1.4fr auto", alignItems: "end" }}>
          <TextInput label="Label" value={c.label} onChange={(v) => edit((d) => void (d.profile.custom[i].label = v), `custom:${c.id}:l`)} />
          <TextInput label="Value" value={c.value} onChange={(v) => edit((d) => void (d.profile.custom[i].value = v), `custom:${c.id}:v`)} />
          <button
            className="icon-btn"
            style={{ marginBottom: 12 }}
            aria-label={`Remove ${c.label}`}
            onClick={() => edit((d) => void d.profile.custom.splice(i, 1))}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button className="btn small" onClick={() => edit((d) => void d.profile.custom.push({ id: uid("cf"), label: "Fax", value: "" }))}>
        <Plus size={13} /> Add custom field
      </button>
      {custom.length > 0 && <p className="hint">Add custom fields to a Contact details block from the inspector.</p>}
    </>
  );
}

export function SocialEditor() {
  const socials = useEditor((s) => s.project!.profile.socials);
  const edit = useEditor((s) => s.edit);
  const toast = useEditor((s) => s.toast);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadFor = useRef<number>(-1);

  const add = (platform: SocialPlatform = "custom", url = "") => edit((d) => void d.profile.socials.push({ id: uid("s"), platform, url, visible: true }));

  return (
    <div data-testid="social-editor">
      {socials.length === 0 && (
        <p className="hint" style={{ marginTop: 0 }}>
          Paste a profile link and the platform is detected automatically.
        </p>
      )}
      {socials.map((s, i) => (
        <div key={s.id} style={{ marginBottom: 10 }}>
          <div className="social-row">
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
              <path d={ICON_PATHS[s.platform]} fill={s.visible ? "var(--ink)" : "var(--ink-4)"} />
            </svg>
            <input
              className="input small"
              value={s.url}
              placeholder={PLATFORM_MAP[s.platform].placeholder}
              aria-label={`${PLATFORM_MAP[s.platform].label} link`}
              onChange={(e) => {
                const url = e.target.value;
                edit((d) => {
                  d.profile.socials[i].url = url;
                  const detected = detectPlatform(url);
                  if (detected !== "custom" && d.profile.socials[i].platform === "custom") d.profile.socials[i].platform = detected;
                }, `social:${s.id}`);
              }}
              onBlur={() => s.url && !/^https?:\/\//i.test(s.url) && edit((d) => void (d.profile.socials[i].url = normalizeWebUrl(s.url)))}
            />
            <span className="row" style={{ gap: 0 }}>
              <button
                className="icon-btn small"
                aria-label={s.visible ? "Hide" : "Show"}
                onClick={() => edit((d) => void (d.profile.socials[i].visible = !s.visible))}
              >
                {s.visible ? <Eye size={13} /> : <EyeOff size={13} />}
              </button>
              <button
                className="icon-btn small"
                aria-label="Move up"
                disabled={i === 0}
                onClick={() => edit((d) => void d.profile.socials.splice(i - 1, 0, d.profile.socials.splice(i, 1)[0]))}
              >
                <ArrowUp size={13} />
              </button>
              <button
                className="icon-btn small"
                aria-label="Move down"
                disabled={i === socials.length - 1}
                onClick={() => edit((d) => void d.profile.socials.splice(i + 1, 0, d.profile.socials.splice(i, 1)[0]))}
              >
                <ArrowDown size={13} />
              </button>
              <button className="icon-btn small" aria-label="Remove link" onClick={() => edit((d) => void d.profile.socials.splice(i, 1))}>
                <Trash2 size={13} />
              </button>
            </span>
          </div>
          <div className="row" style={{ paddingLeft: 30, gap: 6 }}>
            <select
              className="select small"
              style={{ width: 120 }}
              value={s.platform}
              aria-label="Platform"
              onChange={(e) => edit((d) => void (d.profile.socials[i].platform = e.target.value as SocialPlatform))}
            >
              {PLATFORMS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <input
              className="input small"
              placeholder="Label (accessibility)"
              value={s.label ?? ""}
              aria-label="Accessible label"
              onChange={(e) => edit((d) => void (d.profile.socials[i].label = e.target.value || undefined), `social:${s.id}:label`)}
            />
            <button
              className="icon-btn small"
              title={s.iconAssetId ? "Replace custom icon" : "Upload a custom icon"}
              aria-label="Upload custom icon"
              onClick={() => {
                uploadFor.current = i;
                fileRef.current?.click();
              }}
            >
              <Upload size={13} />
            </button>
          </div>
        </div>
      ))}
      <div className="row">
        <button className="btn small" onClick={() => add()} data-testid="add-social">
          <Plus size={13} /> Add link
        </button>
        <select
          className="select small"
          value=""
          aria-label="Add a platform"
          onChange={(e) => e.target.value && add(e.target.value as SocialPlatform)}
          style={{ width: "auto" }}
        >
          <option value="">Add platform…</option>
          {PLATFORMS.filter((p) => p.id !== "custom").map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT_ATTR}
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          const idx = uploadFor.current;
          if (!f || idx < 0) return;
          try {
            const meta = await ingestFile(f, "icon");
            edit((d) => {
              d.assets[meta.id] = meta;
              d.profile.socials[idx].iconAssetId = meta.id;
            });
          } catch (err) {
            toast(err instanceof UploadError ? err.message : "Upload failed.", "error");
          }
        }}
      />
    </div>
  );
}

export function ProfilePanel() {
  return (
    <>
      <div className="panel-head">
        <h2>Profile</h2>
        <p>One source of truth. Connected components update everywhere.</p>
      </div>
      <div className="panel-pad">
        <h3 className="hint" style={{ textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 600, margin: "10px 0" }}>
          Identity & contact
        </h3>
        <ProfileFields />
        <h3 className="hint" style={{ textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 600, margin: "18px 0 10px" }}>
          Custom fields
        </h3>
        <CustomFields />
        <h3 className="hint" style={{ textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 600, margin: "22px 0 10px" }}>
          Social links
        </h3>
        <SocialEditor />
      </div>
    </>
  );
}

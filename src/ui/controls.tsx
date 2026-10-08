import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, X } from "lucide-react";
import type { ThemeColors } from "../model/types";
import { useEditor } from "../state/store";

export function Field(props: { label: ReactNode; hint?: ReactNode; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>
        <span>{props.label}</span>
        {props.hint && <span className="hint">{props.hint}</span>}
      </label>
      {props.children(id)}
    </div>
  );
}

export function TextInput(props: {
  label: ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: ReactNode;
  multiline?: boolean;
  type?: string;
  onBlur?: () => void;
  testId?: string;
}) {
  return (
    <Field label={props.label} hint={props.hint}>
      {(id) =>
        props.multiline ? (
          <textarea
            id={id}
            className="textarea"
            value={props.value}
            placeholder={props.placeholder}
            onChange={(e) => props.onChange(e.target.value)}
            onBlur={props.onBlur}
            rows={2}
            data-testid={props.testId}
          />
        ) : (
          <input
            id={id}
            className="input"
            type={props.type ?? "text"}
            value={props.value}
            placeholder={props.placeholder}
            onChange={(e) => props.onChange(e.target.value)}
            onBlur={props.onBlur}
            data-testid={props.testId}
          />
        )
      }
    </Field>
  );
}

export function Select<T extends string>(props: {
  label: ReactNode;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  hint?: ReactNode;
}) {
  return (
    <Field label={props.label} hint={props.hint}>
      {(id) => (
        <select id={id} className="select" value={props.value} onChange={(e) => props.onChange(e.target.value as T)}>
          {props.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

export function Segmented<T extends string>(props: {
  value: T;
  options: { value: T; label: ReactNode; title?: string }[];
  onChange: (v: T) => void;
  full?: boolean;
  label?: string;
}) {
  return (
    <div className={`seg${props.full ? " full" : ""}`} role="group" aria-label={props.label}>
      {props.options.map((o) => (
        <button key={o.value} type="button" aria-pressed={props.value === o.value} title={o.title} onClick={() => props.onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Range + number. Rapid changes coalesce into one undo step via `key`. */
export function Slider(props: {
  label: ReactNode;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
  hint?: ReactNode;
}) {
  const [draft, setDraft] = useState(String(props.value));
  useEffect(() => setDraft(String(round(props.value))), [props.value]);
  return (
    <Field label={props.label} hint={props.hint}>
      {(id) => (
        <div className="slider">
          <input
            type="range"
            aria-labelledby={id}
            min={props.min}
            max={props.max}
            step={props.step ?? 1}
            value={props.value}
            onChange={(e) => props.onChange(Number(e.target.value))}
          />
          <input
            id={id}
            className="input"
            inputMode="decimal"
            value={draft}
            aria-label={typeof props.label === "string" ? `${props.label}${props.unit ? ` (${props.unit})` : ""}` : undefined}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => commit()}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                e.preventDefault();
                const step = (props.step ?? 1) * (e.shiftKey ? 10 : 1) * (e.key === "ArrowUp" ? 1 : -1);
                props.onChange(clamp(props.value + step, props.min, props.max));
              }
            }}
          />
        </div>
      )}
    </Field>
  );

  function commit() {
    const n = Number(draft);
    if (Number.isFinite(n)) props.onChange(clamp(n, props.min, props.max));
    else setDraft(String(props.value));
  }
}

const round = (n: number) => Math.round(n * 100) / 100;
export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

const TOKENS: (keyof ThemeColors)[] = ["ink", "muted", "accent", "surface", "rule"];

/** Colour picker offering theme tokens first, then a custom value. */
export function ColorField(props: {
  label: ReactNode;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  allowInherit?: boolean;
  extra?: string[];
}) {
  const colors = useEditor((s) => s.project?.theme.colors);
  const resolved = props.value?.startsWith("$") ? colors?.[props.value.slice(1) as keyof ThemeColors] : props.value;
  const [hex, setHex] = useState(resolved ?? "");
  useEffect(() => setHex(resolved ?? ""), [resolved]);
  return (
    <Field
      label={props.label}
      hint={props.value?.startsWith("$") ? `Theme · ${props.value.slice(1)}` : props.value ? "Custom" : props.allowInherit ? "Inherited" : undefined}
    >
      {(id) => (
        <div className="color-input">
          <input id={id} type="color" value={toHex6(resolved ?? "#000000")} onChange={(e) => props.onChange(e.target.value)} aria-label="Custom colour" />
          <div className="swatches" style={{ flex: 1 }}>
            {TOKENS.map((t) => (
              <button
                key={t}
                type="button"
                className="swatch"
                title={`Theme ${t}`}
                aria-label={`Theme ${t} colour`}
                aria-pressed={props.value === `$${t}`}
                style={{ background: colors?.[t] }}
                onClick={() => props.onChange(`$${t}`)}
              />
            ))}
            <button
              type="button"
              className="swatch"
              title="White"
              aria-label="White"
              aria-pressed={props.value === "#ffffff"}
              style={{ background: "#fff" }}
              onClick={() => props.onChange("#ffffff")}
            />
            {props.extra?.map((c) => (
              <button
                key={c}
                type="button"
                className="swatch"
                title={c}
                aria-label={c}
                aria-pressed={props.value === c}
                style={{ background: c }}
                onClick={() => props.onChange(c)}
              />
            ))}
            {props.allowInherit && props.value && (
              <button type="button" className="icon-btn small" title="Reset to inherited" aria-label="Reset colour" onClick={() => props.onChange(undefined)}>
                <X size={13} />
              </button>
            )}
          </div>
          <input
            className="input small"
            style={{ width: 78 }}
            value={hex}
            aria-label="Hex colour"
            onChange={(e) => setHex(e.target.value)}
            onBlur={() => (/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(hex) ? props.onChange(hex) : setHex(resolved ?? ""))}
          />
        </div>
      )}
    </Field>
  );
}

export function toHex6(c: string): string {
  if (/^#[0-9a-f]{6}$/i.test(c)) return c;
  if (/^#[0-9a-f]{3}$/i.test(c)) return `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`;
  return "#000000";
}

export function Section(props: { title: string; children: ReactNode; defaultOpen?: boolean; right?: ReactNode }) {
  const [open, setOpen] = useState(props.defaultOpen ?? true);
  return (
    <div className="section">
      <button type="button" className="section-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span>{props.title}</span>
        <span className="row">
          {props.right}
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
      </button>
      {open && <div className="section-body">{props.children}</div>}
    </div>
  );
}

/** Native <dialog> modal: focus trap, Escape and backdrop handled by the browser. */
export function Modal(props: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  testId?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (props.open && !d.open) d.showModal();
    if (!props.open && d.open) d.close();
  }, [props.open]);
  return (
    <dialog
      ref={ref}
      className={`modal${props.wide ? " wide" : ""}`}
      onClose={props.onClose}
      onCancel={(e) => {
        e.preventDefault();
        props.onClose();
      }}
      onMouseDown={(e) => {
        if (e.target === ref.current) props.onClose();
      }}
      data-testid={props.testId}
    >
      {props.open && (
        <>
          <div className="modal-head">
            <div>
              <h2>{props.title}</h2>
              {props.subtitle && <p>{props.subtitle}</p>}
            </div>
            <button type="button" className="icon-btn" aria-label="Close" onClick={props.onClose}>
              <X size={18} />
            </button>
          </div>
          <div className="modal-body">{props.children}</div>
          {props.footer && <div className="modal-foot">{props.footer}</div>}
        </>
      )}
    </dialog>
  );
}

export function Toggle(props: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; hint?: ReactNode }) {
  const id = useId();
  return (
    <div className="field" style={{ marginBottom: 8 }}>
      <label htmlFor={id} style={{ justifyContent: "flex-start", gap: 8, cursor: "pointer" }}>
        <input id={id} type="checkbox" checked={props.checked} onChange={(e) => props.onChange(e.target.checked)} style={{ accentColor: "var(--ink)" }} />
        <span>{props.label}</span>
      </label>
      {props.hint && (
        <div className="hint" style={{ marginLeft: 22 }}>
          {props.hint}
        </div>
      )}
    </div>
  );
}

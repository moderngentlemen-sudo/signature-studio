import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Project, Variant } from "../model/types";
import { renderSignature } from "../render/email";
import { onSourcesChange, sourceUrl } from "../state/assets";

/** Local rendering diagnostics; intentionally does not claim email-client fidelity. */
export function PreviewFrame({ project, title, variant = "full", width, dark = false, imagesOff = false, fallbackFonts = false, onMeasure }: {
  project: Project; title: string; variant?: Variant; width?: number; dark?: boolean; imagesOff?: boolean; fallbackFonts?: boolean;
  onMeasure?: (width: number) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [revision, setRevision] = useState(0);
  const [measured, setMeasured] = useState(0);
  useEffect(() => { const off = onSourcesChange(() => setRevision(v => v + 1)); return () => { off(); }; }, []);
  const target = width ?? project.theme.width;
  const html = useMemo(() => {
    const sample = width ? { ...project, theme: { ...project.theme, width } } : project;
    return renderSignature(sample, { variant, mode: "preview", sourceUrl, fallbackFonts }).html;
    // Sources can become available after the project renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, width, variant, fallbackFonts, revision]);
  useLayoutEffect(() => {
    const el = host.current!;
    const root = el.shadowRoot ?? el.attachShadow({ mode: "open" });
    const template = document.createElement("template");
    template.innerHTML = html;
    if (imagesOff) template.content.querySelectorAll("img").forEach(img => {
      const replacement = document.createElement("span");
      replacement.style.cssText = img.style.cssText;
      replacement.style.display = "inline-block";
      replacement.style.background = "#e8e8e8";
      replacement.style.color = "#333";
      replacement.style.font = "11px Arial";
      replacement.style.overflow = "hidden";
      replacement.style.width = img.getAttribute("width") + "px";
      replacement.style.height = img.getAttribute("height") + "px";
      replacement.textContent = img.alt || "Image";
      replacement.setAttribute("role", "img");
      replacement.setAttribute("aria-label", img.alt || "Image blocked");
      img.replaceWith(replacement);
    });
    root.replaceChildren(template.content.cloneNode(true));
    const measure = () => {
      const table = root.firstElementChild as HTMLElement | null;
      const w = table?.offsetWidth ?? 0;
      setMeasured(w);
      onMeasure?.(w);
    };
    root.addEventListener("click", preventNavigation);
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    root.querySelectorAll("img").forEach(img => img.addEventListener("load", measure, { once: true }));
    let alive = true;
    document.fonts?.ready.then(() => { if (alive) measure(); });
    measure();
    return () => { alive = false; observer.disconnect(); root.removeEventListener("click", preventNavigation); };
  }, [html, imagesOff, onMeasure]);
  return <section className="preview-card" aria-label={title}>
    <div className="preview-card-head"><strong>{title}</strong><span className={measured > target + 1 ? "warn" : "muted"}>{Math.round(measured)} / {target}px{measured > target + 1 ? " · overflow" : ""}</span></div>
    <div className={"preview-card-body" + (dark ? " dark" : "")}>
      <div ref={host} className="diagnostic-signature" style={{ width: target }} />
    </div>
  </section>;
}
function preventNavigation(e: Event) { e.preventDefault(); }

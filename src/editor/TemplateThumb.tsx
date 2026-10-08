import { memo, useMemo } from "react";
import { renderSignature } from "../render/email";
import { applyTemplate } from "../templates/apply";
import type { Template } from "../templates/templates";
import type { Project } from "../model/types";
import { sourceUrl } from "../state/assets";
import { createProject } from "../templates/starter";

const sample = createProject({ sample: true });

/**
 * Live preview of a template rendered with the user's own details and
 * artwork. Only recomputes when the profile or assets change.
 */
export const TemplateThumb = memo(function TemplateThumb({
  template,
  profile,
  imagesKey,
  assets,
  scale = 0.56,
}: {
  template: Template;
  profile?: Project["profile"];
  /** JSON of the project's image nodes (stable string so thumbs don't re-render on every edit). */
  imagesKey?: string;
  assets?: Project["assets"];
  scale?: number;
}) {
  const html = useMemo(() => {
    const base = structuredClone(sample) as Project;
    if (profile?.fields.fullName) base.profile = structuredClone(profile);
    if (imagesKey && assets) {
      base.root = { ...base.root, children: JSON.parse(imagesKey) };
      base.assets = structuredClone(assets);
    }
    applyTemplate(base, template, { keepLook: false, keepCustom: false });
    return renderSignature(base, { variant: "full", mode: "preview", sourceUrl }).html;
  }, [template, profile, imagesKey, assets]);
  return (
    <div className="tpl-thumb" aria-hidden>
      <div className="tpl-thumb-inner" style={{ transform: `scale(${scale})` }} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
});

/** Stable key describing a project's placed images (for TemplateThumb). */
export function imagesKeyOf(root: Project["root"]): string {
  const images: unknown[] = [];
  const visit = (n: Project["root"]["children"][number]) => {
    if (n.type === "image" && n.props.assetId) images.push(n);
    if ("children" in n) (n.children as typeof root.children).forEach(visit);
  };
  root.children.forEach(visit);
  return JSON.stringify(images);
}

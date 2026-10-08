import { newProject } from "../model/factory";
import { SAMPLE_PROFILE } from "../model/profile";
import { uid } from "../lib/id";
import type { Project, ProfileFields, SocialLink } from "../model/types";
import { applyTemplate } from "./apply";
import { TEMPLATE_MAP, TEMPLATES } from "./templates";

export const SAMPLE_SOCIALS = (): SocialLink[] => [
  { id: uid("s"), platform: "instagram", url: "https://instagram.com/moderngentlemen", visible: true },
  { id: uid("s"), platform: "linkedin", url: "https://linkedin.com/company/moderngentlemen", visible: true },
  { id: uid("s"), platform: "x", url: "https://x.com/moderngentlemen", visible: true },
];

/** A new project laid out with a template. */
export function createProject(
  opts: {
    templateId?: string;
    name?: string;
    fields?: Partial<ProfileFields>;
    socials?: SocialLink[];
    sample?: boolean;
  } = {},
): Project {
  const project = newProject(opts.name ?? "My signature");
  if (opts.sample) {
    project.profile.fields = { ...SAMPLE_PROFILE };
    project.profile.socials = SAMPLE_SOCIALS();
  }
  if (opts.fields) project.profile.fields = { ...project.profile.fields, ...opts.fields };
  if (opts.socials) project.profile.socials = opts.socials;
  const template = TEMPLATE_MAP[opts.templateId ?? "exec-boardroom"] ?? TEMPLATES[0];
  applyTemplate(project, template, { keepLook: false, keepCustom: false });
  return project;
}

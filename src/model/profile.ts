import type { ContactItemKind, Profile, ProfileFields, ProfileKey } from "./types";
import { displayWebUrl, mailtoHref, normalizeWebUrl, telHref } from "../lib/url";

export interface ProfileFieldMeta {
  key: ProfileKey;
  label: string;
  short: string;
  placeholder: string;
  group: "identity" | "contact" | "extra";
  multiline?: boolean;
}

export const PROFILE_FIELDS: ProfileFieldMeta[] = [
  { key: "fullName", label: "Full name", short: "Name", placeholder: "Alexander Grant", group: "identity" },
  { key: "displayName", label: "Preferred display name", short: "Display", placeholder: "Alex Grant", group: "identity" },
  { key: "title", label: "Job title", short: "Title", placeholder: "Creative Director", group: "identity" },
  { key: "company", label: "Company", short: "Company", placeholder: "Modern Gentlemen", group: "identity" },
  { key: "department", label: "Department", short: "Dept", placeholder: "Brand Studio", group: "identity" },
  { key: "pronouns", label: "Pronouns", short: "Pronouns", placeholder: "he/him", group: "identity" },
  { key: "phone", label: "Phone", short: "T", placeholder: "+1 416 555 0182", group: "contact" },
  { key: "mobile", label: "Mobile", short: "M", placeholder: "+1 647 555 0119", group: "contact" },
  { key: "email", label: "Email", short: "E", placeholder: "alex@moderngentlemen.co", group: "contact" },
  { key: "website", label: "Website", short: "W", placeholder: "moderngentlemen.co", group: "contact" },
  { key: "address", label: "Address", short: "A", placeholder: "88 Yorkville Ave, Toronto", group: "contact", multiline: true },
  { key: "tagline", label: "Tagline", short: "Tagline", placeholder: "Considered style for the modern man.", group: "extra" },
  { key: "intro", label: "Introduction", short: "Intro", placeholder: "Warm regards,", group: "extra", multiline: true },
  { key: "booking", label: "Booking link", short: "Book", placeholder: "https://cal.com/alex", group: "extra" },
];

export const FIELD_META: Record<ProfileKey, ProfileFieldMeta> = Object.fromEntries(PROFILE_FIELDS.map((f) => [f.key, f])) as Record<
  ProfileKey,
  ProfileFieldMeta
>;

export function emptyFields(): ProfileFields {
  return Object.fromEntries(PROFILE_FIELDS.map((f) => [f.key, ""])) as ProfileFields;
}

/** The name shown in the signature: display name wins over full name. */
export function nameOf(fields: ProfileFields): string {
  return fields.displayName.trim() || fields.fullName.trim();
}

export function fieldValue(profile: Profile, key: ProfileKey): string {
  if (key === "fullName") return nameOf(profile.fields);
  return profile.fields[key] ?? "";
}

/** Display text for a field (websites are shortened). */
export function fieldDisplay(profile: Profile, key: ProfileKey): string {
  const v = fieldValue(profile, key);
  if (key === "website") return displayWebUrl(v);
  if (key === "booking") return displayWebUrl(v);
  return v;
}

/** Automatic link target for a field value. */
export function fieldHref(key: ProfileKey | ContactItemKind, value: string): string | null {
  if (!value.trim()) return null;
  switch (key) {
    case "phone":
    case "mobile":
      return telHref(value);
    case "email":
      return mailtoHref(value);
    case "website":
    case "booking":
      return normalizeWebUrl(value);
    default:
      return null;
  }
}

export const CONTACT_LABELS: Record<Exclude<ContactItemKind, "custom">, { short: string; full: string; field: ProfileKey }> = {
  phone: { short: "T", full: "Phone", field: "phone" },
  mobile: { short: "M", full: "Mobile", field: "mobile" },
  email: { short: "E", full: "Email", field: "email" },
  website: { short: "W", full: "Web", field: "website" },
  address: { short: "A", full: "Address", field: "address" },
};

/** Light-touch phone formatting for NANP numbers; leaves others untouched. */
export function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+1 ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  return raw.trim();
}

export const SAMPLE_PROFILE: ProfileFields = {
  fullName: "Alexander Grant",
  displayName: "",
  title: "Creative Director",
  company: "Modern Gentlemen",
  department: "Brand Studio",
  pronouns: "",
  phone: "+1 416 555 0182",
  mobile: "",
  email: "alex@moderngentlemen.co",
  website: "moderngentlemen.co",
  address: "88 Yorkville Ave, Toronto",
  tagline: "Considered style for the modern man.",
  intro: "",
  booking: "https://cal.com/moderngentlemen",
};

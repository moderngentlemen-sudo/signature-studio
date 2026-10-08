import mgLogo from "../assets/builtin/mg-logo.svg?url";
import mgLogoWide from "../assets/builtin/mg-logo-wide.svg?url";
import type { AssetMeta, Project } from "./types";

export interface BuiltinAsset extends AssetMeta {
  url: string;
  /** Single-colour artwork that can be tinted (white source fill). */
  tintable: boolean;
  description: string;
}

/** Built-in brand artwork. Goes through the same publish/verify pipeline as uploads. */
export const BUILTINS: Record<string, BuiltinAsset> = {
  "builtin:mg-monogram": {
    id: "builtin:mg-monogram",
    name: "Modern Gentlemen monogram",
    description: "MG monogram",
    mime: "image/svg+xml",
    width: 2000,
    height: 998,
    bytes: 3096,
    hash: "builtin-mg-monogram-v1",
    createdAt: 0,
    url: mgLogo,
    tintable: true,
  },
  "builtin:mg-wordmark": {
    id: "builtin:mg-wordmark",
    name: "Modern Gentlemen wordmark",
    description: "MODERN GENTLEMEN wordmark",
    mime: "image/svg+xml",
    width: 1584,
    height: 124,
    bytes: 10168,
    hash: "builtin-mg-wordmark-v1",
    createdAt: 0,
    url: mgLogoWide,
    tintable: true,
  },
};

export function assetMeta(project: Project, id: string | undefined): AssetMeta | BuiltinAsset | null {
  if (!id) return null;
  return BUILTINS[id] ?? project.assets[id] ?? null;
}

export function isBuiltin(id: string | undefined): boolean {
  return !!id && id.startsWith("builtin:");
}

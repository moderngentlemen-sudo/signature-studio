import {
  AlignLeft,
  Columns2,
  Contact,
  Heading,
  Image as ImageIcon,
  Layers,
  Minus,
  MousePointerClick,
  QrCode,
  RectangleVertical,
  Share2,
  Space,
  Tag,
  Type,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import type { SigNode } from "../model/types";

const ICONS: Record<SigNode["type"], LucideIcon> = {
  stack: Layers,
  row: Columns2,
  column: RectangleVertical,
  field: UserRound,
  text: AlignLeft,
  contact: Contact,
  image: ImageIcon,
  social: Share2,
  button: MousePointerClick,
  divider: Minus,
  spacer: Space,
  qr: QrCode,
  badge: Tag,
};

export function NodeIcon({ type, size = 14 }: { type: SigNode["type"]; size?: number }) {
  const Icon = ICONS[type] ?? Type;
  return <Icon size={size} strokeWidth={1.75} aria-hidden />;
}

export { Heading };

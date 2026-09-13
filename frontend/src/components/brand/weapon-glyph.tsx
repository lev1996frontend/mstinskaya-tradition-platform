/**
 * Bridge between the backend's weapon enum and the shared hand-drawn glyphs.
 *
 * `weapon-glyphs.tsx` owns the four drawings and is a stable shared export —
 * this file only maps `WeaponCategory` onto them, so the real per-bout
 * weapon data can be rendered without forking a second copy of the artwork.
 *
 * Lives in `components/brand` (not a feature) because both `tournaments`
 * (bracket views, lot dice) and `equipment` (the снаряжение list) render a
 * bare weapon glyph without the label `WeaponMark` adds — see
 * `features/tournaments/weapon-mark.tsx` for that labeled wrapper.
 */
import {
  HandsIcon,
  KistenIcon,
  NozhIcon,
  PalkaIcon,
} from "./weapon-glyphs";
import type { WeaponCategory } from "@/types";

const GLYPHS = {
  PALKA: PalkaIcon,
  NOZH: NozhIcon,
  HANDS: HandsIcon,
  KISTEN: KistenIcon,
} as const;

export function WeaponGlyph({
  weapon,
  size = 20,
  className,
}: {
  weapon: WeaponCategory;
  size?: number;
  className?: string;
}) {
  const Icon = GLYPHS[weapon];
  return <Icon size={size} className={className} />;
}

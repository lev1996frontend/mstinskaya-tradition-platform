/**
 * Bridge between the backend's weapon enum and the shared hand-drawn glyphs.
 *
 * `components/brand/weapon-glyphs.tsx` owns the four drawings and is a stable
 * shared export — this file only maps `WeaponCategory` onto them, so the real
 * per-bout weapon data can be rendered without forking a second copy of the
 * artwork.
 */
import {
  HandsIcon,
  KistenIcon,
  NozhIcon,
  PalkaIcon,
} from "@/components/brand/weapon-glyphs";
import { cn } from "@/components/ui";
import { weaponCategory } from "@/lib/labels";
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

/** Weapon with its name — the standard way a drawn lot is shown. */
export function WeaponMark({
  weapon,
  size = 18,
  className,
  showLabel = true,
}: {
  weapon: WeaponCategory | null;
  size?: number;
  className?: string;
  showLabel?: boolean;
}) {
  if (!weapon) {
    return (
      <span className={cn("text-sm italic text-[var(--muted)]", className)}>
        жребий не брошен
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <WeaponGlyph weapon={weapon} size={size} />
      {showLabel ? <span className="text-sm font-medium">{weaponCategory[weapon]}</span> : null}
    </span>
  );
}

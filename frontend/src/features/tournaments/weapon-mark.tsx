/**
 * Weapon with its name — the standard way a drawn lot is shown.
 *
 * The bare-glyph renderer this used to define, `WeaponGlyph`, now lives in
 * `@/components/brand/weapon-glyph` — it's a generic presentational
 * component (weapon-class icon only, no label), reused by both this feature
 * and `features/equipment`, so it belongs in shared `components/`, not here.
 */
import { WeaponGlyph } from "@/components/brand/weapon-glyph";
import { cn } from "@/components/ui";
import { weaponCategory } from "@/lib/labels";
import type { WeaponCategory } from "@/types";

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

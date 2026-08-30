import { WEAPON_MOTIFS } from "@/components/brand/weapon-glyphs";
import { cn } from "@/components/ui";

/**
 * Section divider: three small lozenges centred on a hairline, replacing a
 * plain `<hr>`. Used sparingly between major sections. `variant="weapons"`
 * swaps the lozenges for the tradition's four weapon glyphs at low opacity —
 * reserved for tournament-section breaks, so the motif doesn't turn up
 * everywhere a plain divider would do.
 */
export function Divider({
  className,
  variant = "default",
}: {
  className?: string;
  variant?: "default" | "weapons";
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)} aria-hidden="true" role="presentation">
      <span className="h-px flex-1 bg-[var(--border)]" />
      {variant === "weapons" ? (
        <span className="flex items-center gap-2 text-[var(--gold)] opacity-40">
          {WEAPON_MOTIFS.map(({ key, Icon }) => (
            <Icon key={key} size={14} />
          ))}
        </span>
      ) : (
        <span className="flex items-center gap-1.5">
          <span className="size-1 rotate-45 bg-[var(--gold)]" />
          <span className="size-1.5 rotate-45 bg-[var(--gold)]" />
          <span className="size-1 rotate-45 bg-[var(--gold)]" />
        </span>
      )}
      <span className="h-px flex-1 bg-[var(--border)]" />
    </div>
  );
}

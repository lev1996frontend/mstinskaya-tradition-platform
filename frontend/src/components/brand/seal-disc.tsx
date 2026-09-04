/**
 * Сургучная печать — the club emblem struck into a disc of red wax.
 *
 * The emblem is the real club mark (`public/brand/mstinskaya-emblem.svg`), a
 * traced silhouette: 64 subpaths, ~4400 points, 70KB. Drawn as a mask rather
 * than an `<img>` for two reasons — the file is served from `public/` instead
 * of being inlined into the bundle, and a mask lets the emblem take a palette
 * token, so it dims with the rest of the river symbols instead of being frozen
 * at the white variant's own colour.
 *
 * It needs real size to read: an earlier simplified crest existed precisely
 * because this much detail turns to mud on a ~26px disc. Both places that show
 * the seal were grown to fit the real mark instead — the header strip's shield
 * (`components/layout/river-wax-seal.tsx`, 48px) and the margin river's застава
 * (`components/layout/river-spine.tsx`, 46px) — so the simplification is gone
 * and the same emblem answers everywhere. Don't reuse this below ~34px without
 * checking what survives.
 */
const EMBLEM_MASK = "url(/brand/mstinskaya-emblem.svg) center / contain no-repeat";

function SealEmblem({ size }: { size: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        background: "var(--foreground)",
        WebkitMask: EMBLEM_MASK,
        mask: EMBLEM_MASK,
      }}
    />
  );
}

/** The wax disc itself. Red wax (`--accent`, the brighter oxblood register —
 *  `--accent-deep` read too dark/brown to land as "red") with the emblem
 *  showing plainly on it from the start, not hidden under anything. The
 *  emblem's ribbon overhangs the wax edge a little at 0.86 — a stamp pressed
 *  slightly wider than its own wax, which is truer to a real seal than shrinking
 *  the mark until the whole thing fits inside the circle. */
export function SealDisc({ size }: { size: number }) {
  return (
    <span
      aria-hidden="true"
      className="grid place-items-center rounded-full"
      style={{
        width: size,
        height: size,
        background:
          "radial-gradient(circle at 35% 30%, color-mix(in srgb, var(--accent) 55%, white) 0%, var(--accent) 55%, color-mix(in srgb, var(--accent) 85%, black) 100%)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <SealEmblem size={size * 0.86} />
    </span>
  );
}

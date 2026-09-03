/**
 * Сургучная печать — the club crest struck into a disc of red wax.
 *
 * The crest is a simplified silhouette of the club mark: two confronting bears
 * rearing up, paws reaching toward each other, over a two-barred cross, ringed.
 * Not a literal trace of the source (a ~26px wax disc can't carry that much
 * fur/claw detail; it would turn to mud), but the same composition — head,
 * raised paw, cross — reduced to shapes that still read at stamp size. Always
 * solid black, `currentColor` deliberately unused: an emboss reads as
 * pressed-in shadow, not as the wax's own tint.
 *
 * Kept for the margin river's застава (`components/layout/river-spine.tsx`),
 * which shows the disc at 26px. The header strip's shield
 * (`components/layout/river-wax-seal.tsx`) is large enough to carry the real
 * emblem instead — see `SealEmblem` below.
 */
function SealCrestIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="16" cy="16" r="13" stroke="#000" strokeWidth="1.2" />

      {/* left bear: head + ear + a paw reaching up toward center */}
      <path
        d="M5 15 C4.3 11 6.5 8 9.6 8.3 C11.3 8.5 12.4 9.6 13.3 11.2 L15.4 14.6 L11.4 15.2 C9 15.6 6.6 15 5 13.6 Z"
        fill="#000"
      />
      <path d="M6.8 8.6 L8.4 10.9 L5.6 11.2 Z" fill="#000" />
      <path d="M12.5 15 L15.5 12.8 L15.9 14.3 L17.3 13 L16.9 14.8 L18.2 14 L17.1 16.1 L13.6 16.6 Z" fill="#000" />

      {/* right bear — mirrored (x' = 32 − x) */}
      <path
        d="M27 15 C27.7 11 25.5 8 22.4 8.3 C20.7 8.5 19.6 9.6 18.7 11.2 L16.6 14.6 L20.6 15.2 C23 15.6 25.4 15 27 13.6 Z"
        fill="#000"
      />
      <path d="M25.2 8.6 L23.6 10.9 L26.4 11.2 Z" fill="#000" />
      <path d="M19.5 15 L16.5 12.8 L16.1 14.3 L14.7 13 L15.1 14.8 L13.8 14 L14.9 16.1 L18.4 16.6 Z" fill="#000" />

      {/* two-barred cross, below where the paws meet */}
      <path d="M16 17.5 V25 M13.7 19.2 H18.3 M14.8 21.6 H17.2" stroke="#000" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

/* The real club emblem (`public/brand/mstinskaya-emblem.svg`), a traced
   silhouette — 64 subpaths, ~4400 points, 70KB. Drawn as a mask rather than an
   `<img>` for two reasons: the file is served from `public/` instead of being
   inlined into the bundle, and masking lets the emblem take a palette token,
   so it dims with the rest of the river symbols instead of being frozen at the
   white variant's own colour. Needs real size to read: at the 26px the застава
   uses, this much detail turns to mud, which is why `SealCrestIcon` above
   still exists. */
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
 *  `--accent-deep` read too dark/brown to land as "red") with the crest showing
 *  plainly on it from the start, not hidden under anything. */
export function SealDisc({
  size,
  dim = false,
  emblem = false,
}: {
  size: number;
  dim?: boolean;
  /** Stamp the full emblem instead of the simplified crest. Only for discs big
   *  enough to carry it (the header shield); off by default. */
  emblem?: boolean;
}) {
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
        opacity: dim ? 0.85 : 1,
      }}
    >
      {emblem ? <SealEmblem size={size * 0.86} /> : <SealCrestIcon size={size * 0.62} />}
    </span>
  );
}

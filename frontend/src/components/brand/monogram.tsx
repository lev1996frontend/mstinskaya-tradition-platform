/**
 * The mark: a stacked "ТМ" monogram — Традиция above, Мстинская below — cut
 * as bold, simple geometric blocks (a crossbar-and-stem Т, a two-leg-and-wedge
 * М) rather than thin strokes or ornate curves. Flat `currentColor` fill only,
 * so it stays crisp at favicon size and reads the same in both themes.
 *
 * An earlier version tried to fold both letters into one scalloped plate
 * silhouette with hand-fitted Bézier curves — it read as muddled rather than
 * "stamped". Two stacked letterforms, sharing the same left/right margins so
 * they read as one mark, is more legible at every size this renders at.
 */
export function Monogram({
  className,
  size = 32,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      {/* Т */}
      <rect x="10" y="4" width="44" height="7" />
      <rect x="28.5" y="11" width="7" height="13" />

      {/* М */}
      <rect x="10" y="28" width="8" height="30" />
      <rect x="46" y="28" width="8" height="30" />
      <path d="M18 28 L46 28 L32 44 Z" />
    </svg>
  );
}

/**
 * Братина — the communal vessel the drink went round the circle in: a wide, low
 * bowl with a handle on each side, not a mug and not a goblet. The handles are
 * the whole point of the shape — a братина is passed from hand to hand, so it
 * has one on either side; a single-handled mug (`mug-icon.tsx`, still the
 * header strip's own symbol for the "напиток" reading) is a vessel one person
 * drinks from.
 *
 * Two nested groups hold the drink, and they have to stay separate: the outer
 * one carries the *level* (transitioned, so draining and filling read as the
 * liquid rising and falling), the inner one carries the *slosh* (a keyframe
 * animation). Both write `transform`, so on one element the animation would
 * simply overwrite the level for as long as it ran. Both live inside a clip of
 * the bowl, and the surface is drawn wider than the bowl on either side, so it
 * can slide without a bare corner appearing at the far wall.
 */
export function BratinaIcon({
  className,
  size = 24,
  drained = false,
  sloshing = false,
}: {
  className?: string;
  size?: number;
  /** Empty: the level sits below the bowl's floor, out of sight under the clip. */
  drained?: boolean;
  sloshing?: boolean;
}) {
  const bowl = "M4 8 H24 V12 C24 17.2 19.8 20.4 14 20.4 C8.2 20.4 4 17.2 4 12 Z";
  return (
    <svg
      width={size}
      height={(size * 22) / 28}
      viewBox="0 0 28 22"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <defs>
        <clipPath id="bratina-bowl">
          <path d={bowl} />
        </clipPath>
      </defs>

      <g clipPath="url(#bratina-bowl)">
        <g className="bratina-level" style={{ transform: drained ? "translateY(11px)" : "translateY(0)" }}>
          <path
            className={sloshing ? "bratina-liquid" : undefined}
            d="M-6 11.6 Q -1 9.9 4 11.6 T 14 11.6 T 24 11.6 T 34 11.6 V 24 H-6 Z"
            fill="currentColor"
            opacity="0.34"
          />
        </g>
      </g>

      <path d={bowl} stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M2.6 8 H25.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path
        d="M4 9.4 C1.5 10 1.5 13.2 4 13.8 M24 9.4 C26.5 10 26.5 13.2 24 13.8"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

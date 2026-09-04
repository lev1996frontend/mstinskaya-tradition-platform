/**
 * Якорь — dropped by the boat when it puts in at a berth on the margin river
 * (`components/layout/river-spine.tsx`). Same single-colour line-art language
 * as `BoatIcon` and the mark glyphs.
 *
 * Drawn hanging from its ring at the top, because that's the end the chain
 * comes down to: the anchor is placed under the boat and falls into the pool,
 * so the ring has to be the part nearest the hull.
 */
export function AnchorIcon({ className, size = 14 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
      <circle cx="8" cy="2.6" r="1.7" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 4.3 V13.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M4.6 6.2 H11.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path
        d="M3 9.6 C3 12.4 5.3 14 8 14 C10.7 14 13 12.4 13 9.6"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

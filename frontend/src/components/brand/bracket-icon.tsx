/**
 * Сетка — four seeds folding into two and then one: the mark for the bracket
 * section ("Сетка") in the margin river (`components/layout/river-spine.tsx`).
 *
 * The bracket's own shape rather than a cup or a list. A trophy would name the
 * end of the tournament and this section is about the middle of it — who meets
 * whom — and a list is what every other mark on the rail could also be. Drawn
 * as the tree collapsing left to right, which is the one thing only a bracket
 * looks like, in the same single-colour line-art language as `AnnalIcon` and
 * `weapon-glyphs.tsx`.
 */
export function BracketIcon({ className, size = 24 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      {/* Four seeds. */}
      <path
        d="M3 4.5 H8.5 M3 9.5 H8.5 M3 14.5 H8.5 M3 19.5 H8.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      {/* Each pair joined, and carried to the semi-final. */}
      <path
        d="M8.5 4.5 V9.5 M8.5 14.5 V19.5 M8.5 7 H14 M8.5 17 H14"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      {/* The two halves meeting, and the one line out of the whole thing. */}
      <path d="M14 7 V17 M14 12 H21" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

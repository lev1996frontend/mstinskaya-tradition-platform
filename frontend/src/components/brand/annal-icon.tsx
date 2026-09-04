/**
 * Летопись — a ruled leaf with a turned corner: the mark for the chronicle
 * ("Хроника"). Same single-colour line-art language as `weapon-glyphs.tsx` and
 * `BoatIcon` — thin `currentColor` strokes, no literal illustration — so it
 * sits in the margin river (`components/layout/river-spine.tsx`) as one of the
 * same family of marks as the shield and the wall.
 *
 * A page rather than a quill or a clock: what the section holds is the record
 * itself, and a written leaf is the only one of the three that can't be read as
 * "write something" or "wait".
 */
export function AnnalIcon({ className, size = 24 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M6 3.5 H14.6 L18 7 V20.5 H6 Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M14.5 3.6 V7.1 H18" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path
        d="M8.7 11 H15.3 M8.7 14 H15.3 M8.7 17 H13"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

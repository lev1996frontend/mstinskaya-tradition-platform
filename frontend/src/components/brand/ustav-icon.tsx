/**
 * Устав — a charter rolled at both ends: the mark for the rules section
 * ("Правила") in the margin river (`components/layout/river-spine.tsx`).
 *
 * A scroll and not another leaf, because `AnnalIcon` is already a leaf and
 * stands one mark up the same rail for the registry. The two would read as the
 * same object at 18px. Rolled ends are the one silhouette a page doesn't have.
 *
 * No pendant seal hanging off it: at the size this is actually drawn the blob
 * turned to mush and the whole glyph stopped being a scroll. Same single-colour
 * line-art language as the rest of the marks.
 */
export function UstavIcon({ className, size = 24 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      {/* The two rolls. */}
      <path
        d="M4.5 4.8 H19.5 M4.5 19.2 H19.5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      {/* The sheet between them. */}
      <path d="M6.5 5.4 V18.6 M17.5 5.4 V18.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      {/* What is written on it. */}
      <path
        d="M9 9.2 H15.4 M9 12 H15.4 M9 14.8 H13"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  );
}

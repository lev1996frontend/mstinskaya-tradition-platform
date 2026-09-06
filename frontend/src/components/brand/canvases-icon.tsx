/**
 * Холсты — two canvases stood against each other: the mark for the painted
 * half of the "Живопись" section on the margin river
 * (`components/layout/river-spine.tsx`).
 *
 * It stands one mark below `PaintingIcon`, so the thing it must not be is
 * another single picture. An easel is taken, a framed rectangle is `AnnalIcon`'s
 * ruled leaf at this size (that mistake is recorded in `PaintingIcon`'s own
 * note), so this one is drawn as a *stack* — the back canvas showing only two
 * of its edges behind the front one. Two overlapping quadrilaterals is a
 * silhouette nothing else on this rail has, and it reads as more than one
 * picture before any detail inside is legible.
 */
export function CanvasesIcon({ className, size = 24 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      {/* The one behind: only the two edges that clear the front one. */}
      <path d="M7.6 4.5 H20 V16.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      {/* The one in front. */}
      <rect x="4" y="7.6" width="12.4" height="11.9" rx="0.6" stroke="currentColor" strokeWidth="1.5" />
      {/* Enough of a horizon and a rise to say it is painted, not blank. */}
      <path
        d="M5.9 15.6 L8.6 12.9 L11 15 L13 13.2 L14.6 14.7"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

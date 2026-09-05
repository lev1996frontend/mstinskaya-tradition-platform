/**
 * Жребий — the lot cube, seen the way a cube is seen: on its corner, three
 * faces at once. The mark that stands last in the margin river on the
 * tournaments page (`components/layout/river-spine.tsx`) and is the one mark
 * there that isn't a way anywhere — you don't navigate to chance.
 *
 * A single pip on the top face, so it reads as a die and not as a crate. The
 * pip sits on the face's own centre, which in this projection is the middle of
 * the top rhombus rather than the middle of the drawing.
 *
 * Related but deliberately not shared with the real жребий widget's cube
 * (`features/tournaments/tournament-path/lot-cube.tsx`): that one is six
 * rotated DOM faces in a perspective stage, and nothing about it survives being
 * shrunk to 18px in a margin.
 */
export function LotIcon({ className, size = 24 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      {/* The silhouette: a hexagon, which is what a cube on its corner is. */}
      <path
        d="M12 3.5 L19.4 7.8 V16.2 L12 20.5 L4.6 16.2 V7.8 Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      {/* The three edges meeting at the near corner — without these the
          hexagon is a flat plate, which is the exact mistake the big cube
          spent a whole session making. */}
      <path d="M12 12 L12 3.5 M12 12 L4.6 16.2 M12 12 L19.4 16.2" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="12" cy="7.9" r="1.15" fill="currentColor" />
    </svg>
  );
}

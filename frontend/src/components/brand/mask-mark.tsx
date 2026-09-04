/**
 * Маска — the tradition's protective mask as a small mark: soft frame, mesh
 * over the whole face, a hint of the gorget under the chin. It stands where a
 * photograph would in every roster and participant slot, because a fighter
 * shows up to a bout wearing one.
 *
 * Replaces the old `HelmetIcon` in that role. That one was a dome with two
 * short strokes for eyes, which at 18px read as a pill with a face — the mesh
 * is what makes this object a mask, so the mesh is what survives the shrink;
 * eyes are the thing a real mask specifically doesn't show.
 *
 * The mesh is clipped to the frame rather than drawn to fit it: a grid that
 * stops short of the edge reads as a pattern printed on a shape, while one cut
 * off by the outline reads as material stretched across an opening.
 *
 * One `clipPath` id for every instance on purpose — every mark clips to the
 * same face, so sharing one definition is correct and avoids minting an id per
 * row of a register.
 */
const FACE =
  "M12 2.6 C8.1 2.6 5.6 5.1 5.6 8.9 L5.6 13.3 C5.6 17 8.4 19.7 12 19.7 C15.6 19.7 18.4 17 18.4 13.3 L18.4 8.9 C18.4 5.1 15.9 2.6 12 2.6 Z";

export function MaskMark({ className, size = 20 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <defs>
        <clipPath id="mask-mark-face">
          <path d={FACE} />
        </clipPath>
      </defs>

      <g clipPath="url(#mask-mark-face)">
        <path
          d="M8.4 2 V20 M12 2 V20 M15.6 2 V20 M4 7.4 H20 M4 11.2 H20 M4 15 H20"
          stroke="currentColor"
          strokeWidth="0.85"
          opacity="0.5"
        />
      </g>

      <path d={FACE} stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path
        d="M8.6 19.9 C10.1 21.2 13.9 21.2 15.4 19.9"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Опаска — the sash, tied and left hanging: the tail mark on the equipment
 * page's margin river (`components/layout/river-spine.tsx`).
 *
 * A knot with two ends rather than a belt drawn flat: flat, it is a rectangle
 * at 18px, and the rail already has enough rectangles. The knot is the part of
 * this object a fighter actually does something to, which is also why it is
 * the one mark on that rail that answers a click instead of going anywhere.
 */
export function SashIcon({ className, size = 24 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      {/* The band coming round the waist from either side. */}
      <path
        d="M2.5 8.5 C6 7.4, 8.4 7.6, 10.2 9.2 M21.5 8.5 C18 7.4, 15.6 7.6, 13.8 9.2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* The knot itself. */}
      <path
        d="M10.2 9.2 C11.4 10.4, 12.6 10.4, 13.8 9.2 C14.6 10.6, 14.4 12, 13.2 12.9 C12.3 13.6, 11.7 13.6, 10.8 12.9 C9.6 12, 9.4 10.6, 10.2 9.2 Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      {/* The two ends hanging off it. */}
      <path
        d="M11 13.4 C10.4 16, 10 18.4, 10.4 20.8 M13 13.4 C13.7 16, 14.1 18.4, 13.8 20.8"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

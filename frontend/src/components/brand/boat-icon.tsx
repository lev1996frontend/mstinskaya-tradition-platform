/**
 * Кораблик — side-silhouette boat (hull, mast, two triangular sails) in the
 * same single-colour `currentColor` line/fill language as
 * `weapon-glyphs.tsx`.
 *
 * Lives here rather than inside the river that sails it: the boat carries the
 * reader's position down the page-margin river (`components/layout/river-spine.tsx`)
 * and marks the «корабль» reading of the word in that river's own landing. It
 * once also crossed a strip in the header; that strip is gone, but the icon
 * stays shared, so a second place that needs the vessel does not trace a
 * second one.
 */
export function BoatIcon({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={(size * 24) / 29} viewBox="0 0 29 24" fill="none" aria-hidden="true">
      <path d="M2 16.5 L27 16.5 L22.5 21.5 L6.5 21.5 Z" fill="currentColor" />
      <path d="M14.5 16.5 L14.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M15.2 3.6 L22 15 L15.2 15 Z" fill="currentColor" opacity="0.8" />
      <path d="M13.8 7.4 L8.5 15 L13.8 15 Z" fill="currentColor" opacity="0.55" />
    </svg>
  );
}

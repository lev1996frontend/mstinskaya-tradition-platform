/**
 * Живопись — a canvas on an easel: the mark for the paintings section on the
 * margin river (`components/layout/river-spine.tsx`). Same single-colour
 * line-art language as `AnnalIcon`/`weapon-glyphs.tsx` — thin `currentColor`
 * strokes, no literal illustration.
 *
 * An easel, not a framed picture: framed, it came out as a rectangle with lines
 * in it, which at 18px is the same silhouette as `AnnalIcon`'s ruled leaf right
 * next to it on the same river. The splayed legs give it a shape nothing else
 * on the rail has, before any of the detail inside is legible.
 */
export function PaintingIcon({ className, size = 24 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      {/* the canvas */}
      <rect x="4.5" y="3.5" width="15" height="11.5" rx="0.6" stroke="currentColor" strokeWidth="1.5" />
      {/* what's on it: a horizon and a rise, enough to read as painted */}
      <path d="M6.5 12 L10 8.8 L13 11.2 L15.5 9.2 L17.5 11" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      {/* the easel */}
      <path d="M7.5 15 L5.5 21 M16.5 15 L18.5 21 M12 15 V19" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

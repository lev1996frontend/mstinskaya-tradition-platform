/**
 * A small icon-scale version of the tradition's protective mask (see the
 * hero's full pointer-reactive `HelmetReveal` for the same silhouette at
 * large size) — used as the default participant/athlete avatar mark instead
 * of initials, since every fighter shows up to a bout wearing one. Single
 * color, `currentColor`, no mesh detail at this size (it would just be noise
 * below ~40px) — the dome + jaw outline reads clearly on its own.
 */
export function HelmetIcon({ className, size = 20 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="M12 2.5 C7.5 2.5 5 5.5 5 9.5 L5 15 C5 18.5 8 21 12 21 C16 21 19 18.5 19 15 L19 9.5 C19 5.5 16.5 2.5 12 2.5 Z"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="currentColor"
        fillOpacity="0.12"
      />
      <path d="M8.5 11.5 L8.5 13.5 M15.5 11.5 L15.5 13.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Corner glyph applied to *featured* cards only (next tournament, championship
 * match) — an L-bracket with a small lozenge, signalling "this one matters"
 * without decorating every card on the screen.
 */
export function CornerMark({
  className,
  size = 22,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path d="M2.5 9.5 L2.5 2.5 L9.5 2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="14.5" y="2.5" width="4.6" height="4.6" transform="rotate(45 16.8 4.8)" fill="currentColor" />
    </svg>
  );
}

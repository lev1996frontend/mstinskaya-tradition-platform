/**
 * The mobile nav toggle, in the same hairline single-color line language as
 * `weapon-glyphs.tsx`/`helmet-icon.tsx` (`currentColor`, thin rounded
 * strokes) — replacing the generic thick-stroked Lucide `Menu`/`X` that was
 * the one off-brand icon on an otherwise bespoke page.
 */
type GlyphProps = { className?: string; size?: number };

/**
 * The header's own burger↔close toggle, three plain `<span>` bars (not the
 * SVG-line `MenuGlyph` this replaced) so each can carry its own CSS
 * `transform`/`opacity` transition and morph into the other shape instead of
 * the two icons hard-swapping on `open`. Closed: three parallel bars, evenly
 * spaced. Open: the outer two rotate 45°/-45° about the box's own centre to
 * form an X, the middle one shrinks and fades out from under them.
 *
 * Two curves, on purpose: the outer bars are *moving on screen* (rotating
 * into an X), so they get the strong ease-in-out morph curve; the middle bar
 * is *entering/exiting* (a plain fade), so it gets the codebase's own
 * `--ease-out` token instead of a second invented curve. A ~40ms stagger
 * mirrors itself on the way out — opening fades the middle bar first, then
 * swings the outer two in behind it; closing snaps the outer two back
 * immediately, then fades the middle bar in after — so open and close read
 * as the same motion in reverse, not two different animations.
 *
 * `reduceMotion` collapses everything to 0ms — same graceful-degradation
 * pattern as the mobile menu's own `AnimatePresence` transitions nearby in
 * `site-header.tsx`, not a separate opt-out.
 */
export function MenuToggleGlyph({
  open,
  reduceMotion = false,
  className,
  size = 20,
}: GlyphProps & { open: boolean; reduceMotion?: boolean }) {
  const barHeight = Math.max(1.4, size * 0.08);
  // 0.3, not the flatter 0.24 an earlier pass used — at 0.24 the bars'
  // vertical spread was noticeably narrower than the box is wide, so the
  // glyph read as a squashed horizontal rectangle rather than a proportioned
  // hamburger. 0.3 matches the original static `MenuGlyph`'s own
  // width:spread ratio (15:9 in its 24-unit viewBox, ≈1.67:1).
  const offset = size * 0.3;
  const rotateMs = reduceMotion ? 0 : 220;
  const fadeMs = reduceMotion ? 0 : 140;
  const staggerMs = reduceMotion ? 0 : 40;

  const bar = (translateY: number, rotate: number, isMiddle: boolean) => ({
    position: "absolute" as const,
    left: 0,
    right: 0,
    top: "50%",
    height: barHeight,
    borderRadius: barHeight / 2,
    background: "currentColor",
    transformOrigin: "center",
    transition: [
      `transform ${rotateMs}ms cubic-bezier(0.77, 0, 0.175, 1) ${isMiddle ? 0 : open ? staggerMs : 0}ms`,
      `opacity ${fadeMs}ms var(--ease-out) ${isMiddle ? (open ? 0 : staggerMs) : 0}ms`,
    ].join(", "),
    transform: open
      ? `translateY(-50%) rotate(${rotate}deg)`
      : `translateY(-50%) translateY(${translateY}px)`,
    opacity: open && isMiddle ? 0 : 1,
  });

  return (
    <span
      aria-hidden="true"
      className={className}
      style={{ position: "relative", display: "inline-block", width: size, height: size }}
    >
      <span style={bar(-offset, 45, false)} />
      <span style={bar(0, 0, true)} />
      <span style={bar(offset, -45, false)} />
    </span>
  );
}

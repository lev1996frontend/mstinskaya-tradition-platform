/**
 * Знак традиции — the club mark, drawn plainly.
 *
 * The emblem is the real club mark (`public/brand/mstinskaya-emblem.svg`), a
 * traced silhouette: 64 subpaths, ~4400 points, 70KB. Drawn as a mask rather
 * than an `<img>` for two reasons — the file is served from `public/` instead
 * of being inlined into the bundle, and a mask lets the mark take whatever
 * colour its surroundings are set in, so it dims and brightens with them
 * instead of being frozen at the white variant's own colour.
 *
 * `currentColor`, not a fixed token: the mark is monochrome and takes the
 * colour of wherever it is placed — light on the archive's near-black ground,
 * black on any light surface — which is the whole reason it no longer needs a
 * second asset or a second component. This replaced a red wax disc the mark
 * used to be struck into; the wax was the only red in the brand furniture and
 * read as a third accent competing with the oxblood the rest of the site
 * spends on actions.
 *
 * It needs real size to read: an earlier simplified crest existed precisely
 * because this much detail turns to mud on a ~26px disc. Don't use it below
 * ~34px without checking what survives.
 */
const EMBLEM_MASK = "url(/brand/mstinskaya-emblem.svg) center / contain no-repeat";

/**
 * `size` is optional: leave it off and the mark fills whatever box it is put
 * in, which is the only way it can be sized responsively — an inline
 * `width`/`height` in px cannot be overridden by a class, and a loader that
 * has to shrink on a phone needs the size to come from CSS.
 *
 * The ~34px floor still applies either way: below it this much detail turns to
 * mud, so a fluid parent needs a `min-width` that respects it.
 */
export function Emblem({ size, className }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={className}
      style={{
        display: "block",
        width: size ?? "100%",
        height: size ?? "100%",
        background: "currentColor",
        WebkitMask: EMBLEM_MASK,
        mask: EMBLEM_MASK,
      }}
    />
  );
}

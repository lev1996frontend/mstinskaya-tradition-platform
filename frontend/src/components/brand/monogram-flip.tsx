"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useAnimate, useReducedMotion } from "framer-motion";

import { Monogram } from "@/components/brand/monogram";
import { Seal } from "@/components/brand/seal";
import { WEAPON_MOTIFS, type WeaponMotifKey } from "@/components/brand/weapon-glyphs";
import { IMPULSE_TAP, TURN_EASE } from "@/lib/motion";

/**
 * The header plate turns over on hover/focus (driven by the enclosing link in
 * `SiteHeader`, so keyboard users get it too) and lands on the next weapon
 * glyph in sequence — a different one each time, cycling in a fixed order so
 * it stays predictable rather than showing a single fixed reverse face.
 *
 * A single 180° turn per toggle (not an extra full spin): a bigger throw-style
 * rotation crosses the edge-on boundary three times instead of once at this
 * icon size, which read as flicker/jitter rather than a flourish.
 *
 * `struck` layers a second, independent gesture on top of the hover flip: a
 * click-triggered сшибка — the same two-seal duel as `clash-card.tsx` (both
 * ported from the design canvas's "Живая сшибка" prototype), scaled down to
 * fit the badge: the current cycling weapon (`weaponIndex`, the same one
 * already on the flip's reverse face) against `opponent` (rolled by the
 * caller — `SiteHeader` — at click time via `randomWeaponMotif()`; picking it
 * here instead would mean calling `Math.random()` during render, which
 * `eslint-plugin-react-hooks`'s purity rule rightly rejects) lunge in from
 * either side and collide where the monogram sits. It briefly
 * *replaces* the flip's own `motion.span` (rather than layering on top of
 * it) — an early version overlaid the two seals over the badge and, at this
 * 36px scale, they mostly just occluded the "М" instead of reading as a
 * duel; swapping avoids both that and any fight between the duel's plain-CSS
 * transforms and the flip's framer-motion-driven ones on the same element.
 */
/** The badge's own fixed box — Tailwind's `size-9` (9 × 4px), independent of
 *  the `size` prop below (which only sizes the glyph *inside* the box). The
 *  "slide" variant needs this as a real number, not a Tailwind class, to
 *  move its two-item row by exactly one box width. */
const BADGE_BOX = 36;

export function MonogramFlip({
  flipped,
  struck = false,
  opponent = "kisten",
  onStrikeEnd,
  size = 20,
  variant = "flip",
}: {
  flipped: boolean;
  struck?: boolean;
  /** The `struck` duel's opponent motif — rolled by the caller, see above. */
  opponent?: WeaponMotifKey;
  onStrikeEnd?: () => void;
  size?: number;
  /** "flip" (default, the header's own mark) turns the plate over in 3D.
   *  "slide" answers the same hover — cycling to the next weapon and back —
   *  with a page turning past rather than a plate flipping over: the column
   *  of the two faces scrolls up to reveal the weapon underneath instead of
   *  rotating. Same state machine, same weapon cycling, a different gesture
   *  for a place that wants to read as "the same mark, not the same
   *  moment" (the footer's own copy of the logo) rather than a literal
   *  duplicate of the header's motion. */
  variant?: "flip" | "slide";
}) {
  const reduceMotion = useReducedMotion();
  const [badgeScope, animateBadge] = useAnimate();
  const [rotation, setRotation] = useState(0);
  const [weaponIndex, setWeaponIndex] = useState(0);
  // Adjusting state on a prop change, done during render rather than in an
  // effect (react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes)
  // — this is the recommended escape hatch for "prop changed -> derive next
  // state" and avoids the extra render an effect-based version would cause.
  const [prevFlipped, setPrevFlipped] = useState(flipped);
  if (flipped !== prevFlipped) {
    setPrevFlipped(flipped);
    setRotation((r) => r + 180);
    if (flipped) {
      setWeaponIndex((current) => (current + 1) % WEAPON_MOTIFS.length);
    }
  }

  // The scale dip used to live in the `motion.span`'s own declarative
  // `animate` prop as `scale: [1, IMPULSE_TAP.scale, 1]`, alongside
  // `rotateX`. Two problems with that: Framer Motion always plays an
  // explicit keyframe array in full whenever it *appears* in `animate` —
  // including on this instance's very first render (this remounts fresh
  // every time the mobile menu panel opens, since it renders its own
  // `<SiteLogo>`), so the badge visibly shrank on every open despite never
  // flipping. Gating that array behind "has this instance mounted yet" (a
  // ref flipped in `useEffect`) didn't fix it either — it just moved the
  // false trigger to whenever this component next re-rendered for *any*
  // reason after mount (e.g. `useAuth`'s `loading` resolving a beat later),
  // since that re-render is what first introduces the array into `animate`.
  //
  // Triggering the dip imperatively from an effect, gated on a ref that
  // starts `true` and flips to `false` on the first run, isn't safe either:
  // React's dev-mode Strict Mode runs a fresh mount's effects *twice*
  // (mount → cleanup → mount again) specifically to catch non-idempotent
  // effects, and a "have I run once" flag is exactly that — the first
  // invocation correctly skips and flips the flag, so the second invocation
  // (same `rotation` value, same effect) now reads the flag as already
  // flipped and plays the dip anyway. Comparing *values* instead of using a
  // boolean is what survives that: both Strict Mode invocations close over
  // the same `rotation`, so storing the last-seen rotation and only
  // animating when it actually differs from that is idempotent no matter
  // how many times this runs with the same input — it only ever fires on a
  // genuine flip, mount or not, dev or prod.
  const prevRotationRef = useRef<number | null>(null);
  useEffect(() => {
    const prev = prevRotationRef.current;
    prevRotationRef.current = rotation;
    if (prev === null || prev === rotation) return;
    if (reduceMotion || variant !== "flip") return;
    animateBadge(badgeScope.current, { scale: [1, IMPULSE_TAP.scale, 1] }, { duration: 0.34, ease: TURN_EASE });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rotation]);

  const { Icon } = WEAPON_MOTIFS[weaponIndex];
  const OpponentIcon = WEAPON_MOTIFS.find((motif) => motif.key === opponent)?.Icon ?? Icon;

  return (
    <span
      className="relative grid size-9 shrink-0 place-items-center"
      // `viewTransitionName: "none"`: the header itself carries one
      // (`site-header.tsx`), and a same-tick navigation snapshots the DOM for
      // that transition mid-frame — which can freeze this flip/сшибка
      // instead of letting it play through. Excluding just this badge from
      // the snapshot keeps the header's own cross-page continuity intact
      // while leaving its animation free to finish on its own clock.
      style={{ perspective: 400, viewTransitionName: "none" }}
      // `.lunge-a-sm`/`.lunge-b-sm` (760ms) outlast `.strike-ring` (650ms)
      // and `.flash` (600ms), all three of which bubble `animationend` here;
      // wait for the lunge specifically so clearing `struck` doesn't unmount
      // the ring/flash overlay while the seals are still mid-collision.
      onAnimationEnd={(event) => {
        if (event.animationName !== "lunge-a-sm" && event.animationName !== "lunge-b-sm") return;
        onStrikeEnd?.();
      }}
    >
      {struck ? (
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-[-15px] inset-y-0 flex items-center justify-center gap-2">
          <span
            className="flash absolute inset-0 m-auto size-9 rounded-full"
            style={{ background: "radial-gradient(circle, rgba(176,42,32,.6), transparent 70%)" }}
          />
          <span className="strike-ring absolute inset-0 m-auto size-6" />
          <span className="lunge-a-sm">
            <Seal size={20} tone="accent" filled>
              <Icon size={9} />
            </Seal>
          </span>
          <span className="lunge-b-sm">
            <Seal size={20} tone="accent" filled>
              <OpponentIcon size={9} />
            </Seal>
          </span>
        </div>
      ) : variant === "slide" ? (
        // Пролистывание: the same two faces as "flip", but a row that
        // scrolls past sideways rather than a plate that turns over — a page
        // leafing left-to-right instead of a coin flipping (and distinct
        // from a vertical scroll too, which read too close to the flip's own
        // up/down-feeling motion at this size). `overflow-hidden` on the
        // mask is what makes the row read as scrolling *behind* a fixed
        // window rather than the badge itself moving.
        <span className="relative size-9 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-[var(--accent)] text-white">
          {/* `width` set explicitly (not left to shrink-to-fit): a
              `display:flex` row is still a block box, and a block box with
              no declared width fills its *parent* (36px) rather than sizing
              to its two 36px children (72px) — which silently turned
              `x: "-50%"` into half the travel actually needed to reveal the
              second face, leaving both half-visible at once instead of
              swapping cleanly. Pixel `x` values (not a percentage) sidestep
              the same ambiguity for the transform itself. */}
          <motion.span
            className="flex flex-row"
            style={{ width: BADGE_BOX * 2 }}
            animate={{ x: flipped ? -BADGE_BOX : 0 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.34, ease: TURN_EASE }}
          >
            <span className="grid size-9 shrink-0 place-items-center">
              <Monogram size={size} />
            </span>
            <span className="grid size-9 shrink-0 place-items-center">
              <Icon size={size} />
            </span>
          </motion.span>
        </span>
      ) : (
        <motion.span
          ref={badgeScope}
          className="grid size-9 place-items-center rounded-[var(--radius-sm)] bg-[var(--accent)] text-white"
          style={{ transformStyle: "preserve-3d" }}
          // rotateX alone here — the scale dip is triggered imperatively by
          // the `isFirstRotation` effect above instead of living in this
          // `animate` prop, see that comment for why.
          animate={{ rotateX: rotation }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.34, ease: TURN_EASE }}
        >
          <span className="grid place-items-center" style={{ backfaceVisibility: "hidden" }}>
            <Monogram size={size} />
          </span>
          <span
            className="absolute inset-0 grid place-items-center"
            style={{ backfaceVisibility: "hidden", transform: "rotateX(180deg)" }}
          >
            <Icon size={size} />
          </span>
        </motion.span>
      )}
    </span>
  );
}

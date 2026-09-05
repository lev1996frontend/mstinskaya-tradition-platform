import { Emblem } from "@/components/brand/emblem";
import { Container } from "@/components/ui";

/**
 * Кистень — what the archive shows while a page is being fetched.
 *
 * Moving between sections used to give no sign that anything was happening:
 * the routes read live data on the server (`cache: "no-store"`), so the old
 * page simply stood there until the new one was ready.
 *
 * The wait is spent watching the one снаряд in this tradition that is *made*
 * to go round: a кистень is a weight on a cord, and swinging it is the whole
 * technique. So the loader is not a ring with a gap in it that happens to
 * rotate — it is the object doing the thing the object does, with the club
 * mark standing still at the middle holding it. A circular orbit because that
 * is what a swung weight actually travels.
 *
 * Read in one glance it should say: mark → chain → weight → the air behind it.
 *
 * The chain lies *along* the orbit rather than out across it, and that is the
 * whole reason it reads as a chain. Drawn radially it has only the ~20px
 * between the emblem and the ring to live in — five pixels a link, and five
 * pixels can only ever be a dot, which is what the first two attempts here
 * produced. Along the arc a link is 12 units and can be a proper link:
 * alternating full and edge-on ovals overlapping at the ends, which is what a
 * chain looks like from the side and what makes links interlock instead of
 * queue.
 *
 * The weight rides its own group so it can lag: the swing is not linear, and
 * the weight runs the same keyframes a beat later, so the gap between chain
 * and weight opens and closes through every turn. That is the whole of the
 * inertia — nothing measures anything, it is two clocks a little out of step.
 * The lag is kept to about 5° because the ball rests only ~12° off the last
 * link; more and it comes off the end of its own chain.
 *
 * Behind the ball, three thin arcs struck on the orbit's own radius: the air
 * it has just gone through. They ride the weight's group, so they are part of
 * its movement and not a fourth thing circling the mark, and they run on the
 * swing's own period — longest where the turn is quickest, shortest where it
 * eases. Under reduced motion they simply do not draw, which is right: a
 * speed trail on something that is not moving would be a lie.
 *
 * It replaced an abstract gold arc travelling a seal. The arc was fine and
 * read as "loading"; it just as easily belonged to any other site.
 *
 * One thing asked for is deliberately absent: a decelerating stop at the end
 * of the wait. `loading.tsx` is a Suspense fallback — React swaps it for the
 * page the instant the page is ready, and there is no "ending" to animate
 * without holding the content back to play one. The swing is slow and eased
 * for the same reason a hard stop would have been jarring; it simply never
 * gets to finish, which is what arriving looks like.
 *
 * Sizing is fluid (`clamp`), not fixed. At a flat 132px this filled 41% of a
 * 320px phone. The floor is set by the mark rather than by taste: this emblem
 * is fine detail that turns to mud much under ~34px, and at the smallest box
 * the mark is a third of it.
 *
 * In the page body and not over the screen: a section is being turned to, not
 * the whole site blocked, so the header and the margin river stay usable. Not
 * the river's own boat, which shows how far down a page the reader is —
 * giving it a second job is a mistake this codebase has already made and
 * undone once.
 */
export function RouteLoading({ label = "Поднимаем лист" }: { label?: string }) {
  return (
    <Container className="py-24 sm:py-32">
      {/* `role="status"` with a polite live region: a sighted reader has the
          кистень, and everyone else should be told the page is on its way
          rather than meeting silence. */}
      <div role="status" aria-live="polite" className="grid place-items-center gap-6">
        <span className="lot-loader" aria-hidden="true">
          <svg viewBox="0 0 120 120" fill="none" className="lot-loader-field">
            {/* The circle the weight travels, drawn faintly so the knot has
                somewhere to be rather than swinging in nothing. */}
            <circle cx="60" cy="60" r="50" stroke="var(--iron)" strokeWidth="1" opacity="0.6" />

            {/* Цепь — four links lying *along* the orbit, not out across it.
                That is what makes them links instead of beads: a chain drawn
                radially has only the ~20px between the emblem and the ring to
                live in, which is 5px a link, and five pixels can only ever be
                a dot. Following the arc it has the better part of a quarter
                turn, so a link is 12 units long and reads as one.

                Alternating full and edge-on ovals, overlapping at the ends: a
                chain seen from the side is exactly that, every other link
                turned ninety degrees and foreshortened. The overlap is what
                makes them interlock rather than queue.

                The leading link crosses the trajectory circle, which is where
                the chain is made fast; from there it falls away inward — the
                radius dips from 50 to 45.5 across the middle links and comes
                back — so the chain hangs with some slack under the weight
                instead of lying out straight. */}
            <g className="lot-loader-chain">
              <ellipse
                cx="104.94" cy="81.92" rx="6.2" ry="3.3"
                transform="rotate(116 104.94 81.92)"
                stroke="var(--gold)" strokeWidth="1.2"
              />
              <ellipse
                cx="106.17" cy="72.37" rx="6.2" ry="1.9"
                transform="rotate(105 106.17 72.37)"
                stroke="var(--gold)" strokeWidth="1.2"
              />
              <ellipse
                cx="105.40" cy="63.20" rx="6.2" ry="3.3"
                transform="rotate(94 105.40 63.20)"
                stroke="var(--gold)" strokeWidth="1.2"
              />
              <ellipse
                cx="107.44" cy="54.17" rx="6.2" ry="1.9"
                transform="rotate(83 107.44 54.17)"
                stroke="var(--gold)" strokeWidth="1.2"
              />
            </g>

            {/* Утяжелитель и воздух за ним. Both on the lagging group, so the
                trail is part of the weight's own movement rather than a third
                thing going round the mark.

                The weight sits close enough to the last link that the lag
                never pulls it off the chain — the resting gap and the lag are
                sized against each other, ~12° apart and ~5° of lag. */}
            <g className="lot-loader-weight">
              {/* Три следа в воздухе. Arcs struck on the orbit's own radius, so
                  they carry its curvature exactly; nearest is longest and
                  least faint, and each fades and shortens toward the tail.
                  `pathLength="1"` normalises them so one dash rule shortens
                  all three regardless of their real length. */}
              <g className="lot-loader-trail">
                <path
                  d="M103.70 36.76 A49.5 49.5 0 0 0 99.53 30.21"
                  pathLength="1" strokeDasharray="1"
                  stroke="var(--gold)" strokeWidth="0.9" strokeLinecap="round"
                  style={{ "--trail": "0.24" } as Record<string, string>}
                />
                <path
                  d="M97.36 27.52 A49.5 49.5 0 0 0 93.76 23.79"
                  pathLength="1" strokeDasharray="1"
                  stroke="var(--gold)" strokeWidth="0.8" strokeLinecap="round"
                  style={{ "--trail": "0.14", animationDelay: "-0.12s" } as Record<string, string>}
                />
                <path
                  d="M91.15 21.53 A49.5 49.5 0 0 0 88.39 19.45"
                  pathLength="1" strokeDasharray="1"
                  stroke="var(--gold)" strokeWidth="0.7" strokeLinecap="round"
                  style={{ "--trail": "0.08", animationDelay: "-0.24s" } as Record<string, string>}
                />
              </g>

              {/* Filled on the ground colour first so neither the trajectory
                  nor a trail shows through the metal. Heavier line than the
                  links carry, and a hair wider across: at the same weight of
                  stroke it read as one more ring on the end of the chain
                  rather than as the thing the chain is carrying. */}
              <circle cx="106.80" cy="43.88" r="6.9" fill="var(--background-deep)" />
              <circle cx="106.80" cy="43.88" r="6.9" stroke="var(--gold)" strokeWidth="2.1" />
              {/* Штриховка — three chords across it, the way mass is shaded in
                  a plate engraving. It is what separates the ball from the
                  links without making it any bigger than it needs to be. */}
              <path
                d="M102.71 40.00 L105.97 49.46 M105.17 39.15 L108.43 48.61 M107.63 38.30 L110.89 47.76"
                stroke="var(--gold)"
                strokeWidth="0.8"
                opacity="0.55"
              />
            </g>
          </svg>
          <span className="lot-loader-mark">
            {/* No `size`: the mark fills its box so the whole loader can be
                sized in one place. Colour stated, not inherited — the field
                around it is drawn in iron and gold. */}
            <Emblem className="text-[var(--foreground)]" />
          </span>
        </span>
        <span className="record-label text-[var(--text-4)]">{label}</span>
      </div>
    </Container>
  );
}

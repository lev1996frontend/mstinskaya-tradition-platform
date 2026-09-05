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
 * to go round. What has to read, in one glance, is not an ornament circling a
 * logo but somebody working a кистень:
 *
 *     рукоять -> натянутая цепь -> тяжёлый груз -> воздух за ним
 *
 * That comes from two nested rotations, and it is the ratio between them that
 * does the work. The hand walks slowly round the mark (6s); the кистень is
 * spun quickly about the hand (1.1s). A single rotation — which is what every
 * earlier pass had — can only ever look like decoration going round a logo,
 * however the links are drawn.
 *
 * The hand does not spin. It is a grip bar outside the spinning group, the
 * fixed point the whole thing is worked about; the emblem is a symbol at the
 * centre of the composition rather than the pivot.
 *
 * Two numbers decide the rest, and they are arithmetic rather than taste. The
 * ball has to clear the emblem on the inner pass of its loop and stay inside
 * the box on the outer one; with the emblem at 22.8 units those two
 * constraints leave a hand radius of 41 and a chain of 13.4, of which the
 * ball's own body takes 3.2. So there is room for exactly one link. Two would
 * be about 7px each at the loader's largest, which is the bead three previous
 * passes kept producing. A taut line with one link on it says "chain" at every
 * size this loader takes; a queue of small ovals says "beads" at most of them.
 *
 * The ball is deliberately small against the chain — under half its length. An
 * earlier cut had it at nearly three quarters, and a weight that size on a
 * chain that short is a lollipop, not a кистень.
 *
 * The whole кистень is only about a tenth of the box across, against an emblem
 * that is 38% of it, and it cannot be made longer — the pincer above forbids
 * it. So it earns its presence in line weight rather than in size: every
 * stroke in it is a step heavier than the hairline the circle is drawn with.
 *
 * The ball is filled, and that is the single most important line in this file.
 * Drawn as an outline with hatching inside — which it was — the hatching turns
 * to mush at the ~18px it is really rendered at, and what survives is a circle
 * outline: one more link. Filled, the contrast between a thin chain and a
 * dense mass is legible at any size.
 *
 * The ball rides its own copy of the spin, a beat late, so it trails the chain
 * by ~4 degrees: two clocks a little out of step is the whole of the inertia.
 * It is a sibling of the chain, never nested inside it — nested, it would take
 * the chain's rotation *and* its own and spin twice as fast.
 *
 * Behind it, three thin arcs struck on the ball's own epicycle: the air it has
 * just gone through. They ride the ball's group, so they belong to its movement
 * rather than being a fourth thing circling the mark, and they breathe on the
 * spin's period — longest where the turn is quickest. Under reduced motion they
 * do not draw at all, which is right: a speed trail on something that is not
 * moving would be a lie.
 *
 * One thing asked for is deliberately absent: a decelerating stop at the end
 * of the wait. `loading.tsx` is a Suspense fallback — React swaps it for the
 * page the instant the page is ready, and there is no "ending" to animate
 * without holding the content back to play one. The swing is slow and eased
 * for the same reason a hard stop would have been jarring; it simply never
 * gets to finish, which is what arriving looks like.
 *
 * Sizing is fluid (`clamp`), not fixed, and one width scales the whole
 * composition because everything inside is viewBox- or percentage-driven:
 * ~256px at 1920, 100px on a phone. The floor is set by the mark rather than
 * by taste — this emblem is fine detail that turns to mud much under ~34px,
 * and the mark is 38% of the box.
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
            {/* Круг — near enough the outer envelope of the ball's path to be
                its line rather than decoration: the hand walks at 41 and the
                chain is 13.4, so the ball crosses this circle at the far point of
                every loop. It cannot sit exactly on it — clearing the emblem on
                the inner pass and staying in the box on the outer one pins both
                radii, and 41 + 13.4 is what those two constraints leave. */}
            <circle cx="60" cy="60" r="50" stroke="var(--iron)" strokeWidth="1" opacity="0.6" />

            {/* Ход руки. Everything below rides this group, which walks the
                hand slowly round the emblem. The hand itself is at (101, 60) —
                between the mark and the circle — and it does not spin: it is
                the fixed point the кистень is worked about. */}
            <g className="lot-loader-hand">
              {/* Рукоять — a short bar across the line of the chain, held
                  crosswise. Not a ring: a ring here is one more link, which is
                  precisely the confusion this whole pass is undoing. It sits
                  outside the spinning group, so it stays put while the кистень
                  goes round it. */}
              <path
                d="M100.2 55.9 V64.1"
                stroke="var(--gold)" strokeWidth="2.6" strokeLinecap="round"
              />
              <path d="M100.2 60 H102.6" stroke="var(--gold)" strokeWidth="1.5" strokeLinecap="round" />

              {/* Цепь — taut, straight out from the hand: a drawn line with a
                  single link on it, and the link count is arithmetic rather
                  than taste. The ball has to clear the emblem on its inner pass
                  and stay in the box on its outer one, which pins the chain at
                  13.4 units; the ball's own body takes 3.2 of those, leaving
                  about 9 for chain. One link in that space is ~15px at the
                  loader's full size and reads as a link. Two are 7px each,
                  which is precisely the bead this pass exists to stop drawing.

                  The line is what carries the read at small sizes — a taut cord
                  from a grip to a heavy ball is legible long after any link
                  detail has closed up. */}
              <g className="lot-loader-flail">
                <path d="M102.4 60 H111.6" stroke="var(--gold)" strokeWidth="1.5" strokeLinecap="round" />
                <ellipse cx="106.9" cy="60" rx="3.4" ry="2.2" stroke="var(--gold)" strokeWidth="1.5" />
              </g>

              {/* Груз и воздух за ним, on their own copy of the spin so the
                  ball can trail the chain by a few degrees. A sibling of the
                  chain, never nested inside it — nested, it would take the
                  chain's rotation *and* its own and spin twice as fast. */}
              <g className="lot-loader-weight">
                {/* Воздушный след — arcs struck on the ball's own epicycle,
                    centred on the hand at radius 13.4, so they lie exactly where
                    it has just been. Nearest is longest and least faint.
                    `pathLength="1"` normalises them, so one dash rule shortens
                    all three despite their different real lengths. */}
                <g className="lot-loader-trail">
                  <path
                    d="M113.59 55.42 A13.4 13.4 0 0 0 110.31 50.36"
                    pathLength="1" strokeDasharray="1"
                    stroke="var(--gold)" strokeWidth="1.1" strokeLinecap="round"
                    style={{ "--trail": "0.3" } as Record<string, string>}
                  />
                  <path
                    d="M108.88 49.16 A13.4 13.4 0 0 0 103.79 46.89"
                    pathLength="1" strokeDasharray="1"
                    stroke="var(--gold)" strokeWidth="0.95" strokeLinecap="round"
                    style={{ "--trail": "0.17", animationDelay: "-0.05s" } as Record<string, string>}
                  />
                  <path
                    d="M101.00 46.60 A13.4 13.4 0 0 0 96.86 47.26"
                    pathLength="1" strokeDasharray="1"
                    stroke="var(--gold)" strokeWidth="0.8" strokeLinecap="round"
                    style={{ "--trail": "0.09", animationDelay: "-0.1s" } as Record<string, string>}
                  />
                </g>

                {/* Утяжелитель — solid, and that is the whole point. Drawn as
                    an outline with hatching inside it, at the ~15px this is
                    really rendered at, the hatching turns to mush and what
                    survives is a circle outline: one more link. Filled, the
                    contrast between a thin chain and a dense mass is legible at
                    any size the loader ever takes. */}
                <circle cx="114.4" cy="60" r="3.2" fill="var(--gold)" />
                {/* One lit edge, upper-left, so it reads as a ball rather than
                    a disc. */}
                <path
                  d="M112.36 59.26 A2.18 2.18 0 0 1 115.14 57.96"
                  stroke="var(--gold-strong)" strokeWidth="1.1" strokeLinecap="round" opacity="0.75"
                />
              </g>
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

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
 * Read in one glance it should say: mark → chain → weight. That ordering is
 * why the chain is three open ovals with every other one turned across, and
 * not the row of small circles it started as — circles at this size are dots,
 * and a row of dots is a loading bar bent into a ring, which is the exact
 * thing this is not. The links stop short of the emblem so the chain hangs
 * off the mark instead of crossing it.
 *
 * The weight rides its own group so it can lag: the swing is not linear, and
 * the weight runs the same keyframes a beat later, so the gap between chain
 * and weight opens and closes through every turn. That is the whole of the
 * inertia — nothing measures anything, it is two eased clocks a little out of
 * step.
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

            {/* Цепь. Links running outward from the mark, drawn as open ovals
                with every other one turned across — which is what makes a row
                of small shapes read as a chain rather than as loose dots. They
                stop short of the emblem: the chain hangs off the mark, it
                never crosses it.

                The chain is split across the two rotating groups on purpose.
                With every link in the leading group the chain stayed a rigid
                straight line and the trailing weight simply looked detached
                from it; carrying the last link over into the weight's group
                puts the articulation *inside* the chain, so what lags reads as
                the chain bending under the weight rather than the weight
                coming off it. */}
            <g className="lot-loader-chain">
              <ellipse cx="88" cy="60" rx="3.4" ry="2.3" stroke="var(--gold)" strokeWidth="1.15" opacity="0.7" />
              <ellipse cx="94" cy="60" rx="2.3" ry="3.4" stroke="var(--gold)" strokeWidth="1.15" opacity="0.85" />
            </g>

            {/* Утяжелитель — the last link and the weight, trailing together.
                Filled on the ground colour first so the trajectory line never
                shows through, then the woven ring of an обезьяний кулак: a
                band across, not a plain disc. */}
            <g className="lot-loader-weight">
              <ellipse cx="100" cy="60" rx="3.4" ry="2.3" stroke="var(--gold)" strokeWidth="1.15" />
              <circle cx="110" cy="60" r="6.2" fill="var(--background-deep)" />
              <circle cx="110" cy="60" r="6.2" stroke="var(--gold)" strokeWidth="1.9" />
              <path
                d="M110 54.6 V65.4 M104.6 60 H115.4"
                stroke="var(--gold)"
                strokeWidth="1"
                opacity="0.5"
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

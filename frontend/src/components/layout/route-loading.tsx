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
 * mark standing still at the middle holding the cord. A circular orbit
 * because that is what a swung weight actually travels; the trail behind the
 * knot is where it has just been.
 *
 * It replaced an abstract gold arc travelling a seal. The arc was fine and
 * read as "loading"; it just as easily belonged to any other site.
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
            <circle cx="60" cy="60" r="48" stroke="var(--iron)" strokeWidth="1" opacity="0.6" />

            <g className="lot-loader-arm">
              {/* Where it has just been. Three ghosts rather than a gradient
                  stroke: a fading tail on a rotating arc reads as a comet,
                  and this is a weight on a cord, not a light. */}
              <circle cx="108" cy="60" r="6" fill="var(--gold)" opacity="0.12" transform="rotate(-46 60 60)" />
              <circle cx="108" cy="60" r="6" fill="var(--gold)" opacity="0.22" transform="rotate(-30 60 60)" />
              <circle cx="108" cy="60" r="6" fill="var(--gold)" opacity="0.4" transform="rotate(-15 60 60)" />

              {/* The cord, with the same kink `KistenIcon` gives it — a rope
                  under load is not a straight line to the hand. */}
              <path
                d="M86 60 L95.5 58.6 L94 61.6 L101.4 60"
                stroke="var(--gold)"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Обезьяний кулак — the knot on the end, woven, which is why it
                  is a ring with bands across and not a plain dot. Drawn on a
                  filled ground so the trail behind it never shows through the
                  leading weight. */}
              <circle cx="108" cy="60" r="6.2" fill="var(--background-deep)" />
              <circle cx="108" cy="60" r="6.2" stroke="var(--gold)" strokeWidth="2" />
              <path
                d="M108 54.2 V65.8 M102.2 60 H113.8"
                stroke="var(--gold)"
                strokeWidth="1.1"
                opacity="0.6"
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

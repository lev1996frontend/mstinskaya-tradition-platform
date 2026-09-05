import { Emblem } from "@/components/brand/emblem";
import { Container } from "@/components/ui";

/**
 * Прорисовка — what the archive shows while a page is being fetched.
 *
 * Moving between sections used to give no sign that anything was happening:
 * the routes read live data on the server (`cache: "no-store"`), so the old
 * page simply stood there until the new one was ready.
 *
 * A scribe goes round the circle and the mark comes up behind him, sector by
 * sector, the way a figure is drawn with a stick in sand. Three things move on
 * one clock and they are the same thing seen three ways: the furrow being cut
 * round the rim, the point cutting it, and the mark inking in behind it.
 *
 * This replaced four passes at a кистень being swung, and the reason they all
 * failed is worth keeping. The physics pinned the weapon to about a tenth of
 * the box across, and no amount of redrawing makes a recognisable object out
 * of ten pixels of chain — it stayed a small gold squiggle beside a large
 * emblem however the links were shaped. The lesson is not about chains: **at
 * this size the composition has to be the subject, not an object placed on
 * it.** Here nothing is small. The circle, the mark and the sweep are the
 * whole drawing.
 *
 * The mark never disappears. It sits at a fifth of its strength from the first
 * frame and the sweep fills it to full, so a 200ms navigation shows the club's
 * emblem rather than an empty ring — a loader that starts from nothing looks,
 * on a short wait, exactly like an image that failed to load.
 *
 * Мера. `--sweep` is a real registered angle (`@property`), which is what makes
 * a `conic-gradient` animate at all: an unregistered custom property is a
 * string to the interpolator and would snap from 0 to 360 with nothing in
 * between. The ink layer is masked by that gradient; the emblem's own artwork
 * is already a mask on the element inside it, and two masks cannot live on one
 * element — hence the wrapper.
 */
export function RouteLoading({ label = "Поднимаем лист" }: { label?: string }) {
  return (
    <Container className="py-24 sm:py-32">
      {/* `role="status"` with a polite live region: a sighted reader has the
          drawing, and everyone else should be told the page is on its way
          rather than meeting silence. */}
      <div role="status" aria-live="polite" className="grid place-items-center gap-6">
        <span className="lot-loader" aria-hidden="true">
          <svg viewBox="0 0 120 120" fill="none" className="lot-loader-field">
            {/* Песок — the untouched ground the furrow is cut into. Always
                whole, so the circle never looks broken between passes. */}
            <circle cx="60" cy="60" r="50" stroke="var(--iron)" strokeWidth="1" opacity="0.55" />

            {/* Борозда — the furrow itself, drawn from the top clockwise.
                `pathLength="1"` normalises the circle so one dash rule draws
                it regardless of its real circumference; the `rotate(-90)` is
                what starts it at twelve o'clock instead of three, matching the
                `from -90deg` the ink mask sweeps from. */}
            <circle
              className="lot-loader-furrow"
              cx="60" cy="60" r="50"
              transform="rotate(-90 60 60)"
              pathLength="1" strokeDasharray="1"
              stroke="var(--gold)" strokeWidth="1.4" strokeLinecap="round"
            />

            {/* Грифель — the point doing the cutting, and the only small thing
                in the composition. It is allowed to be small because it is not
                what has to be recognised: it is a point, and a point reads at
                any size. */}
            <g className="lot-loader-scribe">
              {/* A short radial lead-in, kept in the gap between the mark and
                  the rim. Drawn further in it crossed the emblem's own artwork
                  and read as a line struck through the crest. */}
              <path d="M60 16 V26" stroke="var(--gold)" strokeWidth="1.4" strokeLinecap="round" opacity="0.45" />
              <circle cx="60" cy="10" r="2.6" fill="var(--gold)" />
              <path d="M60 4.4 V15.6" stroke="var(--gold)" strokeWidth="1.6" strokeLinecap="round" />
            </g>
          </svg>

          <span className="lot-loader-mark">
            {/* Two layers of the same mark: the faint one is always whole, the
                full-strength one is revealed by the sweep. Colour stated, not
                inherited — the field around it is drawn in iron and gold. */}
            <span className="lot-loader-ghost">
              <Emblem className="text-[var(--foreground)]" />
            </span>
            <span className="lot-loader-ink">
              <Emblem className="text-[var(--foreground)]" />
            </span>
          </span>
        </span>
        <span className="record-label text-[var(--text-4)]">{label}</span>
      </div>
    </Container>
  );
}

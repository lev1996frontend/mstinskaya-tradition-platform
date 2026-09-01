import { InterlacePattern } from "@/components/brand/interlace-pattern";
import { ButtonLink, Container } from "@/components/ui";
import { HelmetReveal } from "@/features/home/helmet-reveal";
import { HeroClashProvider, HeroIllustration, HeroIllustrationToggle, HeroTraditionSeals } from "@/features/home/hero-clash";
import type { WeaponRulesView } from "@/types";

/**
 * The masthead of the archive — the front page of a ledger, not a centred
 * marketing hero.
 *
 * Composition: a stamped strapline rule across the top, then a near-even 6/6
 * split with the title block hanging off a heavy oxblood rule on the left and
 * the protective-mask plate captioned like an archival illustration on the
 * right, closed by the "Знаки традиции" catalog row.
 *
 * Vertical rhythm: an earlier pass reserved a flat `min-h-[560px]` under the
 * illustration so swapping mask ⇄ опись never collapsed the column, then
 * removed it outright as taller than either plate's real content (mask
 * ~473px, опись ~492px — close enough on their own that the min-height was
 * pure dead space). That reasoning missed a third state: the "Живая сшибка"
 * `ClashCard` a знак/амуниция/logo click swaps in, only ~395px tall — a real
 * ~80–100px height drop with nothing reserving the difference, which made
 * the "Знаки традиции" row (and everything below it) visibly jump on every
 * duel trigger and again when it ended. Fixed by reserving `min-h-[495px]`
 * on the illustration alone (not the docked toggle strip below it) — sized
 * to the tallest of the three real states (опись), not an arbitrary bigger
 * guess, so it costs nothing when опись or the mask are showing and only
 * pads the genuinely-shorter `ClashCard` state up to match.
 *
 * Motion: this file used to stagger the eyebrow, h1, paragraph and buttons in
 * on mount with opacity+y fades. That is gone. Exactly one element animates —
 * the h1, via the CSS-only `.stamp-in` (fast, slightly over-scaled, no drift),
 * which also let this whole section drop back to a server component with no
 * framer-motion in the bundle. `prefers-reduced-motion` neutralises it through
 * the global override in globals.css.
 */
export function Hero({ rules }: { rules: WeaponRulesView | null }) {
  return (
    <section id="krug" className="relative overflow-hidden border-b-2 border-[var(--rule)] bg-[var(--surface)]">
      <InterlacePattern className="text-[var(--accent)]" />

      <Container wide className="relative">
        {/* strapline — what this document covers, stated the way a masthead
            states its sections. Used to repeat the main nav's own labels in
            the middle (Обучение · Правила · ...) — pure duplication of the
            header just above, removed; the language tag stays, it's the one
            thing here the header doesn't already say. */}
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-b border-[var(--border)] py-3">
          <span className="record-label text-[var(--chrome-muted)]">Цифровой архив сообщества</span>
          <span className="record-label text-[var(--muted)]">RU</span>
        </div>

        <HeroClashProvider>
          <div className="grid items-center gap-10 py-8 lg:grid-cols-12 lg:gap-14 lg:py-10">
            <div className="lg:col-span-6">
              <div className="border-l-2 border-[var(--accent)] pl-5 sm:pl-7">
                <p className="record-label text-[var(--accent)]">Цифровая платформа сообщества</p>
                <h1 className="stamp-in font-display mt-4 text-balance text-[2.75rem] font-semibold leading-[0.95] tracking-[-0.02em] sm:text-6xl xl:text-[4.5rem]">
                  Мстинская традиция
                </h1>
              </div>

              <p className="mt-7 max-w-xl text-[0.9375rem] leading-[1.75] text-[var(--muted)] sm:pl-7">
                Единое пространство для обучения, правил, судейства, клубов и соревнований. Турнирный
                модуль ведёт участников, команды, жеребьёвку, сетку и результаты — с полной историей
                изменений.
              </p>

              <div className="mt-8 flex flex-wrap gap-3 sm:pl-7">
                <ButtonLink href="/tournaments" size="lg">
                  Смотреть турниры
                </ButtonLink>
                <ButtonLink href="/rules" variant="secondary" size="lg">
                  Правила и регламенты
                </ButtonLink>
              </div>
            </div>

            {/* archival plate: each state (mask, опись, сшибка) is a
                self-contained bordered plate with its own caption/label — see
                `helmet-reveal.tsx`, `hero-clash.tsx`'s `EquipmentPlate`, and
                `clash-card.tsx` — so this figure just picks which one shows.
                At rest it's the mask or the опись plate (toggle below),
                whichever `mode` is active; either way it swaps to the "Живая
                сшибка" plate while a знак/амуниция/logo-triggered duel holds.
                Shown on every breakpoint, not just `lg`+: label→h1→
                description→buttons THEN the exhibit on mobile too, not the
                exhibit dropped entirely — `helmet-reveal.tsx` already has its
                own touch-appropriate static fallback (no pointer tracking,
                just a fixed legible face) for exactly this case.

                The toggle link is docked directly onto the plate as a footer
                strip sharing its left/right/bottom border (`border-t-0`)
                rather than floating below it — it reads as a control on the
                card, not a stray link sitting in the page's own whitespace. */}
            <figure className="lg:col-span-6">
              <div className="min-h-[495px]">
                <HeroIllustration mask={<HelmetReveal />} />
              </div>
              <div className="flex items-center justify-end border border-t-0 border-[var(--border-strong)] bg-[var(--surface-muted)] px-4 py-2.5">
                <HeroIllustrationToggle />
              </div>
            </figure>
          </div>

          {/* "Знаки традиции" — a self-contained bordered catalog block (own
              header row + numbered, ruled entries), not a label sitting
              beside a loose row of icons; see `HeroTraditionSeals` for the
              ledger layout itself. This wrapper only supplies the outer
              separation from the grid above. */}
          <div className="border-t border-[var(--border)] py-6 sm:py-8">
            <HeroTraditionSeals rules={rules} />
          </div>
        </HeroClashProvider>
      </Container>
    </section>
  );
}

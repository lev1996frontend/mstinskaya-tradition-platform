import { InterlacePattern } from "@/components/brand/interlace-pattern";
import { WeaponSeal } from "@/components/brand/seal";
import { WEAPON_MOTIFS } from "@/components/brand/weapon-glyphs";
import { ButtonLink, Container } from "@/components/ui";
import { HelmetReveal } from "@/features/home/helmet-reveal";

/**
 * The masthead of the archive — the front page of a ledger, not a centred
 * marketing hero.
 *
 * Composition: a stamped strapline rule across the top, then an asymmetric
 * 7/5 split with the title block hanging off a heavy oxblood rule on the left
 * and the protective-mask plate captioned like an archival illustration on the
 * right, closed by the issuing seal row.
 *
 * Motion: this file used to stagger the eyebrow, h1, paragraph and buttons in
 * on mount with opacity+y fades. That is gone. Exactly one element animates —
 * the h1, via the CSS-only `.stamp-in` (fast, slightly over-scaled, no drift),
 * which also let this whole section drop back to a server component with no
 * framer-motion in the bundle. `prefers-reduced-motion` neutralises it through
 * the global override in globals.css.
 */
export function Hero() {
  return (
    <section id="krug" className="relative overflow-hidden border-b-2 border-[var(--rule)] bg-[var(--surface)]">
      <InterlacePattern className="text-[var(--accent)]" />

      <Container wide className="relative">
        {/* strapline — what this document covers, stated the way a masthead
            states its sections */}
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-b border-[var(--border)] py-3">
          <span className="record-label text-[var(--chrome-muted)]">Цифровой архив сообщества</span>
          <span className="record-label hidden text-[var(--muted)] md:inline">
            Обучение · Правила · Судейство · Клубы · Турниры
          </span>
          <span className="record-label text-[var(--muted)]">RU</span>
        </div>

        <div className="grid items-start gap-10 py-12 lg:grid-cols-12 lg:gap-14 lg:py-16">
          <div className="lg:col-span-7">
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

          {/* archival plate: the illustration is captioned and numbered rather
              than floated as decoration */}
          <figure className="hidden lg:col-span-5 lg:block">
            <div className="border-t border-[var(--rule)] pt-6">
              <HelmetReveal />
            </div>
            <figcaption className="record-label mt-4 border-t border-[var(--border)] pt-2.5 text-[var(--muted)]">
              Ил. 01 — защитная маска
            </figcaption>
          </figure>
        </div>

        {/* issuing seals — the four motifs as one set, in the shared frame.
            Centred as a stacked block on phones (the row reads as a single
            emblem there, not a left-aligned list trailing off), reverting to
            the left-aligned masthead row from `sm` up. */}
        <div className="flex flex-col items-center gap-4 border-t border-[var(--border)] py-6 text-center sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-8 sm:gap-y-5 sm:text-left">
          <span className="record-label text-[var(--chrome-muted)]">Знаки традиции</span>
          {/* the captions are wider than the seals, so the row is allowed to
              wrap into two lines at phone width rather than being squeezed */}
          <div className="flex flex-wrap items-start justify-center gap-x-6 gap-y-5 sm:justify-start sm:gap-x-8">
            {WEAPON_MOTIFS.map((motif) => (
              <WeaponSeal key={motif.key} motif={motif.key} size={38} tone="iron" showLabel />
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}

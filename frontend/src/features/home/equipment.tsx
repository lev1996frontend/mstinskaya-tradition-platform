import { WeaponGlyph } from "@/features/tournaments/weapon-mark";
import { Container, EmptyState } from "@/components/ui";
import type { WeaponRulesView } from "@/types";

/**
 * Л. 08 «Снаряжение» — the four lot-drawn categories, rendered straight from
 * `GET /api/v1/bout-rules`. Unlike the demo copy in the design handoff
 * (which hardcodes "рукавицы · маска" etc. as prototype filler), every label
 * and spec line here is either the API's own `label_ru`/`armed`/`actions`, or
 * a generic, clearly-presentational sentence that asserts nothing the
 * backend didn't say — this domain's rules are real and partly still
 * unconfirmed upstream (see docs/domain-model.md §5), so nothing is invented.
 */

const ru = new Intl.NumberFormat("ru-RU");

/** One factual, non-invented line per category: armed/unarmed from `armed`,
 *  plus the real staging note where it applies (нож/палка share one staging
 *  concern in the source rules) — never fabricated equipment materials. */
function describe(weapon: WeaponRulesView["weapons"][number], rules: WeaponRulesView): string {
  if (!weapon.armed) {
    return `«${weapon.label_ru}» — безоружный разряд: сходка идёт без какого-либо снаряда, одним приёмом.`;
  }
  if ((weapon.code === "NOZH" || weapon.code === "PALKA") && rules.staging_note_nozh_vs_palka) {
    return rules.staging_note_nozh_vs_palka;
  }
  return `«${weapon.label_ru}» — один из вооружённых разрядов традиции.`;
}

export function Equipment({ rules }: { rules: WeaponRulesView | null }) {
  return (
    <section
      id="snaryazhenie"
      className="border-y border-[var(--border)] bg-[var(--background-deep)] py-16 sm:py-20"
    >
      <Container wide>
        <div className="flex flex-col gap-4 border-b border-[var(--border)] pb-8 sm:flex-row sm:items-end sm:justify-between sm:gap-10">
          <div>
            <p className="record-label text-[var(--gold)]">Л. 08 · Опись снаряжения</p>
            <h2 className="font-display mt-3 text-3xl font-semibold leading-[1] tracking-[-0.015em] sm:text-[3rem]">
              Чем бьются
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-[1.65] text-[var(--text-3)] sm:text-right">
            Четыре разряда, заявленных в регламенте: один безоружный и три с собственным снарядом
            — жребий на сходке решает, каким разряд пойдёт бой.
          </p>
        </div>

        {rules ? (
          <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
            <ArchivalCrop />
            <EquipmentList rules={rules} />
          </div>
        ) : (
          <div className="mt-10">
            <EmptyState
              title="Опись снаряжения недоступна"
              description="Не удалось получить регламент разрядов с сервера. Список появится, как только API снова будет отвечать."
            />
          </div>
        )}
      </Container>
    </section>
  );
}

/**
 * Left panel — a cropped archival drawing (819×1000 source, rukavitsy /
 * kaftans / belts / hats in the lower-left of frame).
 *
 * The crop scale lives on this wrapper `<div>`, never on the `<img>` itself,
 * and neither element carries `.ken`/`.drift`/`.unmask` — the handoff calls
 * out exactly this collision (a continuous transform animation stacked on a
 * static crop `scale()` fights the same CSS property and the crop just stops
 * landing on the detail the caption promises). This section has no zoom
 * animation on purpose; keep it that way.
 */
function ArchivalCrop() {
  return (
    <figure className="flex flex-col">
      <div className="relative min-h-[420px] flex-1 overflow-hidden border border-[var(--border)] bg-[var(--surface-muted)]">
        <div
          className="absolute inset-0"
          style={{ transform: "scale(1.55)", transformOrigin: "46% 52%" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- project convention: no next/image anywhere, no remote-image config */}
          <img
            src="/archive/kulachnoy-boy-risunok.jpg"
            alt="«Кулачной бой!», рисунок с натуры — рукавицы, кафтаны, пояса и шапки бойцов"
            className="h-full w-full object-cover"
            style={{
              objectPosition: "46% 52%",
              filter: "sepia(.3) contrast(1.06) brightness(.92)",
            }}
          />
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[var(--background-deep)] to-transparent"
        />
      </div>
      <figcaption className="mt-4 border-t border-[var(--border)] pt-3">
        <p className="font-display text-lg font-semibold leading-tight">
          «Кулачной бой!», рисунок с натуры
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-3)]">
          На листе — рукавицы бойцов, кафтаны, пояса и шапки.
        </p>
        <p className="record-label mt-2 text-[var(--text-4)]">
          Архив сообщества · происхождение уточняется
        </p>
      </figcaption>
    </figure>
  );
}

function EquipmentList({ rules }: { rules: WeaponRulesView }) {
  return (
    <div className="flex flex-col gap-px border border-[var(--border)] bg-[var(--border)]">
      {rules.weapons.map((weapon) => {
        const actionCount = rules.actions.filter((action) => action.weapon === weapon.code).length;
        return (
          <div
            key={weapon.code}
            className="grid grid-cols-[54px_minmax(0,1fr)] gap-5 bg-[var(--background-deep)] p-5 sm:p-[22px]"
          >
            <div className="flex h-[54px] w-[54px] items-center justify-center border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--gold)]">
              <WeaponGlyph weapon={weapon.code} size={26} />
            </div>
            <div className="min-w-0">
              {/* flex-wrap, not a fixed nowrap column — the handoff's own bug
                  report: a nowrap spec column steals width from this text
                  column (min-w-0) and the row collapses below ~1100px. */}
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h3 className="font-display text-2xl font-semibold leading-tight">{weapon.label_ru}</h3>
                <span className="record-label text-[0.5625rem] text-[var(--muted)]">
                  {weapon.armed ? "Вооружённый разряд" : "Без оружия"} · приёмов: {ru.format(actionCount)}
                </span>
              </div>
              <p className="mt-2 text-sm leading-[1.6] text-[var(--text-3)]">{describe(weapon, rules)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

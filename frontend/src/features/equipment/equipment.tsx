import Image from "next/image";

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
 *  concern in the source rules) — never fabricated equipment materials.
 *  Exported so `hero-clash.tsx`'s "Знаки традиции" row can show the same
 *  honest one-liner on hover instead of inventing its own description. */
export function describeWeaponRule(weapon: WeaponRulesView["weapons"][number], rules: WeaponRulesView): string {
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
      className="weave-deep border-y border-[var(--border)] bg-[var(--background-deep)] py-16 sm:py-20"
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
 * Left panel — an archival drawing (819×1000 source) framed on the band of
 * fighters, which is what the caption beside it describes.
 *
 * The frame carries its own aspect ratio, and this is the whole point. It used
 * to be `min-h-[420px] flex-1` inside a stretched grid row, so its height came
 * from whatever the разряд list beside it happened to need — which on a wide
 * screen is not much. The frame went landscape (667×433 at 1500px) over a
 * portrait drawing, and with a further `scale(1.55)` on top the visible band
 * was so tight that every fighter lost his head and his feet. The caption
 * promises шапки; шапки were the first thing gone.
 *
 * 5:4 keeps about two thirds of the sheet's height around its middle — the
 * figures run from roughly 30% to 80% down the sheet, so they now sit inside
 * the frame at every width instead of the crop changing with the neighbouring
 * column. The old zoom is gone with the same stroke: `object-cover` into a
 * fixed frame is already the crop.
 *
 * Nothing here carries `.ken`/`.drift`/`.unmask`. The handoff called out the
 * collision when there was a static `scale()` to fight; there no longer is,
 * but this panel still has no zoom animation on purpose — keep it that way.
 */
function ArchivalCrop() {
  return (
    <figure className="flex flex-col">
      <div className="relative aspect-[5/4] w-full overflow-hidden border border-[var(--border)] bg-[var(--surface-muted)]">
        {/* The "no next/image" convention this file used to cite covers images
            served from the API on an arbitrary host, which would need remote
            patterns configured. This one is a local file in `public/`, where
            the optimizer needs no configuration at all and turns a 194 KB JPEG
            into an AVIF a fraction of that. */}
        <Image
          src="/archive/kulachnoy-boy-risunok.jpg"
          alt="«Кулачной бой!», рисунок с натуры — рукавицы, кафтаны, пояса и шапки бойцов"
          fill
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-cover"
          style={{
            /* A shade below centre: above the figures is sky and cloud, below
               them the ground and the sheet's own title. */
            objectPosition: "50% 52%",
            filter: "sepia(.3) contrast(1.06) brightness(.92)",
          }}
        />
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
              <p className="mt-2 text-sm leading-[1.6] text-[var(--text-3)]">{describeWeaponRule(weapon, rules)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

import type { Metadata } from "next";
import { Users } from "lucide-react";
import Link from "next/link";

import { listAthletesWithStatus } from "@/api/catalog";
import { ApiOfflineNotice } from "@/components/api-status";
import { Badge, Container, EmptyState, PageHeader } from "@/components/ui";
import { Avatar } from "@/components/ui/avatar";
import { athleteLevel, athleteLevelTone, labelOf } from "@/lib/labels";

export const metadata: Metadata = {
  title: "Спортсмены",
  description: "Профили спортсменов сообщества Мстинской традиции.",
};

/**
 * A roster is a register, so it is set as one: a ruled row per person, the
 * mask in the left margin, values in the record face so the columns of digits
 * line up down the page.
 *
 * One structure at every width, and one link per row. It used to be a table
 * from `sm` up and a stacked list below it, with the link wrapped around the
 * name only — so the row looked clickable and mostly wasn't, and the same
 * roster existed twice in the markup. Now the whole row is the anchor and the
 * columns are a grid inside it, which is also what lets a row carry the
 * register's shared hover (`.ledger-row`, the treatment the rule editions
 * already use): the wash pulled in from the gutter, the row drawn out under
 * the pointer, the mark lighting up in the margin.
 */
export default async function AthletesPage() {
  const { items: athletes, offline } = await listAthletesWithStatus();

  return (
    <Container className="space-y-8 py-10">
      <PageHeader
        eyebrow="Сообщество"
        title="Спортсмены"
        description="Драковое имя давали в драке и за дело, а не от фамилии: чтобы смерть искала дольше. Рядом — уровень подготовки, опыт и краткая справка."
        actions={
          athletes.length > 0 ? (
            <span className="record-label self-end text-[var(--muted)]">
              {String(athletes.length).padStart(2, "0")} в реестре
            </span>
          ) : undefined
        }
      />

      {athletes.length === 0 ? (
        <div className="space-y-4">
          {offline ? <ApiOfflineNotice /> : null}
          <EmptyState
            title="Профилей пока нет"
            description="Реестр спортсменов заполнится, как только появятся первые записи."
            icon={<Users className="size-5" strokeWidth={1.75} />}
          />
        </div>
      ) : (
        <div>
          {/* The column heads are a row of the same grid, not a <thead>: they
              have to sit exactly over the values they name, and the values live
              inside the links below. Hidden below `sm`, where the row stacks
              and each value is read from its own line instead. */}
          <div className="record-label hidden gap-5 border-b-2 border-[var(--rule)] px-1 pb-2 text-[var(--text-4)] sm:grid sm:grid-cols-[2.5rem_minmax(0,1fr)_9rem_5rem_5rem_1rem] sm:items-end sm:gap-6">
            <span />
            <span>Драковое имя</span>
            <span>Уровень</span>
            <span className="text-right">Опыт, лет</span>
            <span className="text-right">Год рожд.</span>
            <span />
          </div>

          <ul>
            {athletes.map((athlete) => {
              const name = athlete.nickname ?? "Без имени";
              return (
                <li
                  key={athlete.id}
                  className="border-b border-[var(--border)] transition-colors hover:border-[var(--accent)]"
                >
                  <Link
                    href={`/athletes/${athlete.id}`}
                    className="ledger-row group grid grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-x-5 gap-y-3 py-4 sm:grid-cols-[2.5rem_minmax(0,1fr)_9rem_5rem_5rem_1rem] sm:gap-6"
                  >
                    <span className="ledger-row-edge row-span-2 self-start sm:row-span-1 sm:self-center">
                      <Avatar name={name} photoUrl={athlete.photo_url} size="sm" />
                    </span>

                    <span className="min-w-0">
                      <span className="block truncate font-medium transition-colors group-hover:text-[var(--accent)]">
                        {name}
                      </span>
                      {athlete.bio ? (
                        <span className="mt-0.5 line-clamp-1 block text-xs text-[var(--muted)]">
                          {athlete.bio}
                        </span>
                      ) : null}
                    </span>

                    {/* Below `sm` the three values share one line under the
                        name, each labelled, since there are no column heads to
                        read them against. */}
                    <span className="col-start-2 flex flex-wrap items-center gap-x-4 gap-y-2 sm:col-start-auto sm:block">
                      <Badge tone={athleteLevelTone[athlete.level]}>
                        {labelOf(athleteLevel, athlete.level)}
                      </Badge>
                      <span className="font-record text-xs text-[var(--muted)] sm:hidden">
                        Опыт {athlete.experience_years}
                        {athlete.birth_year ? ` · ${athlete.birth_year} г. р.` : ""}
                      </span>
                    </span>

                    <span className="font-record hidden text-right tabular-nums sm:block">
                      {athlete.experience_years}
                    </span>
                    <span className="font-record hidden text-right tabular-nums text-[var(--muted)] sm:block">
                      {athlete.birth_year ?? "—"}
                    </span>

                    <span
                      aria-hidden="true"
                      className="ledger-row-arrow hidden self-center text-[var(--muted)] group-hover:text-[var(--accent)] sm:block"
                    >
                      →
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Container>
  );
}

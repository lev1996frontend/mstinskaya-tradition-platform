import type { Metadata } from "next";
import { Users } from "lucide-react";
import Link from "next/link";

import { listAthletesWithStatus } from "@/api/catalog";
import { ApiOfflineNotice } from "@/components/api-status";
import { Badge, Container, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui";
import { Avatar } from "@/components/ui/avatar";
import { athleteLevel, labelOf } from "@/lib/labels";

export const metadata: Metadata = {
  title: "Спортсмены",
  description: "Профили спортсменов сообщества Мстинской традиции.",
};

/**
 * A roster is a register, so it is set as one rather than as a grid of
 * identical profile cards: one ruled row per person, values (experience, birth
 * year) in the record face so the columns of digits line up, and the short
 * bio kept as a second line under the name so nothing from the old card is
 * lost. Every athlete is still one link to the same detail route.
 */
export default async function AthletesPage() {
  const { items: athletes, offline } = await listAthletesWithStatus();

  return (
    <Container className="space-y-8 py-10">
      <PageHeader
        eyebrow="Сообщество"
        title="Спортсмены"
        description="Участники традиции: уровень подготовки, опыт и краткая справка."
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
        <>
          {/*
            Two forms of the same register, because a four-column table on a
            390px screen is a 576px-wide sideways scroll — the reader has to
            drag the roster around to read a row. Below `sm` the same records
            are stacked as ruled entries with the values on their own line;
            from `sm` up the table proper takes over. Same links, same data,
            same order.
          */}
          <ul className="border-t-2 border-[var(--rule)] sm:hidden">
            {athletes.map((athlete) => (
              <li key={athlete.id}>
                <Link
                  href={`/athletes/${athlete.id}`}
                  className="flex gap-3 border-b border-[var(--border)] py-4"
                >
                  <Avatar name={athlete.nickname ?? "?"} photoUrl={athlete.photo_url} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <span className="min-w-0 truncate font-medium">
                        {athlete.nickname ?? "Без псевдонима"}
                      </span>
                      <Badge tone="info">{labelOf(athleteLevel, athlete.level)}</Badge>
                    </div>
                    {athlete.bio ? (
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--muted)]">
                        {athlete.bio}
                      </p>
                    ) : null}
                    <p className="font-record mt-2 text-xs text-[var(--muted)]">
                      Опыт {athlete.experience_years}
                      {athlete.birth_year ? ` · ${athlete.birth_year} г. р.` : ""}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          <div className="hidden sm:block">
            <Table>
              <thead>
            <tr>
              <Th>Спортсмен</Th>
              <Th>Уровень</Th>
              <Th align="right">
                Опыт, лет
              </Th>
              <Th align="right">
                Год рожд.
              </Th>
            </tr>
          </thead>
          <tbody>
            {athletes.map((athlete) => (
              <tr key={athlete.id} className="transition-colors hover:bg-[var(--surface-muted)]/60">
                <Td>
                  <Link
                    href={`/athletes/${athlete.id}`}
                    className="flex min-w-0 items-start gap-3 hover:text-[var(--accent)]"
                  >
                    <Avatar name={athlete.nickname ?? "?"} photoUrl={athlete.photo_url} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {athlete.nickname ?? "Без псевдонима"}
                      </span>
                      {athlete.bio ? (
                        <span className="mt-0.5 line-clamp-1 block text-xs text-[var(--muted)]">
                          {athlete.bio}
                        </span>
                      ) : null}
                    </span>
                  </Link>
                </Td>
                <Td>
                  <Badge tone="info">{labelOf(athleteLevel, athlete.level)}</Badge>
                </Td>
                <Td align="right" numeric>
                  {athlete.experience_years}
                </Td>
                <Td align="right" numeric className="text-[var(--muted)]">
                  {athlete.birth_year ?? "—"}
                </Td>
              </tr>
            ))}
              </tbody>
            </Table>
          </div>
        </>
      )}
    </Container>
  );
}

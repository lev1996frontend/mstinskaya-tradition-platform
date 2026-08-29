import type { Metadata } from "next";
import Link from "next/link";

import { listAthletes } from "@/api/catalog";
import { ApiOfflineNotice } from "@/components/api-status";
import { Badge, Card, Container, EmptyState, PageHeader } from "@/components/ui";
import { plural } from "@/lib/format";
import { athleteLevel, labelOf } from "@/lib/labels";

export const metadata: Metadata = {
  title: "Спортсмены",
  description: "Профили спортсменов сообщества Мстинской традиции.",
};

export default async function AthletesPage() {
  const athletes = await listAthletes();

  return (
    <Container className="space-y-8 py-10">
      <PageHeader
        eyebrow="Сообщество"
        title="Спортсмены"
        description="Участники традиции: уровень подготовки, опыт и краткая справка."
      />

      {athletes.length === 0 ? (
        <div className="space-y-4">
          <ApiOfflineNotice />
          <EmptyState title="Профилей пока нет" />
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {athletes.map((athlete) => (
            <Card as="li" key={athlete.id} className="transition-colors hover:border-[var(--accent)]">
              <Link href={`/athletes/${athlete.id}`} className="flex h-full flex-col gap-2 p-5">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="min-w-0 truncate font-semibold">
                    {athlete.nickname ?? "Без псевдонима"}
                  </h2>
                  <Badge tone="info">{labelOf(athleteLevel, athlete.level)}</Badge>
                </div>
                <p className="text-sm text-[var(--muted)]">
                  {plural(athlete.experience_years, "год", "года", "лет")} опыта
                  {athlete.birth_year ? ` · ${athlete.birth_year} г. р.` : ""}
                </p>
                {athlete.bio ? (
                  <p className="mt-auto line-clamp-3 text-sm text-[var(--muted)]">{athlete.bio}</p>
                ) : null}
              </Link>
            </Card>
          ))}
        </ul>
      )}
    </Container>
  );
}

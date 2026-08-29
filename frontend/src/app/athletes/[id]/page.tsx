import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getAthlete } from "@/api/catalog";
import { Card, Container, DefinitionList, PageHeader } from "@/components/ui";
import { plural } from "@/lib/format";
import { athleteLevel, labelOf } from "@/lib/labels";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const athlete = await getAthlete(id);
  return { title: athlete?.nickname ?? "Спортсмен" };
}

export default async function AthletePage({ params }: PageProps) {
  const { id } = await params;
  const athlete = await getAthlete(id);
  if (!athlete) notFound();

  return (
    <Container className="max-w-3xl space-y-8 py-10">
      <PageHeader
        eyebrow={<Link href="/athletes">← Все спортсмены</Link>}
        title={athlete.nickname ?? "Профиль спортсмена"}
      />

      <Card className="p-6">
        <DefinitionList
          items={[
            { term: "Уровень", value: labelOf(athleteLevel, athlete.level) },
            {
              term: "Опыт",
              value: plural(athlete.experience_years, "год", "года", "лет"),
            },
            { term: "Год рождения", value: athlete.birth_year ?? "—" },
          ]}
        />
      </Card>

      {athlete.bio ? (
        <Card className="p-6">
          <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]">О себе</h2>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{athlete.bio}</p>
        </Card>
      ) : null}
    </Container>
  );
}

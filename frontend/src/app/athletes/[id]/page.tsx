import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getAthlete } from "@/api/catalog";
import { listAthleteTournamentHistory } from "@/api/tournaments";
import { Card, Container, DefinitionList, PageHeader, Section } from "@/components/ui";
import { Avatar } from "@/components/ui/avatar";
import { AthleteHistory } from "@/features/tournaments/athlete-history";
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
  const [athlete, history] = await Promise.all([getAthlete(id), listAthleteTournamentHistory(id)]);
  if (!athlete) notFound();

  return (
    <Container className="max-w-3xl space-y-8 py-10">
      <PageHeader
        eyebrow={
          <Link href="/athletes" className="hover:underline">
            ← Все спортсмены
          </Link>
        }
        title={
          <span className="flex items-center gap-3">
            <Avatar name={athlete.nickname ?? "?"} photoUrl={athlete.photo_url} size="lg" />
            {athlete.nickname ?? "Профиль спортсмена"}
          </span>
        }
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
          <h2 className="record-label border-b border-[var(--border)] pb-2 text-[var(--iron-muted)]">
            О себе
          </h2>
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed">{athlete.bio}</p>
        </Card>
      ) : null}

      <Section title="Турниры" description="Дисциплины, в которых спортсмен был заявлен участником.">
        <AthleteHistory history={history} />
      </Section>
    </Container>
  );
}

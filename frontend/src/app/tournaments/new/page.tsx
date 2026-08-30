import type { Metadata } from "next";
import Link from "next/link";

import { Container, PageHeader } from "@/components/ui";
import { TournamentWizard } from "@/features/tournaments/tournament-wizard";

export const metadata: Metadata = {
  title: "Новый турнир",
  description: "Создание турнира: участники, проверка распределения и построение сетки.",
};

export default function NewTournamentPage() {
  return (
    <Container className="space-y-8 py-10">
      <PageHeader
        eyebrow={<Link href="/tournaments">← Турниры</Link>}
        title="Новый турнир"
        description="Заведите турнир, внесите участников и постройте сетку. Существующие профили спортсменов привязываются, а не дублируются."
      />
      <TournamentWizard />
    </Container>
  );
}

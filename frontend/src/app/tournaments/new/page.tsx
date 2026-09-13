import type { Metadata } from "next";

import { BackLink } from "@/components/brand/back-link";
import { Container, PageHeader } from "@/components/ui";
import { TournamentWizard } from "@/features/tournaments/tournament-wizard";

export const metadata: Metadata = {
  title: "Новый турнир",
  description: "Создание турнира: участники, проверка распределения и построение сетки.",
};

export default function NewTournamentPage() {
  return (
    <Container className="space-y-8 pt-10 pb-5">
      <PageHeader
        eyebrow={
          <BackLink href="/tournaments">Турниры</BackLink>
        }
        title="Новый турнир"
        description="Заведите турнир, внесите участников и постройте сетку. Существующие профили спортсменов привязываются, а не дублируются."
      />
      <TournamentWizard />
    </Container>
  );
}

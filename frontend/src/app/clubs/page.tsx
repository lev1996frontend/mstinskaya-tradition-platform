import type { Metadata } from "next";

import { listClubs } from "@/api/catalog";
import { ApiOfflineNotice } from "@/components/api-status";
import { Badge, Card, Container, EmptyState, PageHeader } from "@/components/ui";
import { formatPlace } from "@/lib/format";

export const metadata: Metadata = {
  title: "Клубы",
  description: "Клубы Мстинской традиции: география и контакты.",
};

export default async function ClubsPage() {
  const clubs = await listClubs();

  return (
    <Container className="space-y-8 py-10">
      <PageHeader
        eyebrow="Сообщество"
        title="Клубы"
        description="Организации сообщества, ведущие подготовку и выставляющие команды на турниры."
      />

      {clubs.length === 0 ? (
        <div className="space-y-4">
          <ApiOfflineNotice />
          <EmptyState title="Клубов пока нет" />
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clubs.map((club) => (
            <Card as="li" key={club.id} className="flex flex-col gap-2 p-5">
              <div className="flex items-start justify-between gap-3">
                <h2 className="min-w-0 font-semibold leading-snug">{club.name}</h2>
                {club.is_active ? (
                  <Badge tone="success">Активен</Badge>
                ) : (
                  <Badge>Неактивен</Badge>
                )}
              </div>
              <p className="text-sm text-[var(--muted)]">{formatPlace(club.city, club.country)}</p>
              {club.description ? (
                <p className="line-clamp-3 text-sm text-[var(--muted)]">{club.description}</p>
              ) : null}
              {club.website_url ? (
                <a
                  href={club.website_url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-auto pt-2 text-sm text-[var(--accent)] hover:underline"
                >
                  Сайт клуба →
                </a>
              ) : null}
            </Card>
          ))}
        </ul>
      )}
    </Container>
  );
}

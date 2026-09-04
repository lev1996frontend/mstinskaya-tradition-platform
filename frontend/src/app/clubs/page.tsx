import type { Metadata } from "next";

import { listClubsWithStatus } from "@/api/catalog";
import { ApiOfflineNotice } from "@/components/api-status";
import { CrestRoundel } from "@/components/brand/crest-roundel";
import { Badge, Card, Container, EmptyState, PageHeader } from "@/components/ui";
import { formatPlace } from "@/lib/format";

export const metadata: Metadata = {
  title: "Клубы",
  description: "Клубы Мстинской традиции: география и контакты.",
};

/**
 * Clubs stay cards — unlike athletes they are the one entity that carries its
 * own mark (a crest or an uploaded logo), and a card is what gives that mark
 * room. But the card is filed rather than tiled: the crest sits in its own
 * ruled gutter on the left, the place is stamped in the record face, and the
 * status is a struck label — so it reads as a filing card, not a product tile.
 */
export default async function ClubsPage() {
  const { items: clubs, offline } = await listClubsWithStatus();

  return (
    <Container className="space-y-8 py-10">
      <PageHeader
        eyebrow="Сообщество"
        title="Клубы"
        description="Организации сообщества, ведущие подготовку и выставляющие команды на турниры."
        actions={
          clubs.length > 0 ? (
            <span className="record-label self-end text-[var(--muted)]">
              {String(clubs.length).padStart(2, "0")} в реестре
            </span>
          ) : undefined
        }
      />

      {clubs.length === 0 ? (
        <div className="space-y-4">
          {offline ? <ApiOfflineNotice /> : null}
          <EmptyState
            title="Клубов пока нет"
            description="Реестр клубов заполнится, как только появятся первые записи."
            icon={<CrestRoundel size={22} />}
          />
        </div>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {clubs.map((club) => (
            <Card as="li" key={club.id} className="flex transition-colors hover:border-[var(--accent)]">
              <div className="flex shrink-0 items-start border-r border-[var(--border)] bg-[var(--surface-muted)]/50 p-4">
                {club.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- logo_url is an arbitrary backend-hosted URL
                  <img
                    src={club.logo_url}
                    alt=""
                    className="size-11 rounded-[var(--radius-sm)] object-cover"
                  />
                ) : (
                  <CrestRoundel size={44} className="text-[var(--chrome-muted)]" />
                )}
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-2 p-5">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-display line-clamp-2 min-w-0 text-lg font-semibold leading-snug tracking-tight">
                    {club.name}
                  </h2>
                  {club.is_active ? (
                    <Badge tone="success">Активен</Badge>
                  ) : (
                    <Badge>Неактивен</Badge>
                  )}
                </div>

                <p className="font-record text-xs text-[var(--muted)]">
                  {formatPlace(club.city, club.country)}
                </p>

                {club.description ? (
                  <p className="line-clamp-3 text-sm leading-relaxed text-[var(--muted)]">
                    {club.description}
                  </p>
                ) : null}

                {club.website_url ? (
                  <a
                    href={club.website_url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="record-label label-link label-link-fwd mt-auto pt-2 text-[var(--accent)]"
                  >
                    Сайт клуба
                  </a>
                ) : null}
              </div>
            </Card>
          ))}
        </ul>
      )}
    </Container>
  );
}

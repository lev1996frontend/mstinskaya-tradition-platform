import Link from "next/link";

import { listTournaments } from "@/api/tournaments";
import { Container } from "@/components/ui";
import { DirectoryIndex } from "@/features/home/directory-index";
import { Hero } from "@/features/home/hero";
import { TournamentGrid } from "@/features/home/tournament-grid";

/**
 * Front page of the archive: masthead, then the bulletin of what is currently
 * open (only when there is something real to show — nothing is fabricated to
 * fill the slot), then the index of sections.
 *
 * The old shape — hero, then five identical direction cards — is gone; see
 * `features/home/directory-index.tsx` for what replaced the card grid.
 */
export default async function HomePage() {
  const tournaments = await listTournaments();
  const upcoming = tournaments
    .filter((tournament) => tournament.status !== "ARCHIVED")
    .slice(0, 3);

  return (
    <>
      <Hero />

      <Container className="space-y-16 pt-14 pb-10 sm:pt-20 sm:pb-14">
        {upcoming.length > 0 ? (
          <section aria-labelledby="bulletin-heading" className="space-y-6">
            <div className="flex items-center gap-4">
              <h2
                id="bulletin-heading"
                className="font-display shrink-0 text-2xl font-semibold tracking-tight"
              >
                Ближайшие турниры
              </h2>
              <span aria-hidden="true" className="h-px flex-1 bg-[var(--rule)] opacity-70" />
              <Link
                href="/tournaments"
                className="record-label shrink-0 text-[var(--accent)] hover:underline"
              >
                Все турниры →
              </Link>
            </div>
            <TournamentGrid tournaments={upcoming} featuredFirst />
          </section>
        ) : null}

        <DirectoryIndex />
      </Container>
    </>
  );
}

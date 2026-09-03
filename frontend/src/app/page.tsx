import Link from "next/link";

import { getBoutRules, listTournaments } from "@/api/tournaments";
import { Container } from "@/components/ui";
import { Buza } from "@/features/home/buza";
import { Chronicle } from "@/features/home/chronicle";
import { Equipment } from "@/features/home/equipment";
import { GearArchive } from "@/features/home/gear-archive";
import { Hero } from "@/features/home/hero";
import { Paintings } from "@/features/home/paintings";
import { SectionIndex } from "@/features/home/section-index";
import { StenkaKrug } from "@/features/home/stenka-krug";
import { TournamentGrid } from "@/features/home/tournament-grid";
import { BracketGrid } from "@/features/home/tournament-path/bracket-grid";
import { Dossiers } from "@/features/home/tournament-path/dossiers";
import { Poedinok } from "@/features/home/tournament-path/poedinok";
import { RulesQuiz } from "@/features/home/tournament-path/rules-quiz";
import { TournamentPathProvider } from "@/features/home/tournament-path/tournament-path-context";

/**
 * Front page of the archive — the "Живой архив" v3 redesign
 * (design_handoff_mstinskaya). Masthead, the real live-tournament bulletin,
 * then БУЗА (design_handoff_buza_river — the tradition's origin story,
 * collapsed by default and opened only by the river-boat button in the
 * header; see `features/home/buza-context.tsx`), then the new demo/editorial
 * sections (СТЕНКА → ПОЕДИНОК/СЕТКА/ПРАВИЛА/БОЙЦЫ → СНАРЯЖЕНИЕ → АРХИВ
 * ЭКИПИРОВКИ → ХРОНИКА → ЖИВОПИСЬ), closing with the new anchor index.
 * ПОЕДИНОК/СЕТКА/БОЙЦЫ share one `TournamentPathProvider`
 * — the "заявленный разряд" state and the fixed demo bracket must stay one
 * source of truth across all three (see `tournament-path/bracket-data.ts`),
 * even though ПРАВИЛА sits between them with no state of its own.
 *
 * СНАРЯЖЕНИЕ (`Equipment`, real bout-rules data — the four lot-drawn weapon
 * categories) and АРХИВ ЭКИПИРОВКИ (`GearArchive`, the nine-item опись a
 * fighter wears regardless of category) sit next to each other on purpose —
 * two different opись, "чем бьются" then "во что одет", not one merged into
 * the other.
 *
 * The previous `DirectoryIndex` (real-route ToC) is no longer rendered here:
 * with 12 detailed sections plus the new anchor `SectionIndex`, a second
 * "here are five more pages" block read as redundant, and all five routes
 * stay one click away via the header nav. The component itself is left
 * untouched in `features/home/directory-index.tsx` rather than deleted.
 */
export default async function HomePage() {
  const [tournaments, boutRules] = await Promise.all([listTournaments(), getBoutRules()]);
  const upcoming = tournaments
    .filter((tournament) => tournament.status !== "ARCHIVED")
    .slice(0, 3);

  return (
    <>
      <Hero />

      {upcoming.length > 0 ? (
        <Container className="py-14 sm:py-20">
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
        </Container>
      ) : null}

      <Buza />

      <StenkaKrug />

      <TournamentPathProvider>
        <Poedinok />
        <BracketGrid />
        <RulesQuiz />
        <Dossiers />
      </TournamentPathProvider>

      <Equipment rules={boutRules} />
      <GearArchive />
      <Chronicle />
      <Paintings />

      <Container className="py-14 sm:py-20">
        <SectionIndex />
      </Container>
    </>
  );
}

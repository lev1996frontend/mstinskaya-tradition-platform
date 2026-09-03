import Link from "next/link";

import { getBoutRules, listTournaments } from "@/api/tournaments";
import { Container } from "@/components/ui";
import { Buza } from "@/features/home/buza";
import { Chronicle } from "@/features/home/chronicle";
import { Equipment } from "@/features/home/equipment";
import { GearArchive } from "@/features/home/gear-archive";
import { Hero } from "@/features/home/hero";
import { Paintings } from "@/features/home/paintings";
import { StenkaKrug } from "@/features/home/stenka-krug";
import { TournamentGrid } from "@/features/home/tournament-grid";

/**
 * Front page of the archive — the "Живой архив" v3 redesign
 * (design_handoff_mstinskaya). Masthead, the real live-tournament bulletin,
 * then БУЗА (design_handoff_buza_river — the tradition's origin story,
 * collapsed by default and opened only by the river-boat button in the
 * header; see `features/home/buza-context.tsx`), then the editorial sections
 * (СТЕНКА/КРУГ → СНАРЯЖЕНИЕ → АРХИВ ЭКИПИРОВКИ → ХРОНИКА → ЖИВОПИСЬ). The
 * interactive tournament walkthrough (Поединок/Сетка/Правила-квиз/Бойцы)
 * that used to live here moved to `/tournaments`
 * (see `app/tournaments/page.tsx`) — it explains how a real tournament run
 * plays out, which reads better next to the real tournament list than on the
 * landing page.
 *
 * СНАРЯЖЕНИЕ (`Equipment`, real bout-rules data — the four lot-drawn weapon
 * categories) and АРХИВ ЭКИПИРОВКИ (`GearArchive`, the nine-item опись a
 * fighter wears regardless of category) sit next to each other on purpose —
 * two different опись, "чем бьются" then "во что одет", not one merged into
 * the other.
 *
 * The previous `DirectoryIndex` (real-route ToC) is no longer rendered here —
 * all routes stay one click away via the header nav — and the component
 * itself is left untouched in `features/home/directory-index.tsx` rather
 * than deleted.
 *
 * `SectionIndex` (the in-page anchor ToC) is gone from here too, ahead of
 * the IA-restructure spec's own Stage 3: once Поединок/Сетка/Правила/Бойцы
 * moved to `/tournaments`, it sat below every section it listed — no longer
 * navigation, just a recap of what a reader had already scrolled past. Left
 * untouched in `features/home/section-index.tsx`, same as `DirectoryIndex`.
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

      <Equipment rules={boutRules} />
      <GearArchive />
      <Chronicle />
      <Paintings />
    </>
  );
}

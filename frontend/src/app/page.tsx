import Link from "next/link";

import { listTournaments } from "@/api/tournaments";
import { Container } from "@/components/ui";
import { Buza } from "@/features/home/buza";
import { Chronicle } from "@/features/home/chronicle";
import { Hero } from "@/features/home/hero";
import { Paintings } from "@/features/home/paintings";
import { StenkaKrug } from "@/features/home/stenka-krug";
import { TournamentGrid } from "@/features/home/tournament-grid";

/**
 * Front page of the archive — the "Живой архив" v3 redesign
 * (design_handoff_mstinskaya). Masthead, the real live-tournament bulletin,
 * then БУЗА (design_handoff_buza_river — the tradition's origin story,
 * collapsed by default and opened only by the river-boat button in the
 * header; see `features/home/buza-context.tsx`), then the remaining
 * editorial sections (СТЕНКА/КРУГ → ХРОНИКА → ЖИВОПИСЬ).
 *
 * Two blocks that used to live here moved out to their own routes: the
 * interactive tournament walkthrough (Поединок/Сетка/Правила-квиз/Бойцы) to
 * `/tournaments` (see `app/tournaments/page.tsx`), and Снаряжение/Архив
 * экипировки to `/equipment` (see `app/equipment/page.tsx`) — both explain
 * or catalog something with its own dedicated page now, which reads better
 * there than on the landing page.
 *
 * The previous `DirectoryIndex` (real-route ToC) is no longer rendered here —
 * all routes stay one click away via the header nav — and the component
 * itself is left untouched in `features/home/directory-index.tsx` rather
 * than deleted. `SectionIndex` (the in-page anchor ToC) went further: once
 * the sections it indexed had all moved to `/tournaments`/`/equipment`, it
 * was pure dead code pointing at anchors that no longer existed, so it was
 * deleted outright rather than kept unrendered.
 */
export default async function HomePage() {
  const tournaments = await listTournaments();
  const upcoming = tournaments
    .filter((tournament) => tournament.status !== "ARCHIVED")
    .slice(0, 3);

  return (
    <>
      <Hero />

      {upcoming.length > 0 ? (
        <Container className="py-14 sm:py-20">
          <section aria-labelledby="bulletin-heading" className="space-y-6">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <h2
                id="bulletin-heading"
                className="font-display shrink-0 text-2xl font-semibold tracking-tight"
              >
                Ближайшие турниры
              </h2>
              <span aria-hidden="true" className="h-px min-w-8 flex-1 bg-[var(--rule)] opacity-70" />
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

      <Chronicle />
      <Paintings />
    </>
  );
}

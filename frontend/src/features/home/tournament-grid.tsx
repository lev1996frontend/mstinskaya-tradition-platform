import { cn } from "@/components/ui";
import { TournamentCard } from "@/features/tournaments/tournament-card";
import type { Tournament } from "@/types";

/**
 * Grid of tournament cards. When `featuredFirst` is set, the soonest
 * tournament gets the larger "featured" treatment and spans two columns, so
 * the bulletin has a clear next-event focal point instead of a wall of
 * identical cards.
 *
 * The staggered opacity+y mount-in this used to run on scroll is removed: it
 * announced nothing the reader did not already know, it delayed real content,
 * and "every block fades in" is precisely the generated-site tell the redesign
 * is trying to shed. Dropping it also returns this to a server component with
 * no framer-motion in the bundle.
 */
export function TournamentGrid({
  tournaments,
  featuredFirst = false,
}: {
  tournaments: Tournament[];
  featuredFirst?: boolean;
}) {
  // Column count tracks the actual item count (capped at 3): with fewer
  // tournaments than columns, a fixed 3-column grid leaves a trailing empty
  // cell (glaring when there's exactly one card). The featured 2-col span
  // only kicks in once there's a real 3-column grid to span within —
  // otherwise it either does nothing (1 col) or forces an oddly-styled
  // "featured" card into a half-width column (2 cols).
  const columns = Math.min(tournaments.length, 3);

  return (
    <ul
      className={cn(
        "grid gap-4",
        columns >= 2 && "md:grid-cols-2",
        columns >= 3 && "lg:grid-cols-3",
      )}
    >
      {tournaments.map((tournament, index) => {
        const isFeatured = featuredFirst && index === 0 && columns >= 3;
        return (
          <li key={tournament.id} className={cn(isFeatured && "md:col-span-2")}>
            <TournamentCard tournament={tournament} featured={isFeatured} />
          </li>
        );
      })}
    </ul>
  );
}

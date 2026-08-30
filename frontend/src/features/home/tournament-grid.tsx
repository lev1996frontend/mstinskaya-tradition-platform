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
  return (
    <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {tournaments.map((tournament, index) => {
        const isFeatured = featuredFirst && index === 0;
        return (
          <li key={tournament.id} className={cn(isFeatured && "md:col-span-2")}>
            <TournamentCard tournament={tournament} featured={isFeatured} />
          </li>
        );
      })}
    </ul>
  );
}

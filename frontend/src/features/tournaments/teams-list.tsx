import { Badge, Card, EmptyState } from "@/components/ui";
import { labelOf, teamMemberRole } from "@/lib/labels";
import { plural } from "@/lib/format";
import type { TeamView } from "@/types";

export function TeamsList({ teams }: { teams: TeamView[] }) {
  if (teams.length === 0) {
    return (
      <EmptyState
        title="Команд пока нет"
        description="Команды доступны только в командных дисциплинах. Здесь появится состав каждой из них."
      />
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {teams.map((team) => (
        <Card as="li" key={team.id} className="flex flex-col p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate font-semibold">{team.name}</h3>
              {team.short_name ? (
                <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                  {team.short_name}
                </p>
              ) : null}
            </div>
            <Badge>{plural(team.members.length, "боец", "бойца", "бойцов")}</Badge>
          </div>

          {team.members.length > 0 ? (
            <ul className="mt-4 space-y-2 border-t border-[var(--border)] pt-4">
              {team.members.map((member) => (
                <li key={member.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate">{member.display_name}</span>
                  <span className="shrink-0 text-xs text-[var(--muted)]">
                    {labelOf(teamMemberRole, member.role)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 border-t border-[var(--border)] pt-4 text-sm text-[var(--muted)]">
              Состав не заявлен.
            </p>
          )}
        </Card>
      ))}
    </ul>
  );
}

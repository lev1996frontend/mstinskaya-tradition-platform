import { ScrollText } from "lucide-react";

import { Badge, EmptyState } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { eventTone, eventType, labelOf } from "@/lib/labels";
import type { CompetitionEventView } from "@/types";

/**
 * The competition journal is where result corrections land, so it doubles as
 * the audit trail for "быстрое изменение результатов" from the engine spec.
 */
export function EventsJournal({ events }: { events: CompetitionEventView[] }) {
  if (events.length === 0) {
    return (
      <EmptyState
        title="Журнал пуст"
        icon={<ScrollText className="size-5" strokeWidth={1.75} />}
        description="Здесь фиксируются жеребьёвки, изменения результатов, снятия и дисквалификации."
      />
    );
  }

  return (
    <ol className="space-y-3">
      {events.map((event) => {
        const previous = (event.payload?.previous_result ?? null) as {
          method?: string;
          winner_id?: string | null;
        } | null;

        return (
          <li
            key={event.id}
            className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={eventTone[event.event_type] ?? "info"}>
                {labelOf(eventType, event.event_type)}
              </Badge>
              <time className="text-xs text-[var(--muted)]" dateTime={event.created_at}>
                {formatDateTime(event.created_at)}
              </time>
            </div>
            {event.description ? <p className="mt-2 text-sm">{event.description}</p> : null}
            {previous ? (
              <p className="mt-2 text-xs text-[var(--muted)]">
                Предыдущее решение сохранено в журнале
                {previous.method ? ` (${previous.method})` : ""}.
              </p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

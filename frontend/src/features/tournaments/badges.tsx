import { Badge } from "@/components/ui";
import * as labels from "@/lib/labels";
import type {
  CompetitionStatus,
  MatchStatus,
  ParticipantStatus,
  TournamentStatus,
} from "@/types";

export function TournamentStatusBadge({ status }: { status: TournamentStatus }) {
  const entry = labels.tournamentStatus[status] ?? { label: status, tone: "neutral" as const };
  return <Badge tone={entry.tone}>{entry.label}</Badge>;
}

export function CompetitionStatusBadge({ status }: { status: CompetitionStatus }) {
  const entry = labels.competitionStatus[status] ?? { label: status, tone: "neutral" as const };
  return <Badge tone={entry.tone}>{entry.label}</Badge>;
}

export function MatchStatusBadge({ status }: { status: MatchStatus }) {
  const entry = labels.matchStatus[status] ?? { label: status, tone: "neutral" as const };
  return <Badge tone={entry.tone}>{entry.label}</Badge>;
}

export function ParticipantStatusBadge({ status }: { status: ParticipantStatus }) {
  const entry = labels.participantStatus[status] ?? { label: status, tone: "neutral" as const };
  return <Badge tone={entry.tone}>{entry.label}</Badge>;
}

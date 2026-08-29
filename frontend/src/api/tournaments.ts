import { apiListOrEmpty, apiRequest, apiRequestOrNull } from "@/lib/api";
import type {
  BracketTreeView,
  CompetitionEventView,
  CompetitionView,
  DrawView,
  MatchResultView,
  MatchStatus,
  MatchView,
  ParticipantStatusHistoryView,
  ParticipantView,
  ResultMethod,
  StandingsView,
  TeamView,
  Tournament,
  TournamentCategory,
  TournamentDocument,
} from "@/types";

// ---------------------------------------------------------------- reads ---

export const listTournaments = () => apiListOrEmpty<Tournament>("/api/v1/tournaments");

export const getTournament = (id: string) =>
  apiRequestOrNull<Tournament>(`/api/v1/tournaments/${id}`);

export const listCategories = (tournamentId: string) =>
  apiListOrEmpty<TournamentCategory>(`/api/v1/tournaments/${tournamentId}/categories`);

export const listDocuments = (tournamentId: string) =>
  apiListOrEmpty<TournamentDocument>(`/api/v1/tournaments/${tournamentId}/documents`);

export const listCompetitions = (tournamentId: string) =>
  apiListOrEmpty<CompetitionView>(`/api/v1/tournaments/${tournamentId}/competitions`);

export const getCompetition = (competitionId: string) =>
  apiRequestOrNull<CompetitionView>(`/api/v1/competitions/${competitionId}`);

export const listParticipants = (competitionId: string) =>
  apiListOrEmpty<ParticipantView>(`/api/v1/competitions/${competitionId}/participants`);

export const listTeams = (competitionId: string) =>
  apiListOrEmpty<TeamView>(`/api/v1/competitions/${competitionId}/teams`);

export const listMatches = (competitionId: string) =>
  apiListOrEmpty<MatchView>(`/api/v1/competitions/${competitionId}/matches`);

export const getStandings = (competitionId: string) =>
  apiRequestOrNull<StandingsView>(`/api/v1/competitions/${competitionId}/standings`);

export const getBracket = (competitionId: string) =>
  apiRequestOrNull<BracketTreeView>(`/api/v1/competitions/${competitionId}/bracket`);

export const listDraws = (competitionId: string) =>
  apiListOrEmpty<DrawView>(`/api/v1/competitions/${competitionId}/draws`);

export const listEvents = (competitionId: string) =>
  apiListOrEmpty<CompetitionEventView>(`/api/v1/competitions/${competitionId}/events`);

export const listStatusHistory = (participantId: string) =>
  apiListOrEmpty<ParticipantStatusHistoryView>(
    `/api/v1/participants/${participantId}/status-history`,
  );

// --------------------------------------------------------------- writes ---
// Called from client components, so the bearer token is picked up from
// localStorage by `apiRequest` automatically.

export const recordMatchResult = (
  matchId: string,
  body: { winner_id: string | null; method: ResultMethod; comment?: string | null },
) =>
  apiRequest<MatchResultView>(`/api/v1/matches/${matchId}/result`, {
    method: "POST",
    body: { match_id: matchId, ...body },
  });

export const updateMatchResult = (
  matchId: string,
  body: {
    winner_id: string | null;
    method: ResultMethod;
    comment?: string | null;
    reason?: string | null;
  },
) => apiRequest<MatchResultView>(`/api/v1/matches/${matchId}/result`, { method: "PUT", body });

export const updateMatchStatus = (
  matchId: string,
  body: { status: MatchStatus | "RUNNING"; reason?: string | null },
) =>
  apiRequest<MatchView>(`/api/v1/competition-matches/${matchId}/status`, {
    method: "PATCH",
    body,
  });

export const updateParticipantStatus = (body: {
  participant_id: string;
  new_status: string;
  reason?: string | null;
}) => apiRequest<ParticipantStatusHistoryView>("/api/v1/participant-status-history", {
  method: "POST",
  body,
});

export const getMatch = (matchId: string) =>
  apiRequest<MatchView>(`/api/v1/competition-matches/${matchId}`);

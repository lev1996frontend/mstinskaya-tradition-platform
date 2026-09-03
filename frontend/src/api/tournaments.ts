import { cache } from "react";

import { apiListOrEmpty, apiListWithOffline, apiRequest, apiRequestOrNull } from "@/lib/api";
import type {
  AthleteParticipationView,
  BoutDetailView,
  BoutSide,
  BracketPlanView,
  BracketTreeView,
  ChampionSummaryView,
  CompetitionEventView,
  CompetitionView,
  DrawView,
  LotMethod,
  LotView,
  MatchResultView,
  MatchRoundView,
  MatchStatus,
  MatchView,
  ParticipantStatusHistoryView,
  ParticipantView,
  ResultMethod,
  StandingsView,
  TeamBoutView,
  TeamView,
  Tournament,
  TournamentCategory,
  TournamentDocument,
  WeaponCategory,
  WeaponRulesView,
} from "@/types";

// ---------------------------------------------------------------- reads ---

export const listTournaments = () => apiListOrEmpty<Tournament>("/api/v1/tournaments");

export const listTournamentsWithStatus = () =>
  apiListWithOffline<Tournament>("/api/v1/tournaments");

export const getTournament = cache((id: string) =>
  apiRequestOrNull<Tournament>(`/api/v1/tournaments/${id}`),
);

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

export const listAthleteTournamentHistory = (athleteId: string) =>
  apiListOrEmpty<AthleteParticipationView>(`/api/v1/athletes/${athleteId}/tournament-history`);

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

// ------------------------------------------------- bracket / жребий / соступ
// Every one of these is a real backend transition. Nothing below computes an
// outcome locally: the client asks, the server decides and persists, and the
// response is the new truth.

export const getBoutRules = () => apiRequestOrNull<WeaponRulesView>("/api/v1/bout-rules");

export const getBout = (matchId: string) =>
  apiRequestOrNull<BoutDetailView>(`/api/v1/matches/${matchId}/bout`);

export const getChampion = (competitionId: string) =>
  apiRequestOrNull<ChampionSummaryView>(`/api/v1/competitions/${competitionId}/champion`);

export const listTeamBouts = (competitionId: string) =>
  apiListOrEmpty<TeamBoutView>(`/api/v1/competitions/${competitionId}/team-bouts`);

/** Dry run: shows byes and the city verdict without writing anything. */
export const previewBracket = (competitionId: string) =>
  apiRequest<BracketPlanView>(`/api/v1/competitions/${competitionId}/bracket/preview`, {
    method: "POST",
  });

export const generateBracket = (
  competitionId: string,
  body: { final_weapon?: WeaponCategory | null } = {},
) =>
  apiRequest<BracketPlanView>(`/api/v1/competitions/${competitionId}/bracket/generate`, {
    method: "POST",
    body,
  });

/**
 * Draw one side's weapon.
 *
 * For ONLINE_DICE no value is sent: the server rolls with `secrets` and
 * persists the result before responding, so the browser cannot influence or
 * pre-compute it. For PHYSICAL_DICE the judge passes the face they actually
 * rolled.
 */
export const drawLot = (
  matchId: string,
  body: { side: BoutSide; method: LotMethod; die_value?: number | null },
) => apiRequest<LotView>(`/api/v1/matches/${matchId}/lot`, { method: "POST", body });

/** Admin correction; the superseded draw is kept and journalled. */
export const overrideLot = (
  matchId: string,
  body: { side: BoutSide; method: LotMethod; die_value?: number | null; reason: string },
) => apiRequest<LotView>(`/api/v1/matches/${matchId}/lot/override`, { method: "POST", body });

export const startBout = (matchId: string) =>
  apiRequest<MatchView>(`/api/v1/matches/${matchId}/start`, { method: "POST" });

/** Open the next соступ. */
export const openRound = (matchId: string) =>
  apiRequest<MatchRoundView>(`/api/v1/matches/${matchId}/rounds`, { method: "POST" });

export const recordRoundScore = (
  matchId: string,
  roundNumber: number,
  body: { participant_id: string; action_code: string },
) =>
  apiRequest<BoutDetailView>(`/api/v1/matches/${matchId}/rounds/${roundNumber}/score`, {
    method: "POST",
    body,
  });

export const completeRound = (
  matchId: string,
  roundNumber: number,
  body: { winner_participant_id: string; end_reason?: string; notes?: string | null },
) =>
  apiRequest<BoutDetailView>(`/api/v1/matches/${matchId}/rounds/${roundNumber}/complete`, {
    method: "POST",
    body,
  });

export const generateTeamBouts = (competitionId: string) =>
  apiRequest<TeamBoutView[]>(`/api/v1/competitions/${competitionId}/team-bouts/generate`, {
    method: "POST",
  });

export const recordTeamPairingResult = (
  matchId: string,
  body: { winner_participant_id: string; notes?: string | null },
) => apiRequest<MatchView>(`/api/v1/matches/${matchId}/team-result`, { method: "POST", body });

// ------------------------------------------------------- organizer creation

export const createTournament = (body: {
  title: string;
  description?: string | null;
  status?: string;
  start_date?: string | null;
  location?: string | null;
  city?: string | null;
  organizer_id: string;
  ruleset_id: string;
}) => apiRequest<Tournament>("/api/v1/tournaments", { method: "POST", body });

export const createCompetition = (
  tournamentId: string,
  body: { name: string; type: "INDIVIDUAL" | "TEAM"; format: string; status?: string },
) =>
  apiRequest<{ id: string }>(`/api/v1/tournaments/${tournamentId}/competitions`, {
    method: "POST",
    body: { tournament_id: tournamentId, ...body },
  });

/**
 * Enter a competitor.
 *
 * `athlete_id` links an existing platform profile — that is how the wizard
 * avoids ever creating a duplicate person. `display_name` is only for an
 * entrant who has no profile at all.
 */
export const addParticipant = (
  competitionId: string,
  body: {
    athlete_id?: string | null;
    display_name?: string | null;
    city?: string | null;
    club_id?: string | null;
    seed?: number | null;
  },
) =>
  apiRequest<ParticipantView>(`/api/v1/competitions/${competitionId}/participants`, {
    method: "POST",
    body: { competition_id: competitionId, ...body },
  });

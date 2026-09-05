import { cache } from "react";

import {
  apiListOrEmpty,
  apiListWithOffline,
  apiRequest,
  apiRequestOrNull,
  apiUpload,
} from "@/lib/api";
import { API_BASE_URL } from "@/lib/config";
import type {
  AgeSplitView,
  AthleteParticipationView,
  BoutDetailView,
  BoutSide,
  BracketPlanView,
  BracketTreeView,
  ChampionSummaryView,
  CompetitionEventView,
  CompetitionFormat,
  CompetitionStatus,
  CompetitionType,
  CompetitionView,
  DrawView,
  GroupLayoutSuggestionView,
  GroupPlanView,
  GroupStageView,
  ImportCommitResponse,
  ImportReport,
  ImportRow,
  LateReplacementView,
  LotMethod,
  LotView,
  MatchResultView,
  MatchRoundView,
  MatchStatus,
  MatchView,
  ParticipantStatusHistoryView,
  ParticipantView,
  QualificationView,
  ResultMethod,
  StandingsView,
  TeamBoutView,
  TeamView,
  Tournament,
  TournamentCategory,
  ReplacementCandidatesView,
  TournamentDocument,
  TournamentRegistration,
  WeaponCategory,
  WeaponRulesView,
  WithdrawalView,
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

/**
 * The tournament's own entry list — who has been entered, and in which category,
 * before any discipline is drawn.
 *
 * Named apart from `listParticipants` below on purpose: that one takes a
 * *competition* id, and the tournament page was calling it with a tournament id
 * — a shape the API answers with an empty list rather than an error, so
 * "Заявлено участников" read 0 no matter how many had entered.
 */
export const listRegistrations = (tournamentId: string) =>
  apiListOrEmpty<TournamentRegistration>(`/api/v1/tournaments/${tournamentId}/participants`);

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

/** The age streams this discipline would be cut into. Writes nothing. */
export const getAgeSplit = (competitionId: string) =>
  apiRequestOrNull<AgeSplitView>(`/api/v1/competitions/${competitionId}/age-split`);

export const getGroupStage = (competitionId: string) =>
  apiRequestOrNull<GroupStageView>(`/api/v1/competitions/${competitionId}/groups`);

export const getQualification = (competitionId: string) =>
  apiRequestOrNull<QualificationView>(`/api/v1/competitions/${competitionId}/qualification`);

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

/**
 * Take a fighter out of a competition that is already under way.
 *
 * Not the same call as `updateParticipantStatus`: that one only records a
 * status, leaving the bracket holding someone who will never appear and a bout
 * that can never finish. This one also settles every bout of theirs that has
 * not been fought, as a walkover for the opponent — the backend decides which
 * bouts those are and who they go to.
 */
export const withdrawParticipant = (
  participantId: string,
  body: {
    reason: string;
    status?: "WITHDRAWN" | "DISQUALIFIED";
    /**
     * Naming a stand-in changes what the call does: no walkover is granted at
     * all, and the replacement takes the vacated seat instead.
     */
    replacement_participant_id?: string;
  },
) =>
  apiRequest<WithdrawalView>(`/api/v1/participants/${participantId}/withdraw`, {
    method: "POST",
    body,
  });

/**
 * Who could stand in for this fighter, best first. A suggestion only — reading
 * this changes nothing, and the replacement is seated by the call below.
 */
export const getReplacementCandidates = (participantId: string) =>
  apiRequest<ReplacementCandidatesView>(
    `/api/v1/participants/${participantId}/replacement-candidates`,
  );

/**
 * Stand someone in for a fighter who was already withdrawn.
 *
 * By this point the walkover has been granted and the opponent advanced, so the
 * backend takes both back — and refuses outright if that opponent has since
 * fought the bout they were advanced into.
 */
export const replaceWithdrawnParticipant = (
  participantId: string,
  body: { reason: string; replacement_participant_id: string },
) =>
  apiRequest<LateReplacementView>(`/api/v1/participants/${participantId}/replace`, {
    method: "POST",
    body,
  });

export const getMatch = (matchId: string) =>
  apiRequest<MatchView>(`/api/v1/competition-matches/${matchId}`);

// ---------------------------------------------------- entry list from Excel
// The template and the parser are generated from one column definition on the
// server, so the file handed out and the file expected back cannot drift.

/**
 * Address of the blank entry form.
 *
 * A plain URL rather than a fetch helper because the route is public: no
 * bearer token is involved, so an ordinary `<a download>` does the whole job
 * and works from a server component with no client JS at all.
 */
export const participantTemplateUrl = (tournamentId: string) =>
  `${API_BASE_URL}/api/v1/tournaments/${tournamentId}/participants/template.xlsx`;

/** Reads the file and reports every problem per row. Writes nothing. */
export const previewParticipantImport = (tournamentId: string, file: File) =>
  apiUpload<ImportReport>(
    `/api/v1/tournaments/${tournamentId}/participants/import/preview`,
    file,
  );

/**
 * Enter the reviewed rows.
 *
 * Sends rows rather than the file again, because the organizer may have fixed
 * a discipline or a birth year in the review table. The server re-validates
 * them and refuses the whole batch if anything is still wrong.
 */
export const commitParticipantImport = (tournamentId: string, rows: ImportRow[]) =>
  apiRequest<ImportCommitResponse>(
    `/api/v1/tournaments/${tournamentId}/participants/import/commit`,
    { method: "POST", body: { rows } },
  );

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

/**
 * Turn the age streams into disciplines of their own.
 *
 * The competition keeps its id and becomes the youngest stream; the rest are
 * created beside it, each an ordinary discipline from then on.
 */
export const applyAgeSplit = (competitionId: string) =>
  apiRequest<{ source_name: string; competitions: { competition_id: string; name: string }[] }>(
    `/api/v1/competitions/${competitionId}/age-split`,
    { method: "POST" },
  );

// ------------------------------------------------------------- group stage
// The organizer states both numbers; the platform only suggests. Neither
// request carries a default, so a group stage nobody specified cannot happen.

export const suggestGroups = (competitionId: string) =>
  apiRequest<GroupLayoutSuggestionView>(`/api/v1/competitions/${competitionId}/groups/suggest`, {
    method: "POST",
  });

/** Dry run of the deal — who lands where, and what could not be separated. */
export const previewGroups = (
  competitionId: string,
  body: { group_count: number; advance_per_group: number },
) =>
  apiRequest<GroupPlanView>(`/api/v1/competitions/${competitionId}/groups/preview`, {
    method: "POST",
    body,
  });

export const generateGroups = (
  competitionId: string,
  body: { group_count: number; advance_per_group: number },
) =>
  apiRequest<GroupPlanView>(`/api/v1/competitions/${competitionId}/groups/generate`, {
    method: "POST",
    body,
  });

/**
 * Settle a tie the bouts could not.
 *
 * The platform refuses to pick a place it did not determine, so this is the
 * organizer doing it — and the reason is required because the decision changes
 * who reaches the playoff.
 */
export const resolveGroupTie = (
  groupId: string,
  body: { ordering: string[]; reason: string },
) =>
  apiRequest<GroupStageView>(`/api/v1/competition-groups/${groupId}/tie-break`, {
    method: "POST",
    body,
  });

/** Build the knockout stage out of the group winners. */
export const generatePlayoff = (
  competitionId: string,
  body: { final_weapon?: WeaponCategory | null } = {},
) =>
  apiRequest<BracketPlanView>(`/api/v1/competitions/${competitionId}/playoff/generate`, {
    method: "POST",
    body,
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

/**
 * Create one discipline of a tournament.
 *
 * `min_age`/`max_age` are independently optional and usually both absent: 45+
 * for «Ветераны», an upper bound for a children's category, neither for the
 * open absolute — which is what lets one fighter enter both.
 */
export const createCompetition = (
  tournamentId: string,
  body: {
    name: string;
    type: CompetitionType;
    format: CompetitionFormat;
    status?: CompetitionStatus;
    category_id?: string | null;
    min_age?: number | null;
    max_age?: number | null;
    /** Largest age difference one bracket may hold; null means one field. */
    max_age_gap?: number | null;
  },
) =>
  apiRequest<CompetitionView>(`/api/v1/tournaments/${tournamentId}/competitions`, {
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
    /** Free text, and what the first-round separation actually compares. */
    club_name?: string | null;
    /** Only consulted where the discipline sets an age bound. */
    birth_year?: number | null;
    /** Admits someone the bound excludes; recorded in the journal. */
    age_override_reason?: string | null;
    seed?: number | null;
  },
) =>
  apiRequest<ParticipantView>(`/api/v1/competitions/${competitionId}/participants`, {
    method: "POST",
    body: { competition_id: competitionId, ...body },
  });

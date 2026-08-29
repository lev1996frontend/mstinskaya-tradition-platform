/**
 * Wire types mirroring the FastAPI response models.
 *
 * Names follow the backend schemas one-to-one so a mismatch is easy to spot:
 * `Tournament` ← `TournamentResponse`, `CompetitionView` ← `views.CompetitionView`.
 */

export type TournamentStatus =
  | "DRAFT"
  | "REGISTRATION"
  | "RUNNING"
  | "ACTIVE"
  | "FINISHED"
  | "ARCHIVED";

export type CompetitionType = "INDIVIDUAL" | "TEAM";
export type CompetitionFormat = "SINGLE_ELIMINATION" | "ROUND_ROBIN" | "GROUP_PLAYOFF";
export type CompetitionStatus =
  | "DRAFT"
  | "REGISTRATION"
  | "RUNNING"
  | "ACTIVE"
  | "FINISHED"
  | "CANCELLED";

export type MatchStatus = "SCHEDULED" | "IN_PROGRESS" | "FINISHED" | "CANCELLED";
export type MatchStage = "QUALIFICATION" | "GROUP" | "QUARTERFINAL" | "SEMIFINAL" | "FINAL";
export type ResultMethod = "JUDGE_DECISION" | "WITHDRAWAL" | "DISQUALIFICATION" | "NO_SHOW";
export type ParticipantStatus =
  | "REGISTERED"
  | "CONFIRMED"
  | "APPROVED"
  | "WAITLISTED"
  | "WITHDRAWN"
  | "DISQUALIFIED"
  | "ELIMINATED";

export type DrawType = "RANDOM" | "SEEDED" | "MANUAL";
export type AthleteLevel = "BEGINNER" | "PRACTITIONER" | "INSTRUCTOR" | "MASTER";

export interface Tournament {
  id: string;
  title: string;
  description: string | null;
  status: TournamentStatus;
  start_date: string | null;
  end_date: string | null;
  location: string | null;
  city: string | null;
  country: string | null;
  organizer_id: string;
  ruleset_id: string;
}

export interface TournamentCategory {
  id: string;
  tournament_id: string;
  name: string;
  description: string | null;
}

export interface TournamentDocument {
  id: string;
  tournament_id: string;
  title: string;
  file_url: string;
  type: "RULES" | "POSITION" | "RESULTS";
}

export interface CompetitionView {
  id: string;
  tournament_id: string;
  name: string;
  description: string | null;
  type: CompetitionType;
  format: CompetitionFormat;
  status: CompetitionStatus;
  participant_count: number;
  team_count: number;
  match_count: number;
  finished_match_count: number;
}

export interface ParticipantView {
  id: string;
  competition_id: string | null;
  tournament_id: string;
  type: "ATHLETE" | "TEAM";
  display_name: string;
  athlete_id: string | null;
  team_id: string | null;
  club_id: string | null;
  seed: number | null;
  status: ParticipantStatus;
}

export interface TeamMemberView {
  id: string;
  athlete_id: string;
  display_name: string;
  role: string | null;
}

export interface TeamView {
  id: string;
  competition_id: string;
  name: string;
  short_name: string | null;
  club_id: string | null;
  captain_id: string | null;
  members: TeamMemberView[];
}

export interface MatchResultView {
  id: string;
  match_id: string;
  winner_id: string | null;
  method: ResultMethod;
  comment: string | null;
  recorded_at: string;
}

export interface MatchView {
  id: string;
  tournament_id: string;
  competition_id: string | null;
  draw_id: string | null;
  bracket_id: string | null;
  stage: MatchStage | null;
  status: MatchStatus;
  round_number: number | null;
  position: number | null;
  participant_a: ParticipantView | null;
  participant_b: ParticipantView | null;
  winner_id: string | null;
  result: MatchResultView | null;
}

export interface StandingsRow {
  position: number;
  participant: ParticipantView;
  played: number;
  wins: number;
  losses: number;
  draws: number;
  no_results: number;
  tied_with_previous: boolean;
}

export interface StandingsView {
  competition_id: string;
  format: CompetitionFormat;
  rows: StandingsRow[];
  matches_total: number;
  matches_finished: number;
  provisional: boolean;
  ordering: string;
}

export interface BracketRoundView {
  key: string;
  label: string;
  order: number;
  matches: MatchView[];
}

export interface BracketTreeView {
  competition_id: string;
  format: CompetitionFormat;
  rounds: BracketRoundView[];
  unassigned: MatchView[];
}

export interface DrawView {
  id: string;
  competition_id: string;
  name: string;
  type: DrawType;
  status: "DRAFT" | "GENERATED" | "LOCKED";
  created_at: string;
}

export interface CompetitionEventView {
  id: string;
  competition_id: string;
  event_type: string;
  description: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
}

export interface ParticipantStatusHistoryView {
  id: string;
  participant_id: string;
  old_status: string | null;
  new_status: string;
  reason: string | null;
  created_at: string;
}

export interface Athlete {
  id: string;
  user_id: string;
  nickname: string | null;
  birth_year: number | null;
  experience_years: number;
  level: AthleteLevel;
  bio: string | null;
  photo_url: string | null;
}

export interface Club {
  id: string;
  name: string;
  description: string | null;
  country: string | null;
  city: string | null;
  website_url: string | null;
  logo_url: string | null;
  is_active: boolean;
}

export interface RuleSet {
  id: string;
  title: string;
  description: string | null;
  version: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  published_at: string | null;
}

export interface RuleSection {
  id: string;
  rule_set_id: string;
  title: string;
  description: string | null;
  order_number: number;
}

export type RuleType = "GENERAL" | "SAFETY" | "COMBAT" | "JUDGING" | "VIOLATION";

export interface Rule {
  id: string;
  section_id: string;
  title: string;
  content: string;
  rule_type: RuleType;
  order_number: number;
}

export type CourseType = "GENERAL" | "ATHLETE" | "INSTRUCTOR" | "JUDGE";
export type CourseLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";

export interface Course {
  id: string;
  title: string;
  description: string | null;
  type: CourseType;
  level: CourseLevel;
  thumbnail_url: string | null;
  is_published: boolean;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  roles: string[];
  profile: Record<string, unknown> | null;
}

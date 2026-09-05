/**
 * Wire types mirroring the FastAPI response models.
 *
 * Names follow the backend schemas one-to-one so a mismatch is easy to spot:
 * `Tournament` ← `TournamentResponse`, `CompetitionView` ← `views.CompetitionView`.
 */

/** One enum, extended rather than forked — mirrors the backend Literal.
 *  READY/BRACKET_CREATED/FINAL are the engine-driven states; RUNNING is the
 *  spec's "in progress" and FINISHED its "completed". */
export type TournamentStatus =
  | "DRAFT"
  | "REGISTRATION"
  | "READY"
  | "BRACKET_CREATED"
  | "RUNNING"
  | "ACTIVE"
  | "FINAL"
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

/** Bout lifecycle. READY_FOR_LOT/LOT_COMPLETED are the жребий phase; READY is
 *  the equivalent for a final and a team pairing, neither of which draws a lot. */
export type MatchStatus =
  | "SCHEDULED"
  | "READY_FOR_LOT"
  | "LOT_COMPLETED"
  | "READY"
  | "IN_PROGRESS"
  | "FINISHED"
  | "CANCELLED";

export type MatchStage =
  | "QUALIFICATION"
  | "GROUP"
  | "TEAM_BOUT"
  | "ROUND_OF_128"
  | "ROUND_OF_64"
  | "ROUND_OF_32"
  | "ROUND_OF_16"
  | "QUARTERFINAL"
  | "SEMIFINAL"
  | "FINAL";

export type ResultMethod =
  | "JUDGE_DECISION"
  | "ROUND_WINS"
  | "DISARM"
  | "PIN_AND_FINISH"
  | "WITHDRAWAL"
  | "DISQUALIFICATION"
  | "NO_SHOW";

/** The four lot categories. PALKA/NOZH/HANDS are the tradition's official
 *  three; KISTEN is this platform's deliberate fourth. */
export type WeaponCategory = "PALKA" | "NOZH" | "HANDS" | "KISTEN";

export type LotMethod = "PHYSICAL_DICE" | "ONLINE_DICE";
export type BoutSide = "RED" | "BLUE";
export type ParticipantStatus =
  | "REGISTERED"
  | "CONFIRMED"
  | "APPROVED"
  /** Named on the entry list, held out of the draw, waiting to stand in. */
  | "RESERVE"
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

/**
 * A registration on the tournament itself — the entry list, filed against a
 * category before any discipline has been drawn. Distinct from
 * `ParticipantView`, which is an entrant *inside* one competition and carries
 * seeding, club and city; the two live at different levels and are read from
 * different endpoints.
 */
export interface TournamentRegistration {
  id: string;
  tournament_id: string;
  category_id: string;
  athlete_id: string;
  status: "REGISTERED" | "APPROVED" | "DISQUALIFIED";
}

export interface CompetitionView {
  id: string;
  tournament_id: string;
  name: string;
  description: string | null;
  category_id: string | null;
  /** Age bounds of this discipline, each independently optional. Both null
   *  means it never asks for a birth year at all. */
  min_age: number | null;
  max_age: number | null;
  /** Short Russian label for those bounds («45+», «до 14 лет»), or null when
   *  unbounded — computed on the server so every surface phrases it alike. */
  age_label: string | null;
  /** Largest age difference allowed inside one bracket, or null when the
   *  discipline fights as one field. Set on a children's category it lets the
   *  platform cut the entrants into age streams. */
  max_age_gap: number | null;
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
  /** Club as written on the entry. The first-round separation compares this,
   *  not `club_id`, because entries name clubs that may not exist as rows. */
  club_name: string | null;
  /** Registration city — the other half of that separation. */
  city: string | null;
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
  /** A generated-bracket slot with one empty side — shown explicitly. */
  is_bye: boolean;
  /** Where the winner goes. The backend owns advancement; this is here so the
   *  tree can draw the connector, not so the client can move anyone. */
  next_match_id: string | null;
  next_slot: BoutSide | null;
  weapon_red: WeaponCategory | null;
  weapon_blue: WeaponCategory | null;
  lot_required: boolean;
  lot_completed: boolean;
  rounds_won_red: number;
  rounds_won_blue: number;
  required_rounds_red: number | null;
  required_rounds_blue: number | null;
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

export type AthleteParticipationOutcome =
  | "CHAMPION"
  | "FINALIST"
  | "ELIMINATED"
  | "STANDINGS"
  | "IN_PROGRESS"
  | "WITHDRAWN"
  | "DISQUALIFIED";

/**
 * One competition an athlete entered, for their profile's history list.
 *
 * `outcome` only ever states facts read directly off recorded matches — who
 * actually won the final, who reached it and lost, what stage an eliminated
 * run ended at. It deliberately carries no numeric placement: the platform
 * has no bronze match and no confirmed tie-break rules, so this, like the
 * standings table, never implies an official rank it didn't compute.
 */
export interface AthleteParticipationView {
  participant_id: string;
  tournament_id: string;
  tournament_title: string;
  competition_id: string;
  competition_name: string;
  format: CompetitionFormat;
  competition_status: string;
  participant_status: ParticipantStatus;
  city: string | null;
  seed: number | null;
  outcome: AthleteParticipationOutcome;
  eliminated_at_stage: MatchStage | null;
  standings_wins: number | null;
  standings_losses: number | null;
  standings_position: number | null;
  standings_tied: boolean;
  standings_provisional: boolean;
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

/** One bout awarded to the opponent because a fighter left. */
export interface WalkoverView {
  match_id: string;
  stage: string | null;
  opponent_id: string;
}

/** A bout whose slot changed hands. */
export interface SeatView {
  match_id: string;
  stage: string | null;
}

export interface ReplacementView {
  participant_id: string;
  seats: SeatView[];
}

/** Someone who could take a vacated seat, and the ground they are offered on. */
export interface ReplacementCandidate {
  participant_id: string;
  display_name: string;
  club_name: string | null;
  status: string;
  reason: "SAME_CLUB_RESERVE" | "RESERVE" | "OTHER_COMPETITION";
  /**
   * Disciplines of this tournament they are already fighting in. A warning
   * about a possible clash of timing, never a refusal — the organizer decides.
   */
  busy_in: string[];
}

export interface ReplacementCandidatesView {
  participant_id: string;
  competition_id: string | null;
  candidates: ReplacementCandidate[];
}

/** Standing someone in for a fighter who was already withdrawn. */
export interface LateReplacementView {
  participant_id: string;
  replacement: ReplacementView;
  /** Bouts whose walkover was taken back and which are open again. */
  reopened: SeatView[];
}

export interface WithdrawalView {
  participant_id: string;
  from_status: string;
  to_status: string;
  reason: string;
  /** Set when the withdrawal named a stand-in; then no walkover is granted. */
  replacement: ReplacementView | null;
  walkovers: WalkoverView[];
  /**
   * Bouts that could not be awarded yet because the opponent is still
   * undecided. The backend settles these on its own the moment the other half
   * of the draw produces someone; they are reported so the organizer is not
   * left wondering why a match is still open.
   */
  pending_walkovers: { match_id: string; stage: string | null }[];
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

// ------------------------------------------------ bracket generation (plan)

export interface FirstRoundPairPlan {
  position: number;
  is_bye: boolean;
  participant_a_id: string | null;
  participant_a_name: string | null;
  participant_a_city: string | null;
  participant_b_id: string | null;
  participant_b_name: string | null;
  participant_b_city: string | null;
}

// -------------------------------------------------------------- age streams

export interface AgeBandMemberView {
  participant_id: string;
  display_name: string;
  age: number | null;
}

/** One stream a too-wide category would be cut into. */
export interface AgeBandView {
  label: string;
  name: string;
  min_age: number;
  max_age: number;
  /** Holds a single fighter. Reported, never merged away: folding them into
   *  the neighbouring stream is what the age gap exists to prevent. */
  is_lonely: boolean;
  members: AgeBandMemberView[];
}

export interface AgeSplitView {
  competition_id: string;
  competition_name: string;
  max_age_gap: number | null;
  participant_count: number;
  age_min: number | null;
  age_max: number | null;
  age_spread: number;
  /** False when the field already fits inside the allowed gap. */
  split_needed: boolean;
  ready: boolean;
  blockers: QualificationBlocker[];
  bands: AgeBandView[];
}

// ------------------------------------------------------------- group stage

/** One valid way to split the field, offered as an option not a rule. */
export interface GroupLayoutOptionView {
  group_count: number;
  advance_per_group: number;
  group_sizes: number[];
  qualifier_count: number;
  bracket_size: number;
  bye_count: number;
  /** Marked as advice. The platform never applies it on its own. */
  is_default: boolean;
  note: string;
}

export interface GroupLayoutSuggestionView {
  competition_id: string;
  participant_count: number;
  rationale: string;
  options: GroupLayoutOptionView[];
}

export interface GroupSlotView {
  ordinal: number;
  name: string;
  advance_count: number;
  members: { participant_id: string; display_name: string }[];
}

export interface GroupPlanView {
  competition_id: string;
  group_count: number;
  participant_count: number;
  advance_per_group: number;
  qualifier_count: number;
  match_count: number;
  strategy: string;
  separation_satisfied: boolean;
  unavoidable_collisions: CityCollisionView[];
  groups: GroupSlotView[];
}

/**
 * One line of a group table.
 *
 * `rank` is null while the fighters on that record are still tied — the
 * platform does not put a number on a place it did not honestly determine.
 */
export interface GroupStandingRow {
  rank: number | null;
  resolved_by: "RECORD" | "HEAD_TO_HEAD" | "MANUAL" | null;
  participant: ParticipantView | null;
  played: number;
  wins: number;
  losses: number;
  draws: number;
  no_results: number;
  qualifies: boolean;
}

export interface UnresolvedTieView {
  participant_ids: string[];
  participant_names: string[];
  wins: number;
  losses: number;
  reason: string;
}

export interface GroupView {
  id: string;
  ordinal: number;
  name: string;
  advance_count: number;
  complete: boolean;
  decided: boolean;
  rows: GroupStandingRow[];
  unresolved: UnresolvedTieView[];
}

export interface GroupStageView {
  competition_id: string;
  format: CompetitionFormat;
  matches_total: number;
  matches_finished: number;
  decided: boolean;
  groups: GroupView[];
}

export interface QualifierView {
  participant_id: string;
  display_name: string;
  group_ordinal: number;
  group_name: string;
  place_in_group: number;
  seed: number;
}

export interface QualificationBlocker {
  code: string;
  message: string;
  ids: string[];
}

export interface QualificationView {
  competition_id: string;
  ready: boolean;
  blockers: QualificationBlocker[];
  qualifiers: QualifierView[];
  /** The playoff that would be built, or null while something blocks it. */
  plan: BracketPlanView | null;
}

// --------------------------------------------------------- entry-list import

export interface ImportColumnSpec {
  key: string;
  header_ru: string;
  required: boolean;
  note: string;
}

export interface ImportCompetitionSpec {
  id: string;
  name: string;
  age_label: string | null;
}

export interface ImportRowError {
  code: string;
  column: string;
  message: string;
}

/** One spreadsheet row after the server checked it. */
export interface ImportRow {
  row_number: number;
  full_name: string;
  fight_name: string | null;
  city: string | null;
  club: string | null;
  category: string | null;
  birth_year: number | null;
  seed: number | null;
  /** Held back from the draw, waiting to take a withdrawn fighter's place. */
  reserve: boolean;
  /** Resolved from `category`; null when it matched no discipline. */
  competition_id: string | null;
  competition_name: string | null;
  /** Set when an existing profile matched, so no second identity is minted. */
  athlete_id: string | null;
  athlete_display_name: string | null;
  /** Драковое имя when there is one, otherwise ФИО. */
  display_name: string;
  errors: ImportRowError[];
  valid: boolean;
}

export interface ImportReport {
  tournament_id: string;
  columns: ImportColumnSpec[];
  competitions: ImportCompetitionSpec[];
  total_rows: number;
  valid_rows: number;
  rows: ImportRow[];
  /** Category names matching no discipline, listed once rather than per row. */
  unknown_categories: string[];
}

export interface ImportCommitResponse {
  tournament_id: string;
  created: number;
  per_competition: Record<string, number>;
}

/** A first-round pair the draw could not separate, and what they share. */
export interface CityCollisionView {
  position: number;
  /** What they have in common. Club outranks city, so only one is reported. */
  kind: "CLUB" | "CITY" | "GROUP";
  value: string;
  /** The same value narrowed to one kind each, so a client can phrase
   *  "земляки" and "одноклубники" differently without switching on `kind`. */
  city: string | null;
  club: string | null;
  participant_a_id: string;
  participant_b_id: string;
  participant_a_name: string;
  participant_b_name: string;
}

export interface BracketPlanView {
  bracket_size: number;
  participant_count: number;
  bye_count: number;
  round_count: number;
  strategy: string;
  /** False when same-city first-round pairs could not all be avoided; the
   *  collisions are then listed rather than silently accepted. */
  city_constraint_satisfied: boolean;
  /** Wider: false when any club *or* city pair is left unseparated. */
  separation_satisfied: boolean;
  unavoidable_collisions: CityCollisionView[];
  first_round: FirstRoundPairPlan[];
}

// ------------------------------------------------------------- жребий / bout

export interface LotView {
  id: string;
  side: BoutSide;
  method: LotMethod;
  die_value: number;
  weapon: WeaponCategory;
  sequence: number;
  created_at: string;
}

export interface RoundScoreView {
  id: string;
  participant_id: string;
  action_code: string;
  weapon: WeaponCategory;
  points: number | null;
  label: string;
}

/** One соступ. */
export interface MatchRoundView {
  id: string;
  round_number: number;
  status: "IN_PROGRESS" | "COMPLETED";
  points_red: number;
  points_blue: number;
  winner_id: string | null;
  end_reason: string | null;
  notes: string | null;
  scores: RoundScoreView[];
}

export interface BoutDetailView {
  match: MatchView;
  is_final: boolean;
  is_bye: boolean;
  lot_required: boolean;
  weapon_red: WeaponCategory | null;
  weapon_blue: WeaponCategory | null;
  required_rounds_red: number | null;
  required_rounds_blue: number | null;
  win_condition_note: string | null;
  staging_note: string | null;
  lots: LotView[];
  rounds: MatchRoundView[];
  rounds_won_red: number;
  rounds_won_blue: number;
  max_rounds: number;
}

export interface ScoringActionView {
  code: string;
  weapon: WeaponCategory;
  /** null where the primary source defines no point value (кистень, disarm). */
  points: number | null;
  ends_round: boolean;
  ends_bout: boolean;
  label_ru: string;
}

export interface WeaponRulesView {
  weapons: { code: WeaponCategory; label_ru: string; armed: boolean }[];
  die_sides: number;
  die_face_to_weapon: Record<string, WeaponCategory>;
  actions: ScoringActionView[];
  round_target_points: number;
  max_rounds_per_bout: number;
  staging_note_nozh_vs_palka: string;
}

// ------------------------------------------------------------------ champion

export interface ChampionPathEntry {
  match_id: string;
  stage: MatchStage | null;
  round_number: number | null;
  is_bye: boolean;
  opponent: ParticipantView | null;
  won: boolean;
  weapon: WeaponCategory | null;
  opponent_weapon: WeaponCategory | null;
  rounds_won: number;
}

export interface ChampionSummaryView {
  competition_id: string;
  /** False while the final is still open — never a guessed champion. */
  complete: boolean;
  champion: (ParticipantView & { city: string | null; club_id: string | null }) | null;
  path: ChampionPathEntry[];
  completed_at: string | null;
}

// --------------------------------------------------------- трое на трое (3x3)

export interface TeamBoutView {
  id: string;
  competition_id: string;
  team_red_id: string;
  team_blue_id: string;
  team_red_name: string;
  team_blue_name: string;
  status: "SCHEDULED" | "IN_PROGRESS" | "FINISHED";
  wins_red: number;
  wins_blue: number;
  winner_team_id: string | null;
  round_number: number | null;
  position: number | null;
  pairings: MatchView[];
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

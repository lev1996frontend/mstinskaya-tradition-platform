/**
 * Wire types mirroring the FastAPI response models for athletes.
 *
 * Names follow the backend schemas one-to-one so a mismatch is easy to spot.
 */

import type { CompetitionFormat, MatchStage, ParticipantStatus } from "./tournament";

export type AthleteLevel = "BEGINNER" | "PRACTITIONER" | "INSTRUCTOR" | "MASTER";

export interface Athlete {
  id: string;
  user_id: string;
  /**
   * ФИО off the person's own account, «Фамилия Имя» — read-only and derived by
   * the backend from the user the profile belongs to, never stored on the
   * athlete and never sent back. Null only where an account carries neither
   * half of a name.
   */
  full_name: string | null;
  /** Драковое имя. Optional, and often absent — see `athleteName`. */
  nickname: string | null;
  birth_year: number | null;
  experience_years: number;
  level: AthleteLevel;
  bio: string | null;
  photo_url: string | null;
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

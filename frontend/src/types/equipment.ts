/**
 * Wire types mirroring the FastAPI response models for equipment / weapon
 * rules — `GET /api/v1/bout-rules` and the four lot-drawn weapon categories.
 *
 * Names follow the backend schemas one-to-one so a mismatch is easy to spot.
 */

/** The four lot categories. PALKA/NOZH/HANDS are the tradition's official
 *  three; KISTEN is this platform's deliberate fourth. */
export type WeaponCategory = "PALKA" | "NOZH" | "HANDS" | "KISTEN";

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

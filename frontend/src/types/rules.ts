/**
 * Wire types mirroring the FastAPI response models for rules/regulations.
 *
 * Names follow the backend schemas one-to-one so a mismatch is easy to spot.
 */

/** The Word file one edition of the rules was published as. */
export interface RuleSetDocument {
  id: string;
  rule_set_id: string;
  title: string;
  media_file_id: string;
  url: string;
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

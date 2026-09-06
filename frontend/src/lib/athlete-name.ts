import type { Athlete } from "@/types";

/**
 * What to call a fighter, and in what order.
 *
 * A profile carries two names and both are optional in practice: the драковое
 * имя (`nickname`), earned in a fight, and the ФИО (`full_name`) off the
 * person's account. The драковое имя wins wherever there is one — it is what
 * the roster, the bracket and the hall all use — and the ФИО stands in when
 * there is not, which is common: a nickname is not issued with the account.
 *
 * This lived as three slightly different ternaries across the athletes list,
 * the dossier and the organizer's entry search, and the one in the search box
 * could only see `nickname` at all — so a fighter without one was invisible to
 * it and got entered as a brand-new person instead of being linked to the
 * profile they already had.
 */
export function athleteName(athlete: Athlete, fallback = "Без имени"): string {
  return athlete.nickname?.trim() || athlete.full_name?.trim() || fallback;
}

/** Every name the athlete answers to, for matching a typed query against. */
export function athleteMatches(athlete: Athlete, needle: string): boolean {
  const query = needle.trim().toLowerCase();
  if (!query) return false;
  return [athlete.nickname, athlete.full_name].some((name) =>
    (name ?? "").toLowerCase().includes(query),
  );
}

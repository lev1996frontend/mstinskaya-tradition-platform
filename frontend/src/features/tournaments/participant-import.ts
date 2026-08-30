import { readSheet } from "read-excel-file/browser";

import type { Athlete } from "@/types";

/**
 * One row read out of the organizer's spreadsheet, resolved against known
 * athlete profiles client-side. Nothing is written yet — the caller turns
 * these into the same wizard entries a manually typed row would produce, so
 * the actual persistence still goes through the normal participant creation
 * call per entry.
 */
export type ImportedParticipantRow = {
  name: string;
  city: string;
  /** Set when the name matched an existing profile's nickname exactly (case-insensitive). */
  athleteId: string | null;
};

function normalize(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

/**
 * Reads column A (ФИО/позывной) and column B (город), skipping the header
 * row. Rows with an empty name are skipped rather than rejected, since a
 * trailing blank row is common in real spreadsheets.
 */
export async function parseParticipantsExcel(
  file: File,
  athletes: Athlete[],
): Promise<ImportedParticipantRow[]> {
  const rows = await readSheet(file);
  const byNickname = new Map(
    athletes
      .filter((athlete) => athlete.nickname)
      .map((athlete) => [athlete.nickname!.trim().toLowerCase(), athlete.id] as const),
  );

  const result: ImportedParticipantRow[] = [];
  for (const row of rows.slice(1)) {
    const name = normalize(row[0]);
    if (!name) continue;
    const city = normalize(row[1]);
    result.push({ name, city, athleteId: byNickname.get(name.toLowerCase()) ?? null });
  }
  return result;
}

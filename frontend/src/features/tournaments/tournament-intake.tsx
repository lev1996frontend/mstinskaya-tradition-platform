"use client";

import { useRouter } from "next/navigation";

import { useAuth } from "@/features/auth/auth-context";
import { BlankShelf, ParticipantImportPanel } from "./participant-import-panel";

/**
 * Entry lists on a tournament's own page, after the wizard is long finished.
 *
 * The wizard is a one-off: it runs while the event is being created, and a
 * club that sends its заявка a week later had nowhere to land. This is that
 * place — the same panel, on the page the organizer already returns to.
 *
 * Signed out, only the blank form is offered. That link is deliberately public:
 * the coach filling it in is usually not the organizer and usually not signed
 * in, and the file discloses nothing `GET /tournaments/{id}/competitions` does
 * not already serve. Being signed in is not the same as being allowed to enter
 * people — the server decides that and answers 403, which the panel reports.
 */
export function TournamentIntake({ tournamentId }: { tournamentId: string }) {
  const { user } = useAuth();
  const router = useRouter();

  if (!user) {
    // No `download` attribute anywhere in the shelf. The API is a different
    // origin to the site (`:8000` vs `:3000`), and a browser ignores `download`
    // across origins — Chrome then also stops honouring the filename the server
    // sent, saving the file under a generated id with no extension. The
    // server's `Content-Disposition` is what actually names it.
    return (
      <div className="space-y-2">
        <p className="font-record text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">
          Бланк заявки
        </p>
        {/* Same auto-fitting grid `ParticipantImportPanel` uses for this
            shelf plus its own upload action — kept in sync so the two
            blanks aren't sized one way for a signed-in organizer and
            another way for the anonymous coach who usually fills this in. */}
        <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(min(100%,15rem),1fr))]">
          <BlankShelf tournamentId={tournamentId} />
        </div>
      </div>
    );
  }

  return (
    <ParticipantImportPanel
      tournamentId={tournamentId}
      // The roster and the per-discipline counts are rendered on the server,
      // so the page has to be re-fetched for the new entries to appear.
      onCommitted={() => router.refresh()}
    />
  );
}

"use client";

import { Upload } from "lucide-react";
import { useRef, useState } from "react";

import {
  participantTemplateUrl,
  participantWordTemplateUrl,
  previewParticipantImport,
} from "@/api/tournaments";
import { SheetGridMark, SheetLinedMark } from "@/components/brand/sheet-marks";
import { Alert, Button } from "@/components/ui";
import { ApiError, ApiUnreachableError } from "@/lib/api";
import { plural } from "@/lib/format";
import type { ImportReport } from "@/types";

import { ParticipantImportReview } from "./participant-import-review";

/**
 * Download the blank, upload the filled-in files, review, commit.
 *
 * Lives in one component because two screens need the same flow: the wizard
 * while a tournament is being created, and the tournament's own page for
 * everything that arrives afterwards — a club that was late, a discipline added
 * later. Duplicating it would have meant two versions of the review step, and
 * the review step is where the organizer decides who is in the event.
 *
 * Nothing here parses a spreadsheet. Only the backend can tell whether a name
 * is already entered, whether a category names a real discipline, or whether a
 * birth year clears its age bound — `docs/architecture.md` puts validation
 * there for exactly that reason. This screen shows the verdict and sends back
 * what the organizer approved.
 */

function describeError(error: unknown): string {
  if (error instanceof ApiUnreachableError) return "Не удалось связаться с API.";
  if (error instanceof ApiError) {
    if (error.status === 401) return "Требуется вход в систему.";
    if (error.status === 403) return "Загружать заявки может организатор турнира или инструктор.";
    if (error.status === 413) return "Файлы слишком большие для одной заявки.";
    return error.message;
  }
  return "Не удалось прочитать файлы.";
}

/**
 * One blank on the shelf: its mark, its format struck in the record face, and
 * what it is in ordinary words underneath.
 *
 * Deliberately not a `ButtonLink`. A button reads as an action taken on this
 * page; this is a sheet of paper being taken off a shelf, and it looks like the
 * thing it hands over.
 */
function BlankLink({
  href,
  mark,
  format,
  hint,
}: {
  href: string;
  mark: React.ReactNode;
  format: string;
  hint: string;
}) {
  return (
    <a
      href={href}
      className="group flex items-center gap-2.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 transition-colors hover:border-[var(--accent)] focus-visible:border-[var(--accent)]"
    >
      <span className="text-[var(--muted)] transition-colors group-hover:text-[var(--accent)]">
        {mark}
      </span>
      <span className="leading-tight">
        <span className="block font-record text-[11px] uppercase tracking-[0.12em]">
          Бланк · {format}
        </span>
        <span className="block text-[11px] text-[var(--muted)]">{hint}</span>
      </span>
    </a>
  );
}

/**
 * Both blanks, side by side.
 *
 * Exported because the coach who fills one in is usually not signed in and
 * never sees the panel around it — the tournament page shows this shelf on its
 * own to anyone who asks.
 */
export function BlankShelf({ tournamentId }: { tournamentId: string }) {
  return (
    <>
      {/* Ordinary links: both blank routes are public, so there is no token to
          attach and nothing for JavaScript to do. */}
      <BlankLink
        href={participantTemplateUrl(tournamentId)}
        mark={<SheetGridMark size={20} />}
        format="XLSX"
        hint="таблица"
      />
      <BlankLink
        href={participantWordTemplateUrl(tournamentId)}
        mark={<SheetLinedMark size={20} />}
        format="DOCX"
        hint="документ"
      />
    </>
  );
}

export function ParticipantImportPanel({
  tournamentId,
  onCommitted,
  children,
}: {
  tournamentId: string;
  /** Called after the rows land, so the surrounding screen can refresh itself. */
  onCommitted?: (created: number, perCompetition: Record<string, number>) => void;
  /** Extra controls shown beside the two buttons — the wizard adds its own. */
  children?: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: File[]) {
    setBusy(true);
    setSummary(null);
    setReport(null);
    setError(null);
    try {
      const next = await previewParticipantImport(tournamentId, files);
      if (next.total_rows === 0) {
        // The per-file notes are the useful half of an empty report: they say
        // whether a file failed to open or held nothing but the examples.
        const dropped = next.files.reduce((sum, file) => sum + file.skipped_examples, 0);
        const unreadable = next.files.filter((file) => file.error);
        setError(
          unreadable.length > 0
            ? `Не прочитано: ${unreadable.map((file) => file.name).join(", ")}.`
            : dropped > 0
              ? "В файле только строки-примеры из бланка — впишите участников под ними и удалите слово «ПРИМЕР:»."
              : "Ни одной строки с участником не найдено.",
        );
        return;
      }
      setReport(next);
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Two blanks on a shelf rather than one button with a format menu.
          Choosing between Excel and Word is not a setting an organizer adjusts,
          it is which of two sheets they hand a coach — so both lie in view. */}
      <div className="flex flex-wrap items-stretch gap-2">
        <BlankShelf tournamentId={tournamentId} />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={busy}
          className="self-center"
          icon={<Upload className="size-3.5" strokeWidth={2.25} />}
          onClick={() => fileInputRef.current?.click()}
        >
          {busy ? "Проверяем файлы…" : "Загрузить заявки"}
        </Button>
        {children}
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.docx"
          multiple
          className="hidden"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            // Cleared before the request so picking the same file twice in a
            // row still fires a change event.
            event.target.value = "";
            if (files.length > 0) void handleFiles(files);
          }}
        />
      </div>

      <p className="text-xs text-[var(--muted)]">
        Возьмите бланк в удобном формате — в обоих те же колонки и список дисциплин турнира. Бланки
        открыты для всех, так что их можно раздать тренерам клубов, а потом загрузить все присланные
        файлы разом, вперемешку: они проверяются вместе, и одного бойца, заявленного двумя клубами,
        видно сразу. Ничего не сохраняется, пока вы не подтвердите.
      </p>

      {report ? (
        <div className="border-t border-[var(--border)] pt-4">
          <ParticipantImportReview
            report={report}
            onCancel={() => setReport(null)}
            onCommitted={(created, perCompetition) => {
              setReport(null);
              setSummary(
                `Заведено ${plural(created, "участник", "участника", "участников")} из файла.`,
              );
              onCommitted?.(created, perCompetition);
            }}
          />
        </div>
      ) : null}

      {summary ? <Alert tone="success">{summary}</Alert> : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}
    </div>
  );
}

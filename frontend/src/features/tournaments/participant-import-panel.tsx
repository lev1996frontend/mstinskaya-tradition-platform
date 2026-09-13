"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Download, Upload } from "lucide-react";
import { useRef, useState } from "react";

import {
  participantTemplateUrl,
  participantWordTemplateUrl,
  previewParticipantImport,
} from "@/api/tournaments";
import { SHEET_TONE, SheetGridMark, SheetLinedMark } from "@/components/brand/sheet-marks";
import { Alert, Button } from "@/components/ui";
import { ApiError, ApiUnreachableError } from "@/lib/api";
import { plural } from "@/lib/format";
import { IMPULSE_SPRING, STOP_SPRING } from "@/lib/motion";
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
// Same lift the primary Button uses on hover, so a blank on the shelf and a
// button read as one hover language rather than two different ones.
const shelfLiftVariants = { hover: { y: -1, scale: 1.012, transition: STOP_SPRING } };
const shelfIconVariants = { hover: { scale: 1.15, transition: IMPULSE_SPRING } };

function BlankLink({
  href,
  mark,
  tone,
  format,
  hint,
  hintShort,
}: {
  href: string;
  mark: React.ReactNode;
  /** The format's own colour — a hover state, not a permanent identity: the
   * icon rests muted like everything else and only answers a pointer or a
   * keyboard with green/blue, the same way the rest of the site answers
   * hover with a colour shift rather than wearing one at rest. */
  tone: string;
  format: string;
  /** Shown from `sm` up, where the full-width strip has room to spell out
   *  the real difference between the two files. */
  hint: string;
  /** Shown below `sm`: the strip is one column there (see the panel's own
   *  grid), narrower than the full sentence needs — a name for the program
   *  it opens in is what actually matters at that width, the rest is
   *  detail a coach can find on the desktop copy. */
  hintShort: string;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.a
      href={href}
      // The per-instance tone rides in as a CSS variable so the shared
      // record-card-style hover recipe below can be reused as plain
      // Tailwind classes instead of two near-duplicate class strings.
      style={{ "--tone": tone } as React.CSSProperties}
      // The row itself is a CSS grid (`repeat(auto-fit, minmax(...))`, see
      // the panel below) — the same auto-fitting-column pattern the
      // discipline-card grid on this page already uses. That's what decides
      // how many tiles share a line and how wide each is; this tile itself
      // just needs to behave inside whatever track it lands in, which is
      // `min-w-0` (lets it shrink below its own text's width, which is what
      // makes the hint's `truncate` below able to ellipsize instead of
      // forcing its track wider). No `flex-1`/`basis-*`/`max-w-*` here
      // any more — both earlier attempts at sizing the tile *itself*
      // (a fixed width, then a flex-grow-with-cap) fought the grid for
      // control of the same dimension instead of leaving it to the one
      // layout actually deciding column count and width.
      className="group relative flex min-w-0 cursor-pointer items-center justify-start gap-2.5 overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 transition-colors hover:border-[var(--border-strong)] focus-visible:border-[var(--border-strong)]"
      whileHover={reduceMotion ? undefined : "hover"}
      variants={reduceMotion ? undefined : shelfLiftVariants}
    >
      <motion.span
        className="text-[var(--muted)] transition-colors group-hover:text-[var(--tone)] group-focus-visible:text-[var(--tone)]"
        variants={reduceMotion ? undefined : shelfIconVariants}
      >
        {mark}
      </motion.span>
      {/* `min-w-0`: without it a flex child never shrinks below its text's
          own natural width, and `truncate` below would have nothing to
          ellipsize against — the row would just grow (or wrap) instead. */}
      <span className="min-w-0 leading-tight">
        <span className="block truncate font-record text-[11px] uppercase tracking-[0.12em]">
          Бланк · {format}
        </span>
        <span className="hidden truncate text-[11px] text-[var(--muted)] sm:block">{hint}</span>
        <span className="block truncate text-[11px] text-[var(--muted)] sm:hidden">{hintShort}</span>
      </span>
      {/* `ml-auto` pins this to the strip's right edge. Full-width made the
          left-aligned icon+text read as adrift in leftover space; a trailing
          affordance glyph is the conventional close for a downloadable-
          resource row (the row itself already tells you it downloads — this
          only marks where the row ends, in the same muted-to-tone hover as
          the mark on the left) and gives the strip a right edge to end on. */}
      <Download
        aria-hidden="true"
        className="ml-auto size-3.5 shrink-0 text-[var(--muted)] transition-colors group-hover:text-[var(--tone)] group-focus-visible:text-[var(--tone)]"
        strokeWidth={2}
      />
      {/* The same drawn bottom rule the discipline cards answer a hover with
          (`.record-card::after` in globals.css) — reused here rather than
          invented fresh, tinted to this format's own colour instead of the
          site's oxblood accent, so it reads as one more card in the same
          family rather than a one-off effect. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-0 bg-[var(--tone)] transition-transform duration-[260ms] ease-[var(--ease-out)] group-hover:scale-x-100 group-focus-visible:scale-x-100 motion-reduce:transition-none"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[var(--radius-md)] opacity-0 outline outline-1 -outline-offset-1 outline-[color-mix(in_srgb,var(--tone)_35%,transparent)] transition-opacity duration-[220ms] ease-out group-hover:opacity-100 group-focus-visible:opacity-100"
      />
    </motion.a>
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
      {/* The hint used to just say "таблица"/"документ" — the format
          already visible from the mark and the "Бланк · XLSX/DOCX" label
          right above it, so it repeated information rather than adding any.
          Named two real things instead: which program actually opens it
          (a coach reads "XLSX" less readily than "Excel") and the one real
          structural difference between the files (confirmed from the actual
          generated templates, not guessed): the XLSX's "Категория" column
          carries a dropdown validated against its own "Дисциплины" sheet,
          and the DOCX has no such thing — same columns, same disciplines
          list, but as a plain table meant for printing or filling in by
          hand.

          `hintShort` drops the structural detail, not the program name — at
          phone width the full-width strip is one column and short on room,
          and "which app do I need" matters more there than "how the
          dropdown works", which the desktop copy still says in full. */}
      <BlankLink
        href={participantTemplateUrl(tournamentId)}
        mark={<SheetGridMark size={20} />}
        tone={SHEET_TONE.xlsx}
        format="XLSX"
        hint="Excel — с выпадающим списком дисциплин"
        hintShort="Excel"
      />
      <BlankLink
        href={participantWordTemplateUrl(tournamentId)}
        mark={<SheetLinedMark size={20} />}
        tone={SHEET_TONE.docx}
        format="DOCX"
        hint="Word — та же таблица, для печати или руки"
        hintShort="Word"
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
          it is which of two sheets they hand a coach — so both lie in view.

          Three layouts tried before this one: a fixed 3-column grid (equal
          thirds of a wide row is a lot more box than "an icon, two short
          lines, an icon" ever needed), a flex-wrap row with a fixed tile
          width (the dead space just moved from inside each tile to a gap at
          the row's own trailing edge), and flex-grow with a max-width cap
          (the cap itself then blocked a tile from reaching full width on a
          narrow screen where only one fit per line). Settled on the same
          `repeat(auto-fit, minmax(...))` grid the discipline-card list above
          this panel already uses: it picks however many equal-width columns
          actually fit the row (3, 2, or 1), stretches them to fill it edge
          to edge with no leftover gap, and reflows on its own as the
          viewport changes — no breakpoint hardcodes which count goes where,
          and no per-tile width fights the row for control of the same
          dimension. `min(100%, 15rem)`, not a bare `15rem`: below 240px the
          track would otherwise force horizontal scroll, the one thing this
          codebase's own layout audits explicitly refuse to allow through. */}
      <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(min(100%,15rem),1fr))]">
        <BlankShelf tournamentId={tournamentId} />
        {/* The wrapper exists only to carry the same record-card-style
            hover (drawn bottom rule + inward ring) the two blanks answer a
            pointer with — tinted with the site's own accent here instead of
            a file format's colour, since this is an action, not a format,
            but the same recipe so the whole row reads as one hover
            language rather than a plain tile pair beside a plain button. */}
        <div className="group relative isolate flex min-w-0 overflow-hidden rounded-[var(--radius-md)]">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy}
            // `justify-center`, not `justify-start` like the two blanks
            // beside it: those carry a two-line label+description block that
            // reads naturally left-aligned; this is one line, icon and all,
            // and centers inside its own tile instead of hugging one edge.
            className="h-full w-full justify-center"
            icon={<Upload className="size-3.5" strokeWidth={2.25} />}
            onClick={() => fileInputRef.current?.click()}
          >
            {busy ? "Проверяем файлы…" : "Загрузить заявки"}
          </Button>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-0 bg-[var(--accent)] transition-transform duration-[260ms] ease-[var(--ease-out)] group-hover:scale-x-100 group-focus-within:scale-x-100 motion-reduce:transition-none"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-[var(--radius-md)] opacity-0 outline outline-1 -outline-offset-1 outline-[color-mix(in_srgb,var(--accent)_35%,transparent)] transition-opacity duration-[220ms] ease-out group-hover:opacity-100 group-focus-within:opacity-100"
          />
        </div>
        {/* The wizard's own "Добавить участника" button rides in through
            `children` as a fourth item — `col-span-full` (grid's own
            "take every column" span, the equivalent of the old flex
            `basis-full`) forces it onto its own full-width row regardless
            of how many columns the auto-fit grid above chose, since it's
            shaped differently again from the three fixed ones and was never
            meant to share a line with them. */}
        {children ? <div className="col-span-full">{children}</div> : null}
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

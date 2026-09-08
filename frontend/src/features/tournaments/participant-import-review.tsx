"use client";

import { AlertTriangle, Check } from "lucide-react";
import { useMemo, useState } from "react";

import { commitParticipantImport } from "@/api/tournaments";
import { SheetMark } from "@/components/brand/sheet-marks";
import { Alert, Badge, Button, Table, Td, Th, cn } from "@/components/ui";
import { Select } from "@/components/ui/form";
import { ApiError, ApiUnreachableError } from "@/lib/api";
import { plural } from "@/lib/format";
import type { ImportReport, ImportRow } from "@/types";

/**
 * The per-row verdict on an uploaded entry list.
 *
 * Every judgement here came from the server — which rows are valid, why a row
 * is not, which discipline a category resolved to. Nothing is re-decided in the
 * browser, and the commit re-validates whatever this sends, so editing a
 * discipline below is a request, not an override.
 *
 * A row can be excluded rather than fixed: a spreadsheet often carries a name
 * the organizer decides not to enter, and forcing them back into Excel to
 * delete one line would be worse than letting them untick it.
 */

/** Identity of a row across the whole upload: the file it came from, then its number. */
function keyOf(row: ImportRow): string {
  return `${row.source_file ?? ""}#${row.row_number}`;
}

function describeError(error: unknown): string {
  if (error instanceof ApiUnreachableError) return "Не удалось связаться с API.";
  if (error instanceof ApiError) {
    if (error.status === 401) return "Требуется вход в систему.";
    if (error.status === 403) return "Действие доступно организатору или инструктору.";
    if (error.status === 400) return "Сервер отклонил заявку — проверьте отмеченные строки.";
    return error.message;
  }
  return "Не удалось сохранить заявки.";
}

export function ParticipantImportReview({
  report,
  onCommitted,
  onCancel,
}: {
  report: ImportReport;
  onCommitted: (created: number, perCompetition: Record<string, number>) => void;
  onCancel: () => void;
}) {
  // Rows are held locally so the organizer can retarget a discipline or drop a
  // line before committing; the server checks all of it again regardless.
  const [rows, setRows] = useState<ImportRow[]>(report.rows);
  // Keyed by file *and* row: several clubs send several files, and every one of
  // them has a row 5. Keying on the number alone silently excluded a stranger.
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // One key per review session: while the organizer edits rows, however many times
  // they click «Завести» it stays the same request. New report means a new component
  // and therefore a new key.
  const [idempotencyKey] = useState(() =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );

  const included = useMemo(() => rows.filter((row) => !excluded.has(keyOf(row))), [rows, excluded]);
  const blocking = included.filter((row) => !row.valid);
  // Worth naming files in the table only when there is more than one to tell
  // apart; a single upload would just repeat the same name down the column.
  const manyFiles = report.files.length > 1;
  const skippedExamples = report.files.reduce((sum, file) => sum + file.skipped_examples, 0);
  const unreadable = report.files.filter((file) => file.error);

  function retarget(key: string, competitionId: string) {
    const competition = report.competitions.find((item) => item.id === competitionId);
    setRows((current) =>
      current.map((row) =>
        keyOf(row) === key
          ? {
              ...row,
              competition_id: competitionId,
              competition_name: competition?.name ?? null,
              category: competition?.name ?? row.category,
            }
          : row,
      ),
    );
  }

  function toggle(key: string) {
    setExcluded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function commit() {
    setSaving(true);
    setError(null);
    try {
      const result = await commitParticipantImport(report.tournament_id, included, idempotencyKey);
      onCommitted(result.created, result.per_competition);
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={report.valid_rows === report.total_rows ? "success" : "warning"}>
          {report.valid_rows} из {report.total_rows} строк без ошибок
        </Badge>
        {excluded.size > 0 ? <Badge>исключено {excluded.size}</Badge> : null}
      </div>

      {unreadable.length > 0 ? (
        <Alert tone="danger" title="Эти файлы не прочитались">
          <ul className="space-y-0.5">
            {unreadable.map((file) => (
              <li key={file.name} className="flex items-start gap-1.5">
                <SheetMark name={file.name} size={14} className="mt-0.5 shrink-0" />
                <span>
                  <span className="font-medium">{file.name}</span> — {file.error}
                </span>
              </li>
            ))}
          </ul>
          Остальные файлы разобраны, их можно завести и без этих.
        </Alert>
      ) : null}

      {skippedExamples > 0 ? (
        <Alert tone="warning" title="Строки-примеры пропущены">
          {plural(skippedExamples, "строка", "строки", "строк")} из бланка{" "}
          {skippedExamples === 1 ? "осталась" : "остались"} со словом «ПРИМЕР:» в ФИО и{" "}
          {skippedExamples === 1 ? "не попала" : "не попали"} в заявку. Если вы вписывали бойца
          поверх примера — удалите это слово и загрузите файл заново.
        </Alert>
      ) : null}

      {report.unknown_categories.length > 0 ? (
        <Alert tone="warning" title="Категории не совпали с дисциплинами">
          {report.unknown_categories.join(", ")}. Выберите дисциплину в строке или поправьте файл —
          название должно совпадать с одной из дисциплин турнира.
        </Alert>
      ) : null}

      <div className="scroll-x">
        <Table>
          <thead>
            <tr>
              <Th align="center" className="w-12">
                №
              </Th>
              <Th>Боец</Th>
              <Th className="w-56">Дисциплина</Th>
              <Th className="hidden w-40 md:table-cell">Город и клуб</Th>
              <Th className="w-64">Проверка</Th>
              <Th align="right" className="w-24">
                В заявку
              </Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const key = keyOf(row);
              const off = excluded.has(key);
              return (
                <tr key={key} className={cn(off && "opacity-45")}>
                  <Td align="center" className="font-record text-[var(--muted)]">
                    {row.row_number}
                    {manyFiles && row.source_file ? (
                      <span
                        className="mt-0.5 flex items-center justify-center gap-1"
                        title={row.source_file}
                      >
                        <SheetMark name={row.source_file} size={12} />
                        <span className="max-w-16 truncate text-[10px] normal-case">
                          {row.source_file}
                        </span>
                      </span>
                    ) : null}
                  </Td>
                  <Td>
                    <span className="block font-medium">{row.display_name || "—"}</span>
                    {row.fight_name ? (
                      <span className="block text-xs text-[var(--muted)]">{row.full_name}</span>
                    ) : null}
                    {row.athlete_id ? (
                      <span className="mt-0.5 block text-[11px] text-[var(--accent)]">
                        привязан профиль {row.athlete_display_name}
                      </span>
                    ) : null}
                  </Td>
                  <Td>
                    <Select
                      value={row.competition_id ?? ""}
                      onChange={(event) => retarget(key, event.target.value)}
                      aria-label={`Дисциплина в строке ${row.row_number}${
                        row.source_file ? ` файла ${row.source_file}` : ""
                      }`}
                    >
                      <option value="">— не выбрана —</option>
                      {report.competitions.map((competition) => (
                        <option key={competition.id} value={competition.id}>
                          {competition.name}
                          {competition.age_label ? ` · ${competition.age_label}` : ""}
                        </option>
                      ))}
                    </Select>
                  </Td>
                  <Td className="hidden text-sm text-[var(--muted)] md:table-cell">
                    {[row.city, row.club].filter(Boolean).join(" · ") || "—"}
                  </Td>
                  <Td>
                    {row.errors.length === 0 ? (
                      <span className="inline-flex items-center gap-1.5 text-sm text-[var(--success)]">
                        <Check className="size-3.5" strokeWidth={2.5} />
                        готово
                      </span>
                    ) : (
                      <ul className="space-y-1">
                        {row.errors.map((problem) => (
                          <li
                            key={problem.code}
                            className="flex items-start gap-1.5 text-xs text-[var(--danger)]"
                          >
                            <AlertTriangle className="mt-0.5 size-3 shrink-0" strokeWidth={2} />
                            <span>{problem.message}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Td>
                  <Td align="right">
                    <input
                      type="checkbox"
                      checked={!off}
                      onChange={() => toggle(key)}
                      aria-label={`Включить строку ${row.row_number}${
                        row.source_file ? ` файла ${row.source_file}` : ""
                      } в заявку`}
                      className="size-4 accent-[var(--accent)]"
                    />
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </div>

      {blocking.length > 0 ? (
        <Alert tone="warning" title="Эти строки не дадут сохранить заявку">
          Поправьте дисциплину прямо здесь, исключите строку или загрузите исправленный файл.
          Частично заявка не заводится: либо вся, либо ничего.
        </Alert>
      ) : null}

      {error ? <Alert tone="danger">{error}</Alert> : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={saving || included.length === 0 || blocking.length > 0}
          onClick={() => void commit()}
        >
          {saving ? "Сохраняем…" : `Завести участников (${included.length})`}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
          Загрузить другие файлы
        </Button>
      </div>
    </div>
  );
}

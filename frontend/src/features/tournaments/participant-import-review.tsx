"use client";

import { AlertTriangle, Check } from "lucide-react";
import { useMemo, useState } from "react";

import { commitParticipantImport } from "@/api/tournaments";
import { Alert, Badge, Button, Table, Td, Th, cn } from "@/components/ui";
import { Select } from "@/components/ui/form";
import { ApiError, ApiUnreachableError } from "@/lib/api";
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
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const included = useMemo(
    () => rows.filter((row) => !excluded.has(row.row_number)),
    [rows, excluded],
  );
  const blocking = included.filter((row) => !row.valid);

  function retarget(rowNumber: number, competitionId: string) {
    const competition = report.competitions.find((item) => item.id === competitionId);
    setRows((current) =>
      current.map((row) =>
        row.row_number === rowNumber
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

  function toggle(rowNumber: number) {
    setExcluded((current) => {
      const next = new Set(current);
      if (next.has(rowNumber)) next.delete(rowNumber);
      else next.add(rowNumber);
      return next;
    });
  }

  async function commit() {
    setSaving(true);
    setError(null);
    try {
      const result = await commitParticipantImport(report.tournament_id, included);
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
              const off = excluded.has(row.row_number);
              return (
                <tr key={row.row_number} className={cn(off && "opacity-45")}>
                  <Td align="center" className="font-record text-[var(--muted)]">
                    {row.row_number}
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
                      onChange={(event) => retarget(row.row_number, event.target.value)}
                      aria-label={`Дисциплина в строке ${row.row_number}`}
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
                      onChange={() => toggle(row.row_number)}
                      aria-label={`Включить строку ${row.row_number} в заявку`}
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
          Загрузить другой файл
        </Button>
      </div>
    </div>
  );
}

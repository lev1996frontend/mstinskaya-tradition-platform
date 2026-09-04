"use client";

import { LayoutGrid } from "lucide-react";
import { useEffect, useState } from "react";

import { generateGroups, previewGroups, suggestGroups } from "@/api/tournaments";
import { Alert, Badge, Button, Card, cn } from "@/components/ui";
import { Field, Input } from "@/components/ui/form";
import { ApiError, ApiUnreachableError } from "@/lib/api";
import type { GroupLayoutOptionView, GroupPlanView, GroupLayoutSuggestionView } from "@/types";

import { CityVerdict } from "./bracket-generator";

/**
 * Setting up a group stage.
 *
 * The options below are a suggestion and say so. `docs/domain-model.md` §5
 * forbids inventing tournament formats, so how many subgroups there are and how
 * many come out of each is the organizer's call — the marked option is only the
 * ordinary shape for a field this size, and the request carries no defaults, so
 * nothing can be built that nobody chose.
 *
 * The preview is a real backend dry run: the same deal that will be written,
 * including which clubmates and townsmen it could not separate.
 */

function describeError(error: unknown): string {
  if (error instanceof ApiUnreachableError) return "Не удалось связаться с API.";
  if (error instanceof ApiError) {
    if (error.status === 401) return "Требуется вход в систему.";
    if (error.status === 403) return "Действие доступно организатору или инструктору.";
    if (error.status === 409) return "В дисциплине уже есть бои — групповой этап строится до них.";
    return error.message;
  }
  return "Не удалось построить подгруппы.";
}

function OptionButton({
  option,
  active,
  onPick,
}: {
  option: GroupLayoutOptionView;
  active: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={active}
      className={cn(
        "rounded-[var(--radius-sm)] border px-3 py-2 text-left transition-colors",
        active
          ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
          : "border-[var(--border-strong)] text-[var(--muted)] hover:bg-[var(--surface-muted)]",
      )}
    >
      <span className="flex items-center gap-2 text-sm font-medium">
        {option.group_count} × {option.advance_per_group}
        {option.is_default ? <Badge tone="info">обычный вариант</Badge> : null}
      </span>
      <span className="mt-0.5 block text-xs opacity-80">{option.note}</span>
    </button>
  );
}

export function GroupStageConfig({
  competitionId,
  onGenerated,
}: {
  competitionId: string;
  onGenerated: () => void;
}) {
  const [suggestion, setSuggestion] = useState<GroupLayoutSuggestionView | null>(null);
  const [groupCount, setGroupCount] = useState("");
  const [advance, setAdvance] = useState("");
  const [plan, setPlan] = useState<GroupPlanView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const body = await suggestGroups(competitionId);
        setSuggestion(body);
      } catch (caught) {
        setError(describeError(caught));
      }
    })();
  }, [competitionId]);

  // Deliberately not pre-filled from the suggestion: the organizer has to state
  // the numbers, or the platform would be choosing the format by default.
  const numbers =
    groupCount.trim() && advance.trim()
      ? { group_count: Number(groupCount), advance_per_group: Number(advance) }
      : null;

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-4 p-5">
      <div>
        <h3 className="font-display text-lg font-semibold tracking-tight">Подгруппы</h3>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {suggestion
            ? `Заявлено участников: ${suggestion.participant_count}. ${suggestion.rationale}`
            : "Загружаем варианты…"}
        </p>
      </div>

      {suggestion && suggestion.options.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {suggestion.options.map((option) => (
            <OptionButton
              key={`${option.group_count}-${option.advance_per_group}`}
              option={option}
              active={
                numbers?.group_count === option.group_count &&
                numbers?.advance_per_group === option.advance_per_group
              }
              onPick={() => {
                setGroupCount(String(option.group_count));
                setAdvance(String(option.advance_per_group));
                setPlan(null);
              }}
            />
          ))}
        </div>
      ) : suggestion ? (
        <Alert tone="warning" title="Участников слишком мало">
          Для группового этапа нужно хотя бы трое, и в подгруппе должно оставаться больше бойцов,
          чем из неё выходит.
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Сколько подгрупп">
          {(props) => (
            <Input
              {...props}
              value={groupCount}
              onChange={(event) => {
                setGroupCount(event.target.value);
                setPlan(null);
              }}
              inputMode="numeric"
              placeholder="2"
            />
          )}
        </Field>
        <Field label="Сколько выходит из каждой">
          {(props) => (
            <Input
              {...props}
              value={advance}
              onChange={(event) => {
                setAdvance(event.target.value);
                setPlan(null);
              }}
              inputMode="numeric"
              placeholder="3"
            />
          )}
        </Field>
      </div>

      {plan ? (
        <div className="space-y-3 border-t border-[var(--border)] pt-3">
          <p className="text-sm text-[var(--muted)]">
            Боёв в групповом этапе: {plan.match_count}. Выйдет в плей-офф: {plan.qualifier_count}.
          </p>
          <CityVerdict
            plan={{
              ...plan,
              bracket_size: 0,
              bye_count: 0,
              round_count: 0,
              city_constraint_satisfied: !plan.unavoidable_collisions.some(
                (collision) => collision.kind === "CITY",
              ),
              first_round: [],
            }}
          />
          <ul className="grid gap-3 sm:grid-cols-2">
            {plan.groups.map((group) => (
              <li key={group.ordinal} className="rounded-[var(--radius-sm)] border border-[var(--border)] p-3">
                <p className="record-label text-[var(--chrome-muted)]">{group.name}</p>
                <ol className="mt-1.5 space-y-0.5 text-sm">
                  {group.members.map((member, index) => (
                    <li key={member.participant_id} className="flex gap-2">
                      <span className="font-record text-xs text-[var(--muted)]">{index + 1}</span>
                      <span className="min-w-0 truncate">{member.display_name}</span>
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? <Alert tone="danger">{error}</Alert> : null}

      <div className="flex flex-wrap gap-2 border-t border-[var(--border)] pt-3">
        <Button
          type="button"
          variant="secondary"
          disabled={!numbers || busy}
          onClick={() =>
            void run(async () => {
              if (numbers) setPlan(await previewGroups(competitionId, numbers));
            })
          }
        >
          {busy ? "Считаем…" : "Показать раскладку"}
        </Button>
        <Button
          type="button"
          disabled={!numbers || busy}
          icon={<LayoutGrid className="size-3.5" strokeWidth={2.25} />}
          onClick={() =>
            void run(async () => {
              if (!numbers) return;
              await generateGroups(competitionId, numbers);
              onGenerated();
            })
          }
        >
          Построить подгруппы
        </Button>
      </div>
    </Card>
  );
}

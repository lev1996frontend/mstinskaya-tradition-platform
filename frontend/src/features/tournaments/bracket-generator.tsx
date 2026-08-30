"use client";

import { CheckCircle2, Network, TriangleAlert } from "lucide-react";
import { useState } from "react";

import { generateBracket, previewBracket } from "@/api/tournaments";
import { Alert, Badge, Button, Card, cn } from "@/components/ui";
import { ApiError, ApiUnreachableError } from "@/lib/api";
import { weaponCategory } from "@/lib/labels";
import type { BracketPlanView, WeaponCategory } from "@/types";

import { WeaponGlyph } from "./weapon-mark";

/**
 * Distribution review: the organizer sees the bracket shape, the byes and the
 * city verdict *before* committing.
 *
 * The preview is a real backend dry run — the same algorithm that will build
 * the bracket — so what is shown here is what gets written, except for the
 * random element of the draw itself, which is re-rolled on generate.
 */

function describeError(error: unknown): string {
  if (error instanceof ApiUnreachableError) return "Не удалось связаться с API.";
  if (error instanceof ApiError) {
    if (error.status === 401) return "Требуется вход в систему.";
    if (error.status === 403) return "Сетку строит организатор или инструктор.";
    if (error.status === 409) return "Сетка для этой дисциплины уже построена.";
    return error.message;
  }
  return "Не удалось построить сетку.";
}

export function CityVerdict({ plan }: { plan: BracketPlanView }) {
  if (plan.city_constraint_satisfied) {
    return (
      <Alert tone="success" title="В первом круге нет земляков">
        Ни одна пара первого круга не сводит участников из одного города.
      </Alert>
    );
  }
  return (
    <Alert tone="warning" title="Не удалось полностью развести земляков">
      <p>
        Размер сетки не позволяет избежать всех встреч участников из одного города. Эти пары
        останутся:
      </p>
      <ul className="mt-2 space-y-1">
        {plan.unavoidable_collisions.map((collision) => (
          <li key={`${collision.position}-${collision.participant_a_id}`} className="text-sm">
            <span className="font-display tabular-nums">№{collision.position}</span>{" "}
            {collision.participant_a_name} — {collision.participant_b_name}{" "}
            <span className="text-[var(--muted)]">({collision.city})</span>
          </li>
        ))}
      </ul>
    </Alert>
  );
}

export function PlanSummary({ plan }: { plan: BracketPlanView }) {
  return (
    <div className="grid gap-2 sm:grid-cols-4">
      {[
        { label: "Участников", value: plan.participant_count },
        { label: "Размер сетки", value: plan.bracket_size },
        { label: "Свободных проходов", value: plan.bye_count },
        { label: "Кругов", value: plan.round_count },
      ].map((item) => (
        <div
          key={item.label}
          className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
        >
          <div className="record-label text-[var(--iron-muted)]">{item.label}</div>
          <div className="font-display mt-0.5 text-xl font-semibold tabular-nums">{item.value}</div>
        </div>
      ))}
    </div>
  );
}

export function PairPreview({ plan }: { plan: BracketPlanView }) {
  return (
    <ul className="grid gap-1.5 sm:grid-cols-2">
      {plan.first_round.map((pair) => {
        const collision =
          !!pair.participant_a_city &&
          pair.participant_a_city.trim().toLowerCase() ===
            pair.participant_b_city?.trim().toLowerCase();
        return (
          <li
            key={pair.position}
            className={cn(
              "flex items-center gap-2 rounded-[var(--radius-sm)] border px-3 py-2 text-sm",
              collision
                ? "border-[var(--warning)]/60 bg-[var(--warning-soft)]"
                : "border-[var(--border)] bg-[var(--surface)]",
            )}
          >
            <span className="font-display w-5 shrink-0 tabular-nums text-[var(--muted)]">
              {pair.position}
            </span>
            <span className="min-w-0 flex-1 truncate">
              {pair.participant_a_name ?? <em className="text-[var(--muted)]">свободно</em>}
              {pair.participant_a_city ? (
                <span className="text-[var(--muted)]"> · {pair.participant_a_city}</span>
              ) : null}
            </span>
            <span className="shrink-0 text-[var(--muted)]">—</span>
            <span className="min-w-0 flex-1 truncate">
              {pair.participant_b_name ?? <em className="text-[var(--muted)]">свободно</em>}
              {pair.participant_b_city ? (
                <span className="text-[var(--muted)]"> · {pair.participant_b_city}</span>
              ) : null}
            </span>
            {pair.is_bye ? <Badge tone="info">Проход</Badge> : null}
          </li>
        );
      })}
    </ul>
  );
}

const WEAPONS: WeaponCategory[] = ["PALKA", "NOZH", "HANDS", "KISTEN"];

export function BracketGenerator({
  competitionId,
  participantCount,
  onGenerated,
}: {
  competitionId: string;
  participantCount: number;
  onGenerated: () => void;
}) {
  const [plan, setPlan] = useState<BracketPlanView | null>(null);
  const [finalWeapon, setFinalWeapon] = useState<WeaponCategory | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<BracketPlanView>, keepPlan: boolean) {
    setBusy(true);
    setError(null);
    try {
      const result = await action();
      if (keepPlan) setPlan(result);
      else onGenerated();
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setBusy(false);
    }
  }

  if (participantCount < 2) {
    return (
      <Alert tone="info" title="Недостаточно участников">
        Для сетки нужно минимум двое заявленных бойцов.
      </Alert>
    );
  }

  return (
    <Card className="space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Network className="size-4 text-[var(--accent)]" strokeWidth={2} />
            Построение сетки
          </h3>
          <p className="mt-1 max-w-prose text-sm text-[var(--muted)]">
            Сетка достраивается до ближайшей степени двойки, недостающие места становятся
            свободными проходами. Земляков разводят по разным парам, насколько позволяет размер
            сетки.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={() => void run(() => previewBracket(competitionId), true)}
        >
          {busy && !plan ? "Считаем…" : "Проверить распределение"}
        </Button>
      </div>

      {plan ? (
        <div className="space-y-3">
          <PlanSummary plan={plan} />
          <CityVerdict plan={plan} />
          <PairPreview plan={plan} />

          <div className="space-y-2 border-t border-[var(--border)] pt-3">
            <p className="record-label text-[var(--iron-muted)]">Оружие финала</p>
            <p className="text-xs text-[var(--muted)]">
              В финале жребий не бросается — оружие задаётся правилами турнира заранее.
            </p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setFinalWeapon(null)}
                aria-pressed={finalWeapon === null}
                className={cn(
                  "rounded-[var(--radius-sm)] border px-2.5 py-1.5 text-xs transition-colors",
                  finalWeapon === null
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "border-[var(--border-strong)] text-[var(--muted)] hover:bg-[var(--surface-muted)]",
                )}
              >
                Не задавать
              </button>
              {WEAPONS.map((weapon) => {
                const active = finalWeapon === weapon;
                return (
                  <button
                    key={weapon}
                    type="button"
                    onClick={() => setFinalWeapon(weapon)}
                    aria-pressed={active}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border px-2.5 py-1.5 text-xs transition-colors",
                      active
                        ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                        : "border-[var(--border-strong)] text-[var(--muted)] hover:bg-[var(--surface-muted)]",
                    )}
                  >
                    <WeaponGlyph weapon={weapon} size={14} />
                    {weaponCategory[weapon]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {error ? <Alert tone="danger">{error}</Alert> : null}

      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-3">
        <Button
          type="button"
          disabled={busy}
          icon={
            plan?.city_constraint_satisfied === false ? (
              <TriangleAlert className="size-3.5" strokeWidth={2.25} />
            ) : (
              <CheckCircle2 className="size-3.5" strokeWidth={2.25} />
            )
          }
          onClick={() =>
            void run(() => generateBracket(competitionId, { final_weapon: finalWeapon }), false)
          }
        >
          {busy ? "Строим…" : "Построить сетку"}
        </Button>
        {plan?.city_constraint_satisfied === false ? (
          <span className="text-xs text-[var(--muted)]">
            Сетка будет построена с указанными встречами земляков.
          </span>
        ) : null}
      </div>
    </Card>
  );
}

"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Info, Play, Swords, Trophy, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import {
  completeRound,
  getBout,
  getBoutRules,
  openRound,
  recordRoundScore,
  startBout,
} from "@/api/tournaments";
import { Alert, Badge, Button, TwoSided, cn } from "@/components/ui";
import { Avatar } from "@/components/ui/avatar";
import { ApiError, ApiUnreachableError } from "@/lib/api";
import {
  labelOf,
  matchStage,
  resultMethod,
  roundEndReason,
  weaponCategory,
} from "@/lib/labels";
import { stepIn } from "@/lib/motion";
import type {
  BoutDetailView,
  MatchRoundView,
  ParticipantView,
  ScoringActionView,
  WeaponCategory,
  WeaponRulesView,
} from "@/types";

import { LotDice } from "./lot-dice";
import { WeaponMark } from "./weapon-mark";

/**
 * One поединок, run for real.
 *
 * Every control here is a backend transition, and every piece of state shown is
 * re-read from the backend after it. Nothing about the outcome — who won a
 * соступ, whether the поединок is over, who advances — is decided in this file;
 * it all comes back from the server, which is why closing and reopening the
 * panel (or reloading the page) shows exactly the same thing.
 */

function describeError(error: unknown): string {
  if (error instanceof ApiUnreachableError) return "Не удалось связаться с API.";
  if (error instanceof ApiError) {
    if (error.status === 401) return "Требуется вход в систему.";
    if (error.status === 403) return "Действие доступно организатору или инструктору.";
    return error.message;
  }
  return "Не удалось выполнить действие.";
}

// ------------------------------------------------------------------ header

function FighterColumn({
  participant,
  weapon,
  roundsWon,
  required,
  isWinner,
  isLive,
  sideLabel,
}: {
  participant: ParticipantView | null;
  weapon: WeaponCategory | null;
  roundsWon: number;
  required: number | null;
  isWinner: boolean;
  /** The поединок is running and undecided — rings the fighter as "this is
   *  who the moment is about," the same circle vocabulary as a decided win. */
  isLive: boolean;
  sideLabel: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 flex-1 rounded-[var(--radius-sm)] border p-3",
        isWinner ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)]",
      )}
    >
      <p className="record-label text-[var(--chrome-muted)]">{sideLabel}</p>
      <div className="mt-1.5 flex items-center gap-2.5">
        {participant ? (
          <span
            className={cn(
              "rounded-full p-0.5",
              isWinner
                ? "ring-2 ring-[var(--accent)]"
                : isLive
                  ? "ring-2 ring-[var(--live)]"
                  : undefined,
            )}
          >
            <Avatar name={participant.display_name} size="sm" />
          </span>
        ) : null}
        <p className="flex min-w-0 items-center gap-1.5 truncate font-semibold">
          {participant?.display_name ?? "—"}
          {isWinner ? (
            <Trophy className="size-4 shrink-0 text-[var(--accent)]" strokeWidth={2.25} />
          ) : null}
        </p>
      </div>
      {participant?.city ? (
        <p className="mt-1 truncate text-xs text-[var(--muted)]">{participant.city}</p>
      ) : null}
      <div className="mt-2">
        <WeaponMark weapon={weapon} />
      </div>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Соступов:{" "}
        <span className="font-record text-[var(--foreground)]">
          {roundsWon}
          {required !== null ? ` / ${required}` : null}
        </span>
      </p>
    </div>
  );
}

// ------------------------------------------------------------------ соступ

function RoundCard({
  round,
  redId,
  blueId,
  redName,
  blueName,
}: {
  round: MatchRoundView;
  redId: string | null;
  blueId: string | null;
  redName: string;
  blueName: string;
}) {
  const winnerName =
    round.winner_id === redId ? redName : round.winner_id === blueId ? blueName : null;

  return (
    <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold">Соступ {round.round_number}</span>
        {round.status === "IN_PROGRESS" ? (
          <Badge tone="active" pulse>
            Идёт
          </Badge>
        ) : (
          <Badge tone="success">
            {winnerName ?? "Завершён"}
            {round.end_reason ? ` · ${labelOf(roundEndReason, round.end_reason)}` : ""}
          </Badge>
        )}
      </div>

      <p className="font-record mt-1.5 text-lg">
        {round.points_red} : {round.points_blue}
      </p>

      {round.scores.length > 0 ? (
        <ul className="mt-2 space-y-1 border-t border-[var(--border)] pt-2">
          {round.scores.map((score) => (
            <li key={score.id} className="flex items-start justify-between gap-2 text-xs">
              <span className="min-w-0 text-[var(--muted)]">
                <span className="font-medium text-[var(--foreground)]">
                  {score.participant_id === redId ? redName : blueName}
                </span>
                {" — "}
                {score.label}
              </span>
              <span className="font-record shrink-0">
                {score.points === null ? "—" : `+${score.points}`}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {round.notes ? <p className="mt-2 text-xs text-[var(--muted)]">{round.notes}</p> : null}
    </div>
  );
}

/** Scoring buttons for one fighter, limited to the weapon they actually drew. */
function ScoringPad({
  actions,
  weapon,
  name,
  disabled,
  onScore,
}: {
  actions: ScoringActionView[];
  weapon: WeaponCategory | null;
  name: string;
  disabled: boolean;
  onScore: (code: string) => void;
}) {
  if (!weapon) return null;
  const own = actions.filter((action) => action.weapon === weapon);
  if (own.length === 0) return null;

  return (
    <div className="min-w-0 flex-1 space-y-1.5">
      <p className="record-label text-[var(--chrome-muted)]">{name}</p>
      {own.map((action) => (
        <button
          key={action.code}
          type="button"
          disabled={disabled}
          onClick={() => onScore(action.code)}
          className={cn(
            "flex w-full items-center justify-between gap-2 rounded-[var(--radius-sm)] border px-2.5 py-2 text-left text-xs transition-colors disabled:opacity-55",
            action.ends_bout
              ? "border-[var(--gold)]/60 bg-[var(--gold-soft)] hover:bg-[var(--gold-soft)]"
              : "border-[var(--border-strong)] hover:bg-[var(--surface-muted)]",
          )}
        >
          <span className="min-w-0">{action.label_ru}</span>
          <span className="font-record shrink-0 text-[var(--muted)]">
            {action.points === null ? (action.ends_bout ? "поединок" : "соступ") : `+${action.points}`}
          </span>
        </button>
      ))}
    </div>
  );
}

// -------------------------------------------------------------------- panel

export function BoutDetailPanel({
  matchId,
  canManage,
  onClose,
  onChanged,
}: {
  matchId: string;
  canManage: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [bout, setBout] = useState<BoutDetailView | null>(null);
  const [rules, setRules] = useState<WeaponRulesView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();

  /** Always re-read from the backend — never patch local state by hand. */
  const reload = useCallback(async () => {
    const fresh = await getBout(matchId);
    setBout(fresh);
  }, [matchId]);

  useEffect(() => {
    void (async () => {
      const [fresh, ruleset] = await Promise.all([getBout(matchId), getBoutRules()]);
      setBout(fresh);
      setRules(ruleset);
    })();
  }, [matchId]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await reload();
      onChanged();
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setBusy(false);
    }
  }

  const match = bout?.match;
  const redId = match?.participant_a?.id ?? null;
  const blueId = match?.participant_b?.id ?? null;
  const redName = match?.participant_a?.display_name ?? "Красный";
  const blueName = match?.participant_b?.display_name ?? "Синий";
  const openSostup = bout?.rounds.find((round) => round.status === "IN_PROGRESS") ?? null;
  const finished = match?.status === "FINISHED";
  const running = match?.status === "IN_PROGRESS";
  const canStart =
    !!match && !finished && !running && (bout?.is_final ? true : match.status === "LOT_COMPLETED");

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.18 }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bout-detail-title"
        className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-lg)] sm:rounded-[var(--radius-lg)] sm:p-6"
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 12 }}
        animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 12 }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="record-label text-[var(--chrome-muted)]">
              {labelOf(matchStage, match?.stage ?? null)}
            </p>
            <h2
              id="bout-detail-title"
              className="reveal-word font-display text-xl font-semibold tracking-tight"
            >
              Поединок
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="rounded-full p-1.5 text-[var(--muted)] hover:bg-[var(--surface-muted)]"
          >
            <X className="size-4" />
          </button>
        </div>

        {!bout ? (
          <p className="mt-6 text-sm text-[var(--muted)]">Загрузка…</p>
        ) : (
          <div className="mt-4 space-y-4">
            <TwoSided
              left={
                <FighterColumn
                  participant={match?.participant_a ?? null}
                  weapon={bout.weapon_red}
                  roundsWon={bout.rounds_won_red}
                  required={bout.required_rounds_red}
                  isWinner={!!match?.winner_id && match.winner_id === redId}
                  isLive={running && !match?.winner_id}
                  sideLabel="Красный"
                />
              }
              right={
                <FighterColumn
                  participant={match?.participant_b ?? null}
                  weapon={bout.weapon_blue}
                  roundsWon={bout.rounds_won_blue}
                  required={bout.required_rounds_blue}
                  isWinner={!!match?.winner_id && match.winner_id === blueId}
                  isLive={running && !match?.winner_id}
                  sideLabel="Синий"
                />
              }
            />

            {bout.win_condition_note ? (
              <p className="flex gap-2 text-xs text-[var(--muted)]">
                <Info className="mt-px size-3.5 shrink-0" strokeWidth={2} />
                {bout.win_condition_note}
              </p>
            ) : null}

            {bout.staging_note ? (
              <Alert tone="info" title="Исходное положение">
                {bout.staging_note}
              </Alert>
            ) : null}

            {/* ---------------------------------------------------- жребий */}
            {bout.is_bye ? (
              <Alert tone="info" title="Свободный проход">
                В этой паре нет соперника — боец проходит в следующий круг без боя.
              </Alert>
            ) : bout.is_final ? (
              /* No lot control is rendered at all for a final — and the backend
                 refuses one too, so this is not a UI-only rule. */
              <Alert tone="warning" title="Жребий не проводится">
                В финале оружие не разыгрывается: оно определено правилами турнира
                {bout.weapon_red ? ` — ${weaponCategory[bout.weapon_red]}` : ""}.
              </Alert>
            ) : canManage && !finished ? (
              <TwoSided
                left={
                  <LotDice
                    matchId={matchId}
                    side="RED"
                    sideLabel="Красный"
                    fighterName={redName}
                    weapon={bout.weapon_red}
                    disabled={busy || running}
                    onDrawn={() => void run(async () => {})}
                  />
                }
                right={
                  <LotDice
                    matchId={matchId}
                    side="BLUE"
                    sideLabel="Синий"
                    fighterName={blueName}
                    weapon={bout.weapon_blue}
                    disabled={busy || running}
                    onDrawn={() => void run(async () => {})}
                  />
                }
              />
            ) : null}

            {/* -------------------------------------------------- lifecycle */}
            {canManage && !bout.is_bye ? (
              <div className="flex flex-wrap gap-2">
                {canStart ? (
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy}
                    icon={<Play className="size-3.5" strokeWidth={2.25} />}
                    onClick={() => void run(() => startBout(matchId))}
                  >
                    Начать соступ
                  </Button>
                ) : null}
                {running && !openSostup && bout.rounds.length < bout.max_rounds ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    icon={<Swords className="size-3.5" strokeWidth={2.25} />}
                    onClick={() => void run(() => openRound(matchId))}
                  >
                    Открыть соступ {bout.rounds.length + 1}
                  </Button>
                ) : null}
              </div>
            ) : null}

            {/* ---------------------------------------------------- scoring */}
            {canManage && running && openSostup && rules ? (
              <div className="space-y-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-muted)]/50 p-3">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.p
                    key={openSostup.round_number}
                    className="text-sm font-semibold"
                    {...(reduceMotion ? {} : stepIn(6))}
                  >
                    Соступ {openSostup.round_number} — до {rules.round_target_points} очков
                  </motion.p>
                </AnimatePresence>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <ScoringPad
                    actions={rules.actions}
                    weapon={bout.weapon_red}
                    name={redName}
                    disabled={busy || !redId}
                    onScore={(code) =>
                      void run(() =>
                        recordRoundScore(matchId, openSostup.round_number, {
                          participant_id: redId!,
                          action_code: code,
                        }),
                      )
                    }
                  />
                  <ScoringPad
                    actions={rules.actions}
                    weapon={bout.weapon_blue}
                    name={blueName}
                    disabled={busy || !blueId}
                    onScore={(code) =>
                      void run(() =>
                        recordRoundScore(matchId, openSostup.round_number, {
                          participant_id: blueId!,
                          action_code: code,
                        }),
                      )
                    }
                  />
                </div>
                <div className="flex flex-wrap gap-2 border-t border-[var(--border)] pt-2">
                  <span className="w-full text-xs text-[var(--muted)]">
                    Или закрыть соступ решением судей:
                  </span>
                  {[
                    { id: redId, name: redName },
                    { id: blueId, name: blueName },
                  ].map((side) =>
                    side.id ? (
                      <Button
                        key={side.id}
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() =>
                          void run(() =>
                            completeRound(matchId, openSostup.round_number, {
                              winner_participant_id: side.id!,
                              end_reason: "JUDGE_DECISION",
                            }),
                          )
                        }
                      >
                        Победа: {side.name}
                      </Button>
                    ) : null,
                  )}
                </div>
              </div>
            ) : null}

            {error ? <Alert tone="danger">{error}</Alert> : null}

            {/* ----------------------------------------------------- rounds */}
            {bout.rounds.length > 0 ? (
              <div className="space-y-2">
                {bout.rounds.map((round) => (
                  <RoundCard
                    key={round.id}
                    round={round}
                    redId={redId}
                    blueId={blueId}
                    redName={redName}
                    blueName={blueName}
                  />
                ))}
              </div>
            ) : null}

            {finished && match?.result ? (
              <Alert tone="success" title="Поединок завершён">
                Победитель:{" "}
                <strong>{match.winner_id === redId ? redName : blueName}</strong> ·{" "}
                {labelOf(resultMethod, match.result.method)}
                {match.next_match_id ? " · вышел в следующий круг" : ""}
              </Alert>
            ) : null}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

export function BoutDetailHost({
  matchId,
  canManage,
  onClose,
  onChanged,
}: {
  matchId: string | null;
  canManage: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  return (
    <AnimatePresence>
      {matchId ? (
        <BoutDetailPanel
          key={matchId}
          matchId={matchId}
          canManage={canManage}
          onClose={onClose}
          onChanged={onChanged}
        />
      ) : null}
    </AnimatePresence>
  );
}

"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, Network, Trophy } from "lucide-react";
import { useState } from "react";

import { CornerMark } from "@/components/brand/corner-mark";
import { WEAPON_MOTIFS } from "@/components/brand/weapon-glyphs";
import { Alert, Badge, EmptyState, cn } from "@/components/ui";
import { Avatar } from "@/components/ui/avatar";
import { labelOf, matchStage, matchStatus, resultMethod, weaponCategory } from "@/lib/labels";
import type {
  BracketRoundView,
  BracketTreeView,
  MatchView,
  ParticipantView,
  WeaponCategory,
} from "@/types";

import { WeaponGlyph } from "./weapon-mark";

const ROUND_LABELS: Record<string, string> = {
  QUALIFICATION: "Квалификация",
  GROUP: "Групповой этап",
  TEAM_BOUT: "Трое на трое",
  ROUND_OF_128: "1/64 финала",
  ROUND_OF_64: "1/32 финала",
  ROUND_OF_32: "1/16 финала",
  ROUND_OF_16: "1/8 финала",
  QUARTERFINAL: "Четвертьфинал",
  SEMIFINAL: "Полуфинал",
  FINAL: "Финал",
};

function roundLabel(key: string, fallback: string): string {
  if (ROUND_LABELS[key]) return ROUND_LABELS[key];
  return /^\d+$/.test(key) ? `Раунд ${key}` : fallback;
}

function sortByPosition(matches: MatchView[]): MatchView[] {
  return [...matches].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
}

/** Did this match's winner go on to occupy a slot in `target`? Derived purely
 *  from data already on the wire — no new fields, no behavior change. */
function advancedInto(source: MatchView, target: MatchView): boolean {
  if (!source.winner_id) return false;
  return (
    target.participant_a?.id === source.winner_id || target.participant_b?.id === source.winner_id
  );
}

// ---------------------------------------------------------------- slot row

function SlotRow({
  participant,
  isWinner,
  isDecided,
  weapon,
  emptyLabel = "Ожидает соперника",
  roundsWon,
}: {
  participant: ParticipantView | null;
  isWinner: boolean;
  isDecided: boolean;
  /** The weapon actually drawn for this side, when the lot has been thrown. */
  weapon?: WeaponCategory | null;
  emptyLabel?: string;
  roundsWon?: number;
}) {
  const name = participant?.display_name ?? null;

  return (
    <div
      className={cn(
        "flex items-center gap-2.5 px-3 py-2",
        isWinner && "bg-[var(--accent-soft)]",
      )}
    >
      {name ? (
        <Avatar name={name} size="xs" />
      ) : (
        <span
          aria-hidden="true"
          className="inline-block size-6 shrink-0 rounded-full border border-dashed border-[var(--border-strong)]"
        />
      )}
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate text-sm",
            !name && "italic text-[var(--muted)]",
            isWinner ? "font-semibold text-[var(--accent)]" : isDecided && "text-[var(--muted)]",
          )}
        >
          {name ?? emptyLabel}
        </span>
        {participant?.city ? (
          <span className="block truncate text-[11px] text-[var(--muted)]">{participant.city}</span>
        ) : null}
      </span>
      {weapon ? (
        <span title={weaponCategory[weapon]} className="shrink-0 text-[var(--muted)]">
          <WeaponGlyph weapon={weapon} size={15} />
        </span>
      ) : null}
      {roundsWon ? (
        <span className="font-display shrink-0 text-xs tabular-nums text-[var(--muted)]">
          {roundsWon}
        </span>
      ) : null}
      {participant?.seed != null ? (
        <span className="font-display shrink-0 text-xs tabular-nums text-[var(--muted)]">
          {participant.seed}
        </span>
      ) : null}
      {isWinner ? (
        <Trophy aria-label="Победитель" className="size-3.5 shrink-0 text-[var(--accent)]" strokeWidth={2.25} />
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------------- card

export function BracketMatchCard({
  match,
  onEdit,
  featured = false,
  className,
}: {
  match: MatchView;
  onEdit?: (match: MatchView) => void;
  featured?: boolean;
  className?: string;
}) {
  const status = matchStatus[match.status] ?? { label: match.status, tone: "neutral" as const };
  const isDecided = Boolean(match.winner_id);
  const isLive = match.status === "IN_PROGRESS";
  const reduceMotion = useReducedMotion();

  return (
    <div
      className={cn(
        "relative w-64 shrink-0 overflow-hidden rounded-[var(--radius-md)] border bg-[var(--surface)] transition-shadow",
        // A bye is drawn as a quiet, dashed slot: present and legible, but
        // visibly not a fought bout.
        match.is_bye
          ? "border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)]/40"
          : isLive
            ? "border-[var(--live)]/60 shadow-[var(--shadow-glow-accent)]"
            : featured
              ? "border-[var(--gold)]/60 shadow-[var(--shadow-md)]"
              : "border-[var(--border)] shadow-[var(--shadow-sm)]",
        className,
      )}
    >
      {isLive ? (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-px rounded-[var(--radius-md)] shadow-[var(--shadow-glow-accent)]"
          animate={reduceMotion ? { opacity: 1 } : { opacity: [0.5, 1, 0.5] }}
          transition={reduceMotion ? { duration: 0 } : { duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        />
      ) : null}
      {featured && !isLive && !match.is_bye ? (
        <CornerMark className="absolute right-2.5 top-2.5 z-10 text-[var(--gold)]" size={16} />
      ) : null}

      <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5">
        <span className="truncate text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
          {labelOf(matchStage, match.stage)}
        </span>
        {match.is_bye ? (
          <Badge tone="info">Свободный проход</Badge>
        ) : (
          <Badge tone={status.tone} pulse={isLive}>
            {status.label}
          </Badge>
        )}
      </div>

      <div className="divide-y divide-[var(--border)]">
        <SlotRow
          participant={match.participant_a}
          isWinner={isDecided && match.winner_id === match.participant_a?.id}
          isDecided={isDecided}
          weapon={match.weapon_red}
          roundsWon={match.rounds_won_red}
          emptyLabel={match.is_bye ? "Без соперника" : undefined}
        />
        <SlotRow
          participant={match.participant_b}
          isWinner={isDecided && match.winner_id === match.participant_b?.id}
          isDecided={isDecided}
          weapon={match.weapon_blue}
          roundsWon={match.rounds_won_blue}
          emptyLabel={match.is_bye ? "Без соперника" : undefined}
        />
      </div>

      {match.result && !match.is_bye ? (
        <p className="border-t border-[var(--border)] px-3 py-1.5 text-xs text-[var(--muted)]">
          {labelOf(resultMethod, match.result.method)}
        </p>
      ) : null}

      {/* A final never offers a lot; a bye is never fought. Both are stated
          here, and both are refused by the backend too. */}
      {match.stage === "FINAL" && !isDecided ? (
        <p className="border-t border-[var(--border)] px-3 py-1.5 text-xs italic text-[var(--muted)]">
          Жребий не проводится
        </p>
      ) : null}

      {onEdit && !match.is_bye ? (
        <div className="border-t border-[var(--border)] px-3 py-1.5">
          <button
            type="button"
            onClick={() => onEdit(match)}
            className="text-xs font-medium text-[var(--accent)] hover:underline"
          >
            {match.status === "FINISHED"
              ? "Открыть поединок"
              : match.lot_required && !match.lot_completed
                ? "Жребий и бой"
                : "Вести поединок"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

// -------------------------------------------------------------- connector

/**
 * Draws the elbow connectors joining a round to the one it feeds, using pure
 * percentage math instead of runtime DOM measurement: the parent row uses
 * `items-stretch` so every round column (and this connector) shares the same
 * height, and each round distributes its matches with `justify-around` — so
 * a match's vertical center is exactly `(2i+1)/(2n)` of the *matches area's*
 * height. The matches area itself starts below `RoundHeader` (`h-10 mb-3`,
 * 2.5rem + 0.75rem), so the connector mirrors that exact spacer + flex-1
 * structure rather than treating its own full (header-inclusive) height as
 * 0–100% — otherwise every connector would sit visibly above the card row it
 * is meant to align with. A resolved winner's segment draws in accent and
 * animates in on mount.
 */
function RoundConnector({
  fromCount,
  toCount,
  advancing,
}: {
  fromCount: number;
  toCount: number;
  advancing: boolean[];
}) {
  const reduceMotion = useReducedMotion();

  if (fromCount === 0 || toCount === 0 || fromCount !== toCount * 2) {
    return <div className="w-8 shrink-0 lg:w-10" aria-hidden="true" />;
  }

  const pairs = Array.from({ length: toCount }, (_, k) => k);

  return (
    <div className="flex w-8 shrink-0 flex-col lg:w-10" aria-hidden="true">
      {/* Mirrors RoundHeader's box exactly so the SVG below starts at the same
          y-origin as the matches column's own flex-1 area. */}
      <div className="mb-3 h-10" />
      <div className="relative flex-1">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          {pairs.map((k) => {
            const topY = ((2 * (2 * k) + 1) / (2 * fromCount)) * 100;
            const bottomY = ((2 * (2 * k + 1) + 1) / (2 * fromCount)) * 100;
            const midY = ((2 * k + 1) / (2 * toCount)) * 100;
            const topAccent = advancing[2 * k] ?? false;
            const bottomAccent = advancing[2 * k + 1] ?? false;
            const barAccent = topAccent || bottomAccent;

            return (
              <g key={k}>
                <path
                  d={`M0 ${topY} H50`}
                  stroke="var(--border-strong)"
                  strokeWidth={1.5}
                  fill="none"
                  opacity={topAccent ? 0 : 1}
                />
                <path
                  d={`M0 ${bottomY} H50`}
                  stroke="var(--border-strong)"
                  strokeWidth={1.5}
                  fill="none"
                  opacity={bottomAccent ? 0 : 1}
                />
                <path d={`M50 ${topY} V${bottomY}`} stroke="var(--border-strong)" strokeWidth={1.5} fill="none" opacity={barAccent ? 0 : 1} />
                <path d={`M50 ${midY} H100`} stroke="var(--border-strong)" strokeWidth={1.5} fill="none" opacity={barAccent ? 0 : 1} />

                {topAccent ? (
                  <motion.path
                    d={`M0 ${topY} H50`}
                    stroke="var(--accent)"
                    strokeWidth={2}
                    fill="none"
                    initial={{ pathLength: reduceMotion ? 1 : 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  />
                ) : null}
                {bottomAccent ? (
                  <motion.path
                    d={`M0 ${bottomY} H50`}
                    stroke="var(--accent)"
                    strokeWidth={2}
                    fill="none"
                    initial={{ pathLength: reduceMotion ? 1 : 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  />
                ) : null}
                {barAccent ? (
                  <>
                    <motion.path
                      d={`M50 ${topY} V${bottomY}`}
                      stroke="var(--accent)"
                      strokeWidth={2}
                      fill="none"
                      initial={{ pathLength: reduceMotion ? 1 : 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: reduceMotion ? 0 : 0.15 }}
                    />
                    <motion.path
                      d={`M50 ${midY} H100`}
                      stroke="var(--accent)"
                      strokeWidth={2}
                      fill="none"
                      initial={{ pathLength: reduceMotion ? 1 : 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: reduceMotion ? 0 : 0.35 }}
                    />
                  </>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// ----------------------------------------------------------- round header

function RoundHeader({ round, index }: { round: BracketRoundView; index: number }) {
  return (
    <div className="relative mb-3 h-10 overflow-hidden px-1">
      <span
        aria-hidden="true"
        className="font-display pointer-events-none absolute -left-0.5 -top-2.5 select-none text-6xl font-bold leading-none text-[var(--border)]"
      >
        {index + 1}
      </span>
      <h3 className="absolute bottom-0 left-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        {roundLabel(round.key, round.label)}
      </h3>
    </div>
  );
}

const FEATURED_MOTIF_OFFSETS = [
  { y: 10, rotate: -10 },
  { y: 0, rotate: -3 },
  { y: 0, rotate: 3 },
  { y: 10, rotate: 10 },
];

/** Faint fan of the tradition's four weapons behind the championship column —
 *  purely atmospheric, marks "this is the final" without claiming any
 *  specific match used any specific weapon (that data doesn't exist yet). */
function FeaturedRoundMotif() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 -top-2 flex justify-center gap-3 text-[var(--gold)] opacity-[0.08]"
    >
      {WEAPON_MOTIFS.map(({ key, Icon }, index) => (
        <span
          key={key}
          style={{ transform: `translateY(${FEATURED_MOTIF_OFFSETS[index].y}px) rotate(${FEATURED_MOTIF_OFFSETS[index].rotate}deg)` }}
        >
          <Icon size={34} />
        </span>
      ))}
    </div>
  );
}

// -------------------------------------------------------------- root view

export function BracketView({
  bracket,
  onEditMatch,
}: {
  bracket: BracketTreeView;
  onEditMatch?: (match: MatchView) => void;
}) {
  const [mobileRoundIndex, setMobileRoundIndex] = useState(0);
  const reduceMotion = useReducedMotion();

  if (bracket.rounds.length === 0 && bracket.unassigned.length === 0) {
    return (
      <EmptyState
        title="Сетка ещё не построена"
        icon={<Network className="size-5" strokeWidth={1.75} />}
        description="Сетка появится после жеребьёвки и создания боёв в дисциплине."
      />
    );
  }

  const rounds = [...bracket.rounds]
    .sort((a, b) => a.order - b.order)
    .map((round) => ({ ...round, matches: sortByPosition(round.matches) }));

  const activeIndex = Math.min(mobileRoundIndex, Math.max(rounds.length - 1, 0));
  const activeRound = rounds[activeIndex];

  return (
    <div className="space-y-6">
      {rounds.length > 0 ? (
        <>
          {/* Desktop / tablet: full connected tree. Horizontal scroll remains
              available for very large brackets, but the tree now reads as a
              tree even before scrolling, thanks to the connectors. */}
          <div className="hidden lg:block">
            <div className="scroll-x pb-2">
              <div className="flex min-h-64 items-stretch">
                {rounds.map((round, index) => {
                  const nextRound = rounds[index + 1];
                  const isFeaturedRound =
                    round.key === "FINAL" || (index === rounds.length - 1 && round.matches.length === 1);
                  const advancing = nextRound
                    ? round.matches.map((match) =>
                        nextRound.matches.some((next) => advancedInto(match, next)),
                      )
                    : [];

                  return (
                    <div key={round.key} className="flex">
                      <div className="relative flex w-64 flex-col">
                        {isFeaturedRound ? <FeaturedRoundMotif /> : null}
                        <RoundHeader round={round} index={index} />
                        <div className="flex flex-1 flex-col justify-around gap-4 py-1">
                          {round.matches.map((match) => (
                            <BracketMatchCard
                              key={match.id}
                              match={match}
                              onEdit={onEditMatch}
                              featured={isFeaturedRound}
                            />
                          ))}
                        </div>
                      </div>
                      {nextRound ? (
                        <RoundConnector
                          fromCount={round.matches.length}
                          toCount={nextRound.matches.length}
                          advancing={advancing}
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Mobile: one round at a time via pill tabs + prev/next, instead of
              scrolling through every round's full-width column sideways. */}
          <div className="lg:hidden">
            <div className="scroll-x -mx-1 flex gap-1.5 px-1 pb-1" role="tablist" aria-label="Раунды сетки">
              {rounds.map((round, index) => (
                <button
                  key={round.key}
                  type="button"
                  role="tab"
                  aria-selected={activeIndex === index}
                  onClick={() => setMobileRoundIndex(index)}
                  className={cn(
                    "whitespace-nowrap rounded-[var(--radius-pill)] border px-3 py-1.5 text-xs font-medium transition-colors",
                    activeIndex === index
                      ? "border-transparent bg-[var(--accent)] text-white"
                      : "border-[var(--border-strong)] text-[var(--muted)] hover:bg-[var(--surface-muted)]",
                  )}
                >
                  {roundLabel(round.key, round.label)}
                </button>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-between gap-2">
              <button
                type="button"
                aria-label="Предыдущий раунд"
                disabled={activeIndex === 0}
                onClick={() => setMobileRoundIndex((value) => Math.max(0, value - 1))}
                className="rounded-full border border-[var(--border-strong)] p-1.5 text-[var(--muted)] disabled:opacity-30"
              >
                <ChevronLeft className="size-4" />
              </button>
              <p className="text-sm font-medium">{roundLabel(activeRound!.key, activeRound!.label)}</p>
              <button
                type="button"
                aria-label="Следующий раунд"
                disabled={activeIndex === rounds.length - 1}
                onClick={() => setMobileRoundIndex((value) => Math.min(rounds.length - 1, value + 1))}
                className="rounded-full border border-[var(--border-strong)] p-1.5 text-[var(--muted)] disabled:opacity-30"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>

            <motion.div
              key={activeRound!.key}
              className="mt-3 space-y-3"
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.15}
              onDragEnd={(_event, info) => {
                if (info.offset.x < -60 && activeIndex < rounds.length - 1) {
                  setMobileRoundIndex(activeIndex + 1);
                } else if (info.offset.x > 60 && activeIndex > 0) {
                  setMobileRoundIndex(activeIndex - 1);
                }
              }}
              initial={reduceMotion ? undefined : { opacity: 0, x: 12 }}
              animate={reduceMotion ? undefined : { opacity: 1, x: 0 }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.2 }}
            >
              {activeRound!.matches.map((match) => (
                <BracketMatchCard key={match.id} match={match} onEdit={onEditMatch} className="w-full" />
              ))}
            </motion.div>
          </div>
        </>
      ) : null}

      {bracket.unassigned.length > 0 ? (
        <div className="space-y-3">
          <Alert tone="info" title="Бои вне сетки">
            Эти бои не привязаны к раунду сетки — например, ещё не распределены жеребьёвкой.
          </Alert>
          <div className="flex flex-wrap gap-4">
            {bracket.unassigned.map((match) => (
              <BracketMatchCard key={match.id} match={match} onEdit={onEditMatch} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

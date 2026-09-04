"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { Stat, cn } from "@/components/ui";
import { useAuth } from "@/features/auth/auth-context";
import type {
  BracketTreeView,
  ChampionSummaryView,
  CompetitionEventView,
  CompetitionView,
  DrawView,
  MatchView,
  ParticipantView,
  StandingsView,
  TeamBoutView,
  TeamView,
} from "@/types";

import { BoutDetailHost } from "./bout-detail";
import { BracketGenerator } from "./bracket-generator";
import { BracketView } from "./bracket-view";
import { ChampionSummary } from "./champion-summary";
import { EventsJournal } from "./events-journal";
import { MatchResultDialog } from "./match-result-dialog";
import { MatchesList } from "./matches-list";
import { ParticipantsTable } from "./participants-table";
import { StandingsTable } from "./standings-table";
import { TeamBouts } from "./team-bouts";
import { TeamsList } from "./teams-list";

type TabKey =
  | "participants"
  | "teams"
  | "matches"
  | "standings"
  | "bracket"
  | "teamBouts"
  | "results"
  | "journal";

export type CompetitionData = {
  competition: CompetitionView;
  participants: ParticipantView[];
  teams: TeamView[];
  matches: MatchView[];
  standings: StandingsView | null;
  bracket: BracketTreeView | null;
  draws: DrawView[];
  events: CompetitionEventView[];
  teamBouts: TeamBoutView[];
  champion: ChampionSummaryView | null;
};

export function CompetitionWorkspace({ data }: { data: CompetitionData }) {
  const { competition, participants, teams, matches, standings, bracket, events, teamBouts, champion } =
    data;
  const { user } = useAuth();
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [editing, setEditing] = useState<MatchView | null>(null);
  /** Which поединок the judge panel is open on. */
  const [runningBoutId, setRunningBoutId] = useState<string | null>(null);

  const tabs = useMemo(() => {
    // A win/loss tally only means something where everyone meets everyone; in a
    // pure knockout the bracket already carries that information.
    const showStandings =
      competition.format === "ROUND_ROBIN" || competition.format === "GROUP_PLAYOFF";
    // Group-stage rows are not a tree, so they alone don't earn a bracket tab.
    const hasPlayoffRounds = (bracket?.rounds ?? []).some(
      (round) => round.key !== "GROUP" && round.key !== "QUALIFICATION",
    );
    const showBracket =
      competition.format === "SINGLE_ELIMINATION" ||
      competition.format === "GROUP_PLAYOFF" ||
      hasPlayoffRounds;

    const list: { key: TabKey; label: string; count?: number }[] = [
      { key: "participants", label: "Участники", count: participants.length },
    ];
    if (competition.type === "TEAM" || teams.length > 0) {
      list.push({ key: "teams", label: "Команды", count: teams.length });
      list.push({ key: "teamBouts", label: "Трое на трое", count: teamBouts.length });
    }
    if (showStandings) list.push({ key: "standings", label: "Таблица" });
    if (showBracket) list.push({ key: "bracket", label: "Сетка" });
    list.push({ key: "matches", label: "Бои", count: matches.length });
    // Only offered once the final is actually decided — no placeholder champion.
    if (champion?.complete) list.push({ key: "results", label: "Итоги" });
    list.push({ key: "journal", label: "Журнал", count: events.length });
    return list;
  }, [
    competition,
    participants.length,
    teams,
    matches.length,
    events.length,
    bracket,
    teamBouts.length,
    champion,
  ]);

  const [tab, setTab] = useState<TabKey>(tabs[0]?.key ?? "participants");
  const activeTab = tabs.some((item) => item.key === tab) ? tab : (tabs[0]?.key ?? "participants");

  /** Re-runs the server component so every tab sees the new result at once. */
  function refresh() {
    setEditing(null);
    startTransition(() => router.refresh());
  }

  /** Same, but keeps the judge panel open — it re-reads the bout itself. */
  function refreshInPlace() {
    startTransition(() => router.refresh());
  }

  const canManage = Boolean(user);
  const reduceMotion = useReducedMotion();

  // Entrance stagger for the stat strip — plays once, on the workspace's own
  // mount, never on the `router.refresh()` re-renders that follow saving a
  // result (this component instance persists across those, so `initial`
  // never re-triggers).
  const statItems = [
    { label: "Участников", value: competition.participant_count },
    ...(competition.type === "TEAM"
      ? [{ label: "Команд", value: competition.team_count }]
      : []),
    { label: "Боёв", value: competition.match_count },
    {
      label: "Завершено",
      value: `${competition.finished_match_count} / ${competition.match_count}`,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {statItems.map((item, index) => (
          <motion.div
            key={item.label}
            initial={reduceMotion ? undefined : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : { duration: 0.22, ease: [0.32, 0, 0.67, 0], delay: index * 0.05 }
            }
          >
            <Stat label={item.label} value={item.value} />
          </motion.div>
        ))}
      </div>

      <div className="sticky top-16 z-20 -mx-4 border-b border-[var(--border)] bg-[var(--background)]/95 px-4 backdrop-blur sm:-mx-6 sm:px-6">
        <div
          className="scroll-x -mb-px flex gap-1 overflow-y-hidden"
          role="tablist"
          aria-label="Разделы дисциплины"
        >
          {tabs.map((item) => {
            const active = activeTab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                role="tab"
                id={`tab-${item.key}`}
                aria-selected={active}
                aria-controls={`panel-${item.key}`}
                onClick={() => setTab(item.key)}
                className={cn(
                  "relative whitespace-nowrap px-4 py-2.5 text-sm transition-colors",
                  active ? "font-medium text-[var(--accent)]" : "text-[var(--muted)] hover:text-[var(--foreground)]",
                )}
              >
                {item.label}
                {item.count !== undefined ? (
                  <span className="ml-1.5 tabular-nums opacity-60">{item.count}</span>
                ) : null}
                {active ? (
                  <motion.span
                    layoutId="workspace-tab-indicator"
                    className="absolute inset-x-0 -bottom-px h-0.5 bg-[var(--accent)]"
                    transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 32 }}
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div id={`panel-${activeTab}`} role="tabpanel" aria-labelledby={`tab-${activeTab}`}>
        {activeTab === "participants" ? (
          <ParticipantsTable
            participants={participants}
            canManage={canManage}
            matches={matches}
            onChanged={refresh}
          />
        ) : null}
        {activeTab === "teams" ? <TeamsList teams={teams} /> : null}
        {activeTab === "standings" ? (
          standings ? (
            <StandingsTable standings={standings} />
          ) : (
            <p className="text-sm text-[var(--muted)]">Таблица недоступна.</p>
          )
        ) : null}
        {activeTab === "bracket" ? (
          bracket ? (
            <div className="space-y-6">
              {/* Nothing has been drawn yet: offer the real generator, with its
                  bye count and city verdict, rather than an empty tree. */}
              {bracket.rounds.length === 0 && bracket.unassigned.length === 0 && canManage ? (
                <BracketGenerator
                  competitionId={competition.id}
                  participantCount={participants.length}
                  onGenerated={refresh}
                />
              ) : null}
              <BracketView
                bracket={bracket}
                onEditMatch={canManage ? (match) => setRunningBoutId(match.id) : undefined}
              />
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)]">Сетка недоступна.</p>
          )
        ) : null}
        {activeTab === "teamBouts" ? (
          <TeamBouts
            competitionId={competition.id}
            bouts={teamBouts}
            canManage={canManage}
            onChanged={refresh}
          />
        ) : null}
        {activeTab === "results" ? <ChampionSummary summary={champion} /> : null}
        {activeTab === "matches" ? (
          <MatchesList
            matches={matches}
            canManage={canManage}
            onEditResult={(match) =>
              // A generated-bracket bout is run through the judge panel (lot,
              // соступ, win conditions); anything else keeps the plain
              // result dialog.
              match.lot_required || match.stage === "FINAL"
                ? setRunningBoutId(match.id)
                : setEditing(match)
            }
            onChanged={refresh}
          />
        ) : null}
        {activeTab === "journal" ? <EventsJournal events={events} /> : null}
      </div>

      <BoutDetailHost
        matchId={runningBoutId}
        canManage={canManage}
        onClose={() => setRunningBoutId(null)}
        onChanged={refreshInPlace}
      />

      <AnimatePresence>
        {editing ? (
          <MatchResultDialog
            key={editing.id}
            match={editing}
            onClose={() => setEditing(null)}
            onSaved={refresh}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}

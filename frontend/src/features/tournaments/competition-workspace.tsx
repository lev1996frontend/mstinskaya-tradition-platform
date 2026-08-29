"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { Stat, cn } from "@/components/ui";
import { useAuth } from "@/features/auth/auth-context";
import type {
  BracketTreeView,
  CompetitionEventView,
  CompetitionView,
  DrawView,
  MatchView,
  ParticipantView,
  StandingsView,
  TeamView,
} from "@/types";

import { BracketView } from "./bracket-view";
import { EventsJournal } from "./events-journal";
import { MatchResultDialog } from "./match-result-dialog";
import { MatchesList } from "./matches-list";
import { ParticipantsTable } from "./participants-table";
import { StandingsTable } from "./standings-table";
import { TeamsList } from "./teams-list";

type TabKey = "participants" | "teams" | "matches" | "standings" | "bracket" | "journal";

export type CompetitionData = {
  competition: CompetitionView;
  participants: ParticipantView[];
  teams: TeamView[];
  matches: MatchView[];
  standings: StandingsView | null;
  bracket: BracketTreeView | null;
  draws: DrawView[];
  events: CompetitionEventView[];
};

export function CompetitionWorkspace({ data }: { data: CompetitionData }) {
  const { competition, participants, teams, matches, standings, bracket, events } = data;
  const { user } = useAuth();
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [editing, setEditing] = useState<MatchView | null>(null);

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
    }
    if (showStandings) list.push({ key: "standings", label: "Таблица" });
    if (showBracket) list.push({ key: "bracket", label: "Сетка" });
    list.push({ key: "matches", label: "Бои", count: matches.length });
    list.push({ key: "journal", label: "Журнал", count: events.length });
    return list;
  }, [competition, participants.length, teams, matches.length, events.length, bracket]);

  const [tab, setTab] = useState<TabKey>(tabs[0]?.key ?? "participants");
  const activeTab = tabs.some((item) => item.key === tab) ? tab : (tabs[0]?.key ?? "participants");

  /** Re-runs the server component so every tab sees the new result at once. */
  function refresh() {
    setEditing(null);
    startTransition(() => router.refresh());
  }

  const canManage = Boolean(user);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Участников" value={competition.participant_count} />
        {competition.type === "TEAM" ? (
          <Stat label="Команд" value={competition.team_count} />
        ) : null}
        <Stat label="Боёв" value={competition.match_count} />
        <Stat
          label="Завершено"
          value={`${competition.finished_match_count} / ${competition.match_count}`}
        />
      </div>

      <div className="border-b border-[var(--border)]">
        <div
          className="scroll-x -mb-px flex gap-1"
          role="tablist"
          aria-label="Разделы дисциплины"
        >
          {tabs.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              id={`tab-${item.key}`}
              aria-selected={activeTab === item.key}
              aria-controls={`panel-${item.key}`}
              onClick={() => setTab(item.key)}
              className={cn(
                "whitespace-nowrap border-b-2 px-4 py-2.5 text-sm transition-colors",
                activeTab === item.key
                  ? "border-[var(--accent)] font-medium text-[var(--accent)]"
                  : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]",
              )}
            >
              {item.label}
              {item.count !== undefined ? (
                <span className="ml-1.5 tabular-nums opacity-60">{item.count}</span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div id={`panel-${activeTab}`} role="tabpanel" aria-labelledby={`tab-${activeTab}`}>
        {activeTab === "participants" ? (
          <ParticipantsTable participants={participants} />
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
            <BracketView
              bracket={bracket}
              onEditMatch={canManage ? (match) => setEditing(match) : undefined}
            />
          ) : (
            <p className="text-sm text-[var(--muted)]">Сетка недоступна.</p>
          )
        ) : null}
        {activeTab === "matches" ? (
          <MatchesList
            matches={matches}
            canManage={canManage}
            onEditResult={(match) => setEditing(match)}
            onChanged={refresh}
          />
        ) : null}
        {activeTab === "journal" ? <EventsJournal events={events} /> : null}
      </div>

      {editing ? (
        <MatchResultDialog
          match={editing}
          onClose={() => setEditing(null)}
          onSaved={refresh}
        />
      ) : null}
    </div>
  );
}

import type { Metadata } from "next";
import { BookOpen } from "lucide-react";
import Link from "next/link";

import { listRuleSetsWithStatus } from "@/api/catalog";
import { ApiOfflineNotice } from "@/components/api-status";
import { Badge, Container, EmptyState, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/format";
import type { RuleSet } from "@/types";

export const metadata: Metadata = {
  title: "Правила",
  description: "Регламенты и правила Мстинской традиции с сохранением версий.",
};

const STATUS: Record<RuleSet["status"], { label: string; tone: "neutral" | "success" }> = {
  DRAFT: { label: "Черновик", tone: "neutral" },
  ACTIVE: { label: "Действует", tone: "success" },
  ARCHIVED: { label: "В архиве", tone: "neutral" },
};

/**
 * A register of editions. Versioning is the whole point of this module, so the
 * version number is promoted to the left margin and set large in the record
 * face — the first thing you read on a row is *which edition*, then the title,
 * then whether it is in force. Cards would have buried that number in a badge.
 */
export default async function RulesPage() {
  const { items: ruleSets, offline } = await listRuleSetsWithStatus();

  return (
    <Container className="space-y-8 py-10">
      <PageHeader
        eyebrow="Регламенты"
        title="Правила"
        description="Наборы правил версионируются: прошлые редакции сохраняются целиком и остаются доступными для сверки результатов прошедших турниров."
      />

      {ruleSets.length === 0 ? (
        <div className="space-y-4">
          {offline ? <ApiOfflineNotice /> : null}
          <EmptyState
            title="Регламентов пока нет"
            description="Здесь появятся действующие и архивные редакции правил."
            icon={<BookOpen className="size-5" strokeWidth={1.75} />}
          />
        </div>
      ) : (
        <ul className="border-t-2 border-[var(--rule)]">
          {ruleSets.map((ruleSet) => {
            const status = STATUS[ruleSet.status] ?? { label: ruleSet.status, tone: "neutral" };
            return (
              <li
                key={ruleSet.id}
                className="border-b border-[var(--border)] transition-colors hover:border-[var(--accent)]"
              >
                <Link
                  href={`/rules/${ruleSet.id}`}
                  className="rule-row group flex gap-5 py-5 sm:gap-8"
                >
                  <span className="rule-row-edition w-16 shrink-0 border-r border-[var(--border)] pr-4 text-right sm:w-24">
                    <span className="record-label block text-[var(--muted)]">Ред.</span>
                    <span className="rule-row-number font-record mt-1 block text-xl leading-none text-[var(--accent)]">
                      {ruleSet.version}
                    </span>
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <span className="font-display text-lg font-semibold tracking-tight transition-colors group-hover:text-[var(--accent)]">
                        {ruleSet.title}
                      </span>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </span>
                    {ruleSet.description ? (
                      <span className="mt-2 block text-sm leading-relaxed text-[var(--muted)]">
                        {ruleSet.description}
                      </span>
                    ) : null}
                    {ruleSet.published_at ? (
                      <span className="font-record mt-2 block text-xs text-[var(--muted)]">
                        Опубликован {formatDate(ruleSet.published_at)}
                      </span>
                    ) : null}
                  </span>

                  <span
                    aria-hidden="true"
                    className="rule-row-arrow shrink-0 self-center text-[var(--muted)] group-hover:text-[var(--accent)]"
                  >
                    →
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Container>
  );
}

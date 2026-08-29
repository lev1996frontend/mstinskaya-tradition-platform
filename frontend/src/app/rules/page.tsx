import type { Metadata } from "next";
import Link from "next/link";

import { listRuleSets } from "@/api/catalog";
import { ApiOfflineNotice } from "@/components/api-status";
import { Badge, Card, Container, EmptyState, PageHeader } from "@/components/ui";
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

export default async function RulesPage() {
  const ruleSets = await listRuleSets();

  return (
    <Container className="space-y-8 py-10">
      <PageHeader
        eyebrow="Регламенты"
        title="Правила"
        description="Наборы правил версионируются: прошлые редакции сохраняются целиком и остаются доступными для сверки результатов прошедших турниров."
      />

      {ruleSets.length === 0 ? (
        <div className="space-y-4">
          <ApiOfflineNotice />
          <EmptyState title="Регламентов пока нет" />
        </div>
      ) : (
        <ul className="space-y-3">
          {ruleSets.map((ruleSet) => {
            const status = STATUS[ruleSet.status] ?? { label: ruleSet.status, tone: "neutral" };
            return (
              <Card
                as="li"
                key={ruleSet.id}
                className="transition-colors hover:border-[var(--accent)]"
              >
                <Link href={`/rules/${ruleSet.id}`} className="flex flex-col gap-2 p-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="font-semibold">{ruleSet.title}</h2>
                    <Badge>Версия {ruleSet.version}</Badge>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </div>
                  {ruleSet.description ? (
                    <p className="text-sm text-[var(--muted)]">{ruleSet.description}</p>
                  ) : null}
                  {ruleSet.published_at ? (
                    <p className="text-xs text-[var(--muted)]">
                      Опубликован {formatDate(ruleSet.published_at)}
                    </p>
                  ) : null}
                </Link>
              </Card>
            );
          })}
        </ul>
      )}
    </Container>
  );
}

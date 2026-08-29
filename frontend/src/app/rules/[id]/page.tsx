import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { listRuleSections, listRuleSets, listRules } from "@/api/catalog";
import { Badge, Card, Container, EmptyState, PageHeader } from "@/components/ui";
import { labelOf, ruleType } from "@/lib/labels";

type PageProps = { params: Promise<{ id: string }> };

/**
 * The rules module has no `GET /rulesets/{id}`, so the set is picked out of the
 * list endpoint. Worth replacing with a detail endpoint once one exists.
 */
async function findRuleSet(id: string) {
  const ruleSets = await listRuleSets();
  return ruleSets.find((ruleSet) => ruleSet.id === id) ?? null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const ruleSet = await findRuleSet(id);
  return { title: ruleSet?.title ?? "Регламент" };
}

export default async function RuleSetPage({ params }: PageProps) {
  const { id } = await params;
  const ruleSet = await findRuleSet(id);
  if (!ruleSet) notFound();

  const sections = await listRuleSections(id);
  const sectionsWithRules = await Promise.all(
    sections
      .slice()
      .sort((left, right) => left.order_number - right.order_number)
      .map(async (section) => ({ section, rules: await listRules(section.id) })),
  );

  return (
    <Container className="max-w-3xl space-y-8 py-10">
      <PageHeader
        eyebrow={<Link href="/rules">← Все регламенты</Link>}
        title={ruleSet.title}
        description={ruleSet.description ?? undefined}
        actions={<Badge>Версия {ruleSet.version}</Badge>}
      />

      {sectionsWithRules.length === 0 ? (
        <EmptyState
          title="Разделы не заполнены"
          description="В этом наборе правил ещё нет ни одного раздела."
        />
      ) : (
        <div className="space-y-8">
          {sectionsWithRules.map(({ section, rules }) => (
            <section key={section.id} className="space-y-3">
              <h2 className="text-lg font-semibold tracking-tight">{section.title}</h2>
              {section.description ? (
                <p className="text-sm text-[var(--muted)]">{section.description}</p>
              ) : null}

              {rules.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">Пункты раздела не заполнены.</p>
              ) : (
                <ol className="space-y-3">
                  {rules
                    .slice()
                    .sort((left, right) => left.order_number - right.order_number)
                    .map((rule) => (
                      <Card as="li" key={rule.id} className="p-5">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-medium">{rule.title}</h3>
                          <Badge>{labelOf(ruleType, rule.rule_type)}</Badge>
                        </div>
                        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-[var(--muted)]">
                          {rule.content}
                        </p>
                      </Card>
                    ))}
                </ol>
              )}
            </section>
          ))}
        </div>
      )}
    </Container>
  );
}

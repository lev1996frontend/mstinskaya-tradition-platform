"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { Badge, Button, Card, Container, DefinitionList, PageHeader, Section } from "@/components/ui";
import { useAuth } from "@/features/auth/auth-context";
import { RoleRequestPanel } from "@/features/role-requests/role-request-panel";
import { labelOf, roleCodeLabel } from "@/lib/labels";
import { routes } from "@/lib/routes";

export default function ProfilePage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace(routes.login());
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <Container className="max-w-2xl py-14">
        <p className="text-sm text-[var(--muted)]">Загрузка профиля…</p>
      </Container>
    );
  }

  return (
    <Container className="max-w-2xl space-y-8 pt-10 pb-5">
      <PageHeader
        eyebrow="Личный кабинет"
        title={user.name || user.email}
        actions={
          <Button onClick={() => void logout()}>Выйти</Button>
        }
      />

      <Card className="p-6">
        <DefinitionList
          items={[
            { term: "Email", value: user.email },
            {
              term: "Роли",
              value:
                user.roles.length > 0 ? (
                  <span className="flex flex-wrap gap-1.5">
                    {user.roles.map((role) => (
                      <Badge key={role}>{labelOf(roleCodeLabel, role)}</Badge>
                    ))}
                  </span>
                ) : (
                  "Роли не назначены"
                ),
            },
          ]}
        />
      </Card>

      <Section title="Заявки на роль">
        <RoleRequestPanel myRoles={user.roles} />
      </Section>

      <div className="space-y-3 border-t border-[var(--border)] pt-6">
        <h2 className="record-label text-[var(--chrome-muted)]">Что доступно после входа</h2>
        <p className="text-sm leading-relaxed text-[var(--muted)]">
          Внесение и изменение результатов боёв в дисциплинах турнира. Все изменения фиксируются в
          журнале дисциплины — предыдущие решения сохраняются.
        </p>
        <Link
          href={routes.tournaments()}
          className="record-label label-link label-link-fwd text-[var(--accent)]"
        >
          Перейти к турнирам
        </Link>
      </div>
    </Container>
  );
}

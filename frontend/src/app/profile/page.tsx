"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { Badge, Button, Card, Container, DefinitionList, PageHeader } from "@/components/ui";
import { useAuth } from "@/features/auth/auth-context";

export default function ProfilePage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <Container className="max-w-2xl py-14">
        <p className="text-sm text-[var(--muted)]">Загрузка профиля…</p>
      </Container>
    );
  }

  return (
    <Container className="max-w-2xl space-y-8 py-10">
      <PageHeader
        eyebrow="Личный кабинет"
        title={user.name || user.email}
        actions={
          <Button variant="secondary" onClick={() => void logout()}>
            Выйти
          </Button>
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
                      <Badge key={role}>{role}</Badge>
                    ))}
                  </span>
                ) : (
                  "Роли не назначены"
                ),
            },
          ]}
        />
      </Card>

      <Card className="p-6">
        <h2 className="record-label border-b border-[var(--border)] pb-2 text-[var(--iron-muted)]">
          Что доступно после входа
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
          Внесение и изменение результатов боёв в дисциплинах турнира. Все изменения фиксируются в
          журнале дисциплины — предыдущие решения сохраняются.
        </p>
        <Link
          href="/tournaments"
          className="record-label mt-4 inline-block text-[var(--accent)] hover:underline"
        >
          Перейти к турнирам →
        </Link>
      </Card>
    </Container>
  );
}

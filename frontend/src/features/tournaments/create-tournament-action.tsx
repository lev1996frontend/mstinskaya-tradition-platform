"use client";

import { Plus } from "lucide-react";
import Link from "next/link";

import { ButtonLink } from "@/components/ui";
import { useAuth } from "@/features/auth/auth-context";
import { routes } from "@/lib/routes";

/**
 * The tournament list's header CTA. Split out as its own client component
 * (the page itself stays a server component) because deciding whether to
 * show "Создать турнир" or a login prompt needs `useAuth()` — an anonymous
 * visitor clicking through used to land on `/tournaments/new` only to be
 * told "Нужен вход" там.
 *
 * A second `.btn-primary` here duplicated the header's own "Войти" button
 * right next to it — same action, same weight, twice on screen. Plain text
 * with an inline link says the same thing without competing with it.
 */
export function CreateTournamentAction() {
  const { user, loading } = useAuth();

  if (loading) return null;

  if (!user) {
    return (
      <p className="text-sm text-[var(--muted)]">
        Чтобы создать турнир,{" "}
        <Link href={routes.login()} className="text-rule-link text-[var(--foreground)]">
          войдите
        </Link>
        .
      </p>
    );
  }

  return (
    <ButtonLink href={routes.tournamentNew()} icon={<Plus className="size-4" strokeWidth={2.5} />}>
      Создать турнир
    </ButtonLink>
  );
}

"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import * as authApi from "@/api/auth";
import { useAuth } from "@/features/auth/auth-context";
import { ResendVerificationButton } from "@/features/auth/resend-verification-button";
import { ApiError } from "@/lib/api";
import { routes } from "@/lib/routes";

type Status = "checking" | "success" | "invalid" | "expired" | "error";

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const { user, refresh } = useAuth();
  const [status, setStatus] = useState<Status>("checking");
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    if (!token) {
      setStatus("invalid");
      return;
    }

    async function run(rawToken: string) {
      try {
        await authApi.verifyEmail(rawToken);
        await refresh();
        setStatus("success");
      } catch (error) {
        if (error instanceof ApiError && error.status === 410) {
          setStatus("expired");
        } else if (error instanceof ApiError && error.status === 400) {
          setStatus("invalid");
        } else {
          setStatus("error");
        }
      }
    }

    void run(token);
  }, [token, refresh]);

  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      {status === "checking" ? <p className="text-[var(--muted)]">Подтверждаем почту…</p> : null}

      {status === "success" ? (
        <>
          <h1 className="font-display text-2xl font-semibold">Почта подтверждена</h1>
          <Link href={routes.home()} className="mt-4 inline-block text-[var(--accent)] hover:underline transition-colors">
            На главную
          </Link>
        </>
      ) : null}

      {status === "expired" ? (
        <>
          <h1 className="font-display text-2xl font-semibold">Срок ссылки истёк</h1>
          <p className="mt-2 text-[var(--muted)]">Ссылки действуют 24 часа — запросите новую.</p>
          {user ? (
            <ResendVerificationButton className="mt-4 text-[var(--accent)] hover:underline transition-colors disabled:opacity-50 disabled:hover:no-underline" />
          ) : (
            <Link href={routes.login()} className="mt-4 inline-block text-[var(--accent)] hover:underline transition-colors">
              Войти, чтобы запросить новое письмо
            </Link>
          )}
        </>
      ) : null}

      {status === "invalid" || status === "error" ? (
        <>
          <h1 className="font-display text-2xl font-semibold">Ссылка недействительна</h1>
          <p className="mt-2 text-[var(--muted)]">
            Проверьте, что перешли по ссылке из письма целиком, или запросите новое.
          </p>
          {user ? (
            <ResendVerificationButton className="mt-4 text-[var(--accent)] hover:underline transition-colors disabled:opacity-50 disabled:hover:no-underline" />
          ) : (
            <Link href={routes.login()} className="mt-4 inline-block text-[var(--accent)] hover:underline transition-colors">
              Войти, чтобы запросить новое письмо
            </Link>
          )}
        </>
      ) : null}
    </div>
  );
}

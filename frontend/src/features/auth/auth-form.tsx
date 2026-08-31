"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Alert, Button, Card, Container } from "@/components/ui";
import { Field, Input } from "@/components/ui/form";
import { ApiError, ApiUnreachableError } from "@/lib/api";

import { useAuth } from "./auth-context";

function describeError(error: unknown, mode: "login" | "register"): string {
  if (error instanceof ApiUnreachableError) {
    return "Не удалось связаться с API. Проверьте, что бэкенд запущен.";
  }
  if (error instanceof ApiError) {
    if (error.status === 401) return "Неверный email или пароль.";
    if (error.status === 409) return "Пользователь с таким email уже зарегистрирован.";
    return error.message;
  }
  return mode === "login" ? "Не удалось войти." : "Не удалось создать аккаунт.";
}

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const { login, register } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "login") {
        await login(email.trim(), password);
      } else {
        await register({
          email: email.trim(),
          password,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
        });
      }
      router.push("/profile");
      router.refresh();
    } catch (caught) {
      setError(describeError(caught, mode));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Container className="max-w-md space-y-8 py-14">
      {/* Two mount fade-ins (heading block, then the card on a delay) used to
          run here. Removed: nothing about a login form benefits from arriving
          late, and it was the same "every block fades in" reflex the redesign
          is cutting everywhere else. Dropping them also removed framer-motion
          from this route. */}
      <div className="rule-double-b space-y-2 pb-6">
        <p className="record-label text-[var(--accent)]">
          {mode === "login" ? "Личный кабинет" : "Регистрация"}
        </p>
        <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight">
          {mode === "login" ? "Вход" : "Создание аккаунта"}
        </h1>
        <p className="max-w-sm text-sm leading-relaxed text-[var(--muted)]">
          {mode === "login"
            ? "Вход нужен организаторам и судьям для внесения результатов."
            : "Создайте аккаунт, чтобы участвовать в жизни платформы."}
        </p>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "register" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Имя">
                {(props) => (
                  <Input
                    {...props}
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    autoComplete="given-name"
                    required
                    disabled={busy}
                  />
                )}
              </Field>
              <Field label="Фамилия">
                {(props) => (
                  <Input
                    {...props}
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    autoComplete="family-name"
                    required
                    disabled={busy}
                  />
                )}
              </Field>
            </div>
          ) : null}

          <Field label="Email">
            {(props) => (
              <Input
                {...props}
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
                disabled={busy}
              />
            )}
          </Field>

          <Field
            label="Пароль"
            hint={
              mode === "register"
                ? "Не менее 8 символов, минимум одна заглавная буква и одна цифра."
                : undefined
            }
          >
            {(props) => (
              <Input
                {...props}
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
                minLength={mode === "register" ? 8 : undefined}
                disabled={busy}
              />
            )}
          </Field>

          {error ? <Alert tone="danger">{error}</Alert> : null}

          <Button type="submit" disabled={busy}>
            {busy ? "Подождите…" : mode === "login" ? "Войти" : "Создать аккаунт"}
          </Button>
        </form>
      </Card>

      <p className="text-center text-sm text-[var(--muted)]">
        {mode === "login" ? (
          <>
            Нет аккаунта?{" "}
            <Link href="/register" className="text-[var(--accent)] hover:underline">
              Зарегистрироваться
            </Link>
          </>
        ) : (
          <>
            Уже есть аккаунт?{" "}
            <Link href="/login" className="text-[var(--accent)] hover:underline">
              Войти
            </Link>
          </>
        )}
      </p>
    </Container>
  );
}

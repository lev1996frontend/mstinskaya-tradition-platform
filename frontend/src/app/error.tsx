"use client";

import { useEffect } from "react";

import { Button, Container } from "@/components/ui";
import { API_BASE_URL } from "@/lib/config";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Container className="max-w-lg py-24 text-center">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Что-то пошло не так</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Страницу не удалось отрисовать. Если бэкенд не запущен, проверьте, что API доступен по
        адресу <code className="font-mono text-xs">{API_BASE_URL}</code>.
      </p>
      <div className="mt-6 flex justify-center">
        <Button onClick={reset}>Повторить</Button>
      </div>
    </Container>
  );
}

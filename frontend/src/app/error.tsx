"use client";

import { TriangleAlert } from "lucide-react";
import { useEffect } from "react";

import { Seal } from "@/components/brand/seal";
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
    <Container className="ledger-lines max-w-lg py-24 text-center">
      <div className="mx-auto mb-5 w-fit">
        <Seal size={52} tone="accent">
          <TriangleAlert className="size-5" strokeWidth={1.75} />
        </Seal>
      </div>
      <h1 className="font-display text-2xl font-semibold tracking-tight">Что-то пошло не так</h1>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[var(--muted)]">
        Страницу не удалось отрисовать. Если бэкенд не запущен, проверьте, что API доступен по
        адресу <code className="font-mono text-xs">{API_BASE_URL}</code>.
      </p>
      <div className="mt-6 flex justify-center">
        <Button onClick={reset}>Повторить</Button>
      </div>
    </Container>
  );
}

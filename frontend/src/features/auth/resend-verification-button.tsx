"use client";

import { useEffect, useState } from "react";

import * as authApi from "@/api/auth";

const COOLDOWN_SECONDS = 60;

/**
 * Not a security measure — the server-side rate limit on
 * `/api/v1/auth/resend-verification` (3/hour, see `auth/router.py`) is what
 * actually stops abuse. This is just here so an impatient click doesn't fire
 * the request five times in a row before the first response even lands.
 */
export function ResendVerificationButton({ className }: { className?: string }) {
  const [cooldown, setCooldown] = useState(0);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  async function handleClick() {
    setStatus("sending");
    try {
      await authApi.resendVerification();
      setStatus("sent");
      setCooldown(COOLDOWN_SECONDS);
    } catch {
      setStatus("error");
    }
  }

  const disabled = cooldown > 0 || status === "sending";

  return (
    <button type="button" onClick={handleClick} disabled={disabled} className={className}>
      {cooldown > 0 ? `Отправить ещё раз (${cooldown}с)` : "Отправить письмо ещё раз"}
      {status === "error" ? <span className="ml-2 text-[var(--danger)]">Не удалось отправить</span> : null}
    </button>
  );
}

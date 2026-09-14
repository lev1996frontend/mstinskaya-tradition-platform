"use client";

import { useAuth } from "@/features/auth/auth-context";
import { ResendVerificationButton } from "@/features/auth/resend-verification-button";

/**
 * Renders only once we know who's signed in (`!loading`) and their email is
 * unverified — never during the mount-time `/users/me` check, which would
 * otherwise flash the banner for every visitor for one render before
 * `loading` settles, verified or not, signed in or not.
 */
export function EmailVerificationBanner() {
  const { user, loading } = useAuth();
  if (loading || !user || user.email_verified) return null;

  return (
    <div className="border-b-2 border-[var(--rule)] bg-[var(--surface-muted)] px-4 py-2 text-center text-sm text-[var(--foreground)]">
      Подтвердите почту — мы отправили письмо на {user.email}.{" "}
      <ResendVerificationButton className="font-medium text-[var(--accent)] text-rule-link transition-colors disabled:opacity-50" />
    </div>
  );
}

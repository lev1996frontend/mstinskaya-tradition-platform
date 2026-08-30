import { HelmetIcon } from "@/components/brand/helmet-icon";

import { cn } from "./index";

/**
 * Helmet-in-disc avatar used for every participant/athlete/team slot —
 * every fighter shows up to a bout wearing the tradition's mask, so it reads
 * truer than initials. Swaps to a real `<img>` transparently once a
 * `photoUrl` exists (already on the `Athlete.photo_url` / `Club.logo_url`
 * fields) — no call-site changes needed when real photography arrives.
 */

type AvatarSize = "xs" | "sm" | "md" | "lg";

const SIZE_CLASSES: Record<AvatarSize, string> = {
  xs: "size-6",
  sm: "size-8",
  md: "size-10",
  lg: "size-14",
};

const ICON_SIZE: Record<AvatarSize, number> = {
  xs: 14,
  sm: 18,
  md: 22,
  lg: 32,
};

// Soft/foreground pairs drawn from the existing token system — no new colors
// introduced, just a deterministic rotation across the tints already used
// for badges elsewhere in the UI.
const AVATAR_PALETTE: { bg: string; fg: string }[] = [
  { bg: "var(--accent-soft)", fg: "var(--accent)" },
  { bg: "var(--gold-soft)", fg: "var(--gold-strong)" },
  { bg: "var(--info-soft)", fg: "var(--info)" },
  { bg: "var(--success-soft)", fg: "var(--success)" },
  { bg: "var(--warning-soft)", fg: "var(--warning)" },
  { bg: "var(--neutral-200)", fg: "var(--neutral-700)" },
];

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
}

export function Avatar({
  name,
  photoUrl,
  size = "md",
  className,
}: {
  name: string;
  photoUrl?: string | null;
  size?: AvatarSize;
  className?: string;
}) {
  if (photoUrl) {
    return (
      <span
        className={cn(
          "inline-block shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-[var(--surface-muted)]",
          SIZE_CLASSES[size],
          className,
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- photoUrl is an
            arbitrary backend-hosted URL, not eligible for next/image domains */}
        <img src={photoUrl} alt="" className="h-full w-full object-cover" />
      </span>
    );
  }

  const palette = AVATAR_PALETTE[hashString(name) % AVATAR_PALETTE.length]!;

  return (
    <span
      title={name}
      className={cn(
        // Square-cut and set in the record face: an ID photo mounted on a
        // record, not a social-app circle.
        "inline-flex shrink-0 select-none items-center justify-center rounded-[var(--radius-sm)]",
        SIZE_CLASSES[size],
        className,
      )}
      style={{ backgroundColor: palette.bg, color: palette.fg }}
    >
      <HelmetIcon size={ICON_SIZE[size]} />
      <span className="sr-only">{initialsOf(name)}</span>
    </span>
  );
}

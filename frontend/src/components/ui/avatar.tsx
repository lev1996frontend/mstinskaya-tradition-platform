import { MaskMark } from "@/components/brand/mask-mark";

import { cn } from "./index";

/**
 * Mask-in-plate mark used for every athlete/participant/team slot — every
 * fighter shows up to a bout wearing the tradition's mask, so it reads truer
 * than initials. Swaps to a real `<img>` transparently once a `photoUrl`
 * exists (already on `Athlete.photo_url` / `Club.logo_url`) — no call-site
 * changes needed when real photography arrives.
 *
 * One register for everyone. An earlier version tinted each mark by hashing the
 * name across six pastel pairs — including a blue and a green that exist
 * nowhere else in this palette — so a roster came out as a column of randomly
 * coloured tiles carrying no information at all. Identity here is the драковое
 * имя; the mark is the same bone-on-coal plate for every person, and the only
 * thing that ever changes its colour is the row it sits in lighting up.
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

  return (
    <span
      title={name}
      /* Decorative: every place this mark appears, the name it stands for is
         written beside it, and the sr-only copy it used to carry made screen
         readers announce each roster row's name twice. */
      aria-hidden="true"
      className={cn(
        // Square-cut and set in the record face: an ID photo mounted on a
        // record, not a social-app circle.
        "inline-flex shrink-0 select-none items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--background-deep)] text-[var(--muted)]",
        SIZE_CLASSES[size],
        className,
      )}
    >
      <MaskMark size={ICON_SIZE[size]} />
    </span>
  );
}

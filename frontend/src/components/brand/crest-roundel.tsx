/**
 * Club/team crest placeholder: a geometric shield outline, replaceable by a
 * real logo (`Club.logo_url`) later without changing the layout around it.
 */
export function CrestRoundel({
  className,
  size = 40,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M20 3.5 L33.5 8.2 V19.3 C33.5 27.1 28 32.9 20 36.5 C12 32.9 6.5 27.1 6.5 19.3 V8.2 Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M20 12 L20 27.5 M13.2 19.75 L26.8 19.75"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  );
}

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateFormatter.format(date);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateTimeFormatter.format(date);
}

/** "12 — 14 мая 2026" style range, collapsing an empty or single-day span. */
export function formatDateRange(start: string | null, end: string | null): string {
  if (!start && !end) return "Даты не назначены";
  if (start && !end) return formatDate(start);
  if (!start && end) return `до ${formatDate(end)}`;
  if (start === end) return formatDate(start);
  return `${formatDate(start)} — ${formatDate(end)}`;
}

export function formatPlace(...parts: (string | null | undefined)[]): string {
  const filtered = parts.filter((part): part is string => Boolean(part && part.trim()));
  return filtered.length ? filtered.join(", ") : "Место не указано";
}

/** Russian plural forms: 1 бой, 2 боя, 5 боёв. */
export function plural(count: number, one: string, few: string, many: string): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} ${one}`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} ${few}`;
  return `${count} ${many}`;
}

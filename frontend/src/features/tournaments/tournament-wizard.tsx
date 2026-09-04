"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Check,
  FileSpreadsheet,
  Link2,
  Download,
  Plus,
  Search,
  Trash2,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { listAthletes, listRuleSets } from "@/api/catalog";
import {
  addParticipant,
  createCompetition,
  createTournament,
  participantTemplateUrl,
  previewParticipantImport,
} from "@/api/tournaments";
import { Alert, Badge, Button, ButtonLink, Card, cn } from "@/components/ui";
import { Field, Input, Select } from "@/components/ui/form";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError, ApiUnreachableError } from "@/lib/api";
import { competitionFormat, competitionType } from "@/lib/labels";
import type { Athlete, CompetitionFormat, CompetitionType, ImportReport } from "@/types";

import { ParticipantImportReview } from "./participant-import-review";

/**
 * Organizer wizard: basic info → disciplines → entrants → done.
 *
 * A tournament is several disciplines, not one. «Абсолютная детская»,
 * «Абсолютная мужская», «Абсолютная ветеранская» and «Трое на трое» each hold
 * their own field, bracket and champion, and one fighter may enter more than
 * one of them — a fifty-year-old belongs in both the veterans' category and the
 * men's absolute, since the men's one sets no age bound at all.
 *
 * The tournament and its disciplines are created at the end of the second step,
 * before anyone is entered. That order is forced by the spreadsheet import: the
 * server checks each row's «Категория» against the tournament's real
 * disciplines, so they have to exist before a file can be read at all.
 *
 * The wizard stops once everyone is entered. Building a bracket, drawing groups
 * and running bouts all belong to the discipline's own page, which already does
 * them properly; carrying an N-discipline tournament through a single bracket
 * step here would either force one discipline to be "the" one or turn the
 * wizard into a nested flow.
 *
 * The entrants step links an **existing** athlete profile whenever there is one
 * — that is the whole reason for the search box. A person is entered by bare
 * name only when they have no profile on the platform at all, so the wizard can
 * never mint a second identity for someone who already exists.
 */

type Discipline = {
  key: string;
  name: string;
  type: CompetitionType;
  format: CompetitionFormat;
  /** Blank means unbounded, which is the usual case. */
  minAge: string;
  maxAge: string;
};

type Entry = {
  key: string;
  /** Set when this row is linked to an existing platform profile. */
  athleteId: string | null;
  /** Which discipline this person is entered in. */
  disciplineKey: string;
  name: string;
  city: string;
  /** Free text: the draw separates clubmates before fellow-townsmen. */
  club: string;
  /** Only consulted where the discipline sets an age bound. */
  birthYear: string;
  seed: string;
};

const STEPS = ["Основное", "Дисциплины", "Участники", "Готово"] as const;

/**
 * Ready-made disciplines, offered as buttons rather than baked in as rules.
 *
 * `docs/domain-model.md` §5 forbids inventing tournament formats, so nothing
 * here is enforced: every field stays editable and the organizer can type any
 * name and any bounds. These only save the typing for the four that come up
 * every time.
 */
const PRESETS: { label: string; discipline: Omit<Discipline, "key"> }[] = [
  {
    label: "Абсолютная детская",
    discipline: {
      name: "Абсолютная детская",
      type: "INDIVIDUAL",
      format: "SINGLE_ELIMINATION",
      minAge: "",
      maxAge: "14",
    },
  },
  {
    label: "Абсолютная мужская",
    discipline: {
      name: "Абсолютная мужская",
      type: "INDIVIDUAL",
      format: "SINGLE_ELIMINATION",
      minAge: "",
      maxAge: "",
    },
  },
  {
    label: "Абсолютная ветеранская",
    discipline: {
      name: "Абсолютная ветеранская",
      type: "INDIVIDUAL",
      format: "SINGLE_ELIMINATION",
      minAge: "45",
      maxAge: "",
    },
  },
  {
    label: "Трое на трое",
    discipline: {
      name: "Трое на трое",
      type: "TEAM",
      format: "ROUND_ROBIN",
      minAge: "",
      maxAge: "",
    },
  },
];

function describeError(error: unknown): string {
  if (error instanceof ApiUnreachableError) return "Не удалось связаться с API.";
  if (error instanceof ApiError) {
    if (error.status === 401) return "Требуется вход в систему.";
    if (error.status === 403) return "Действие доступно организатору или инструктору.";
    // The age check answers with a structured body naming the row's problem.
    const detail = error.detail as { message?: string } | null;
    if (error.status === 400 && detail?.message) return detail.message;
    return error.message;
  }
  return "Не удалось сохранить.";
}

function newDiscipline(name = ""): Discipline {
  return {
    key: crypto.randomUUID(),
    name,
    type: "INDIVIDUAL",
    format: "SINGLE_ELIMINATION",
    minAge: "",
    maxAge: "",
  };
}

function newEntry(disciplineKey: string): Entry {
  return {
    key: crypto.randomUUID(),
    athleteId: null,
    disciplineKey,
    name: "",
    city: "",
    club: "",
    birthYear: "",
    seed: "",
  };
}

/** Short label for a discipline's age bounds — the same phrasing the API uses. */
function ageLabel(discipline: Discipline): string | null {
  const min = discipline.minAge.trim();
  const max = discipline.maxAge.trim();
  if (min && max) return `${min}–${max} лет`;
  if (min) return `${min}+`;
  if (max) return `до ${max} лет`;
  return null;
}

// ------------------------------------------------------------ athlete search

function AthletePicker({
  athletes,
  taken,
  onPick,
}: {
  athletes: Athlete[];
  taken: Set<string>;
  onPick: (athlete: Athlete) => void;
}) {
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return athletes
      .filter((athlete) => !taken.has(athlete.id))
      .filter((athlete) => (athlete.nickname ?? "").toLowerCase().includes(needle))
      .slice(0, 6);
  }, [athletes, query, taken]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted)]"
          strokeWidth={2}
        />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Найти существующий профиль спортсмена"
          className="pl-9"
        />
      </div>
      {query.trim() ? (
        matches.length > 0 ? (
          <ul className="space-y-1">
            {matches.map((athlete) => (
              <li key={athlete.id}>
                <button
                  type="button"
                  onClick={() => {
                    onPick(athlete);
                    setQuery("");
                  }}
                  className="flex w-full items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border-strong)] px-3 py-2 text-left text-sm hover:bg-[var(--surface-muted)]"
                >
                  <Link2 className="size-3.5 shrink-0 text-[var(--accent)]" strokeWidth={2} />
                  <span className="min-w-0 flex-1 truncate">{athlete.nickname ?? "Без имени"}</span>
                  <Badge tone="info">профиль есть</Badge>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-[var(--muted)]">
            Совпадений нет — добавьте участника вручную, профиль не создастся повторно.
          </p>
        )
      ) : null}
    </div>
  );
}

// -------------------------------------------------------------------- wizard

export function TournamentWizard() {
  const { user } = useAuth();
  const reduceMotion = useReducedMotion();

  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // step 1 — the tournament itself
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [location, setLocation] = useState("");
  const [city, setCity] = useState("");
  const [rulesetId, setRulesetId] = useState("");
  const [rulesets, setRulesets] = useState<{ id: string; title: string }[]>([]);

  // step 2 — its disciplines
  const [disciplines, setDisciplines] = useState<Discipline[]>([newDiscipline()]);

  // step 3 — who is entered, and where
  const [entries, setEntries] = useState<Entry[]>([]);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [importBusy, setImportBusy] = useState(false);
  const [importSummary, setImportSummary] = useState<string | null>(null);
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // step 4 — what was created
  const [tournamentId, setTournamentId] = useState<string | null>(null);
  const [created, setCreated] = useState<
    { id: string; name: string; key: string; entered: number }[]
  >([]);

  useEffect(() => {
    void (async () => {
      const [sets, people] = await Promise.all([listRuleSets(), listAthletes()]);
      setRulesets(sets.map((set) => ({ id: set.id, title: `${set.title} · ${set.version}` })));
      if (sets[0]) setRulesetId(sets[0].id);
      setAthletes(people);
    })();
  }, []);

  // A discipline with no name is a half-typed row, not an event.
  const namedDisciplines = disciplines.filter((discipline) => discipline.name.trim());
  const filled = entries.filter((entry) => entry.name.trim());
  const takenAthleteIds = new Set(entries.map((e) => e.athleteId).filter(Boolean) as string[]);

  /** The default discipline for a new row — the first one, when there is only one. */
  const defaultDisciplineKey = namedDisciplines[0]?.key ?? disciplines[0]?.key ?? "";

  function updateDiscipline(key: string, patch: Partial<Discipline>) {
    setDisciplines((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function updateEntry(key: string, patch: Partial<Entry>) {
    setEntries((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function addEntry(patch: Partial<Entry> = {}) {
    setEntries((rows) => [...rows, { ...newEntry(defaultDisciplineKey), ...patch }]);
  }

  /**
   * Hands the file to the server and shows what it made of it.
   *
   * Nothing is parsed here on purpose. Only the backend can tell whether a name
   * is already entered, whether a category matches a real discipline, or
   * whether a birth year clears that discipline's age bound — and
   * `docs/architecture.md` puts validation there for exactly that reason.
   * Nothing is saved either: this is a report, and the organizer decides.
   */
  async function handleImportFile(file: File) {
    if (!tournamentId) return;
    setImportBusy(true);
    setImportSummary(null);
    setImportReport(null);
    setError(null);
    try {
      const report = await previewParticipantImport(tournamentId, file);
      if (report.total_rows === 0) {
        setError("В файле не найдено ни одной строки с участником.");
        return;
      }
      setImportReport(report);
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setImportBusy(false);
    }
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setBusy(false);
    }
  }

  /**
   * Creates the tournament and its disciplines, then opens the entrants step.
   *
   * Has to happen before anyone is entered: the spreadsheet import validates
   * each row's discipline against the ones that really exist.
   */
  async function createTournamentAndDisciplines() {
    await run(async () => {
      if (!user) throw new ApiError(401, null, "Требуется вход в систему.");
      const tournament = await createTournament({
        title: title.trim(),
        status: "REGISTRATION",
        start_date: startDate ? new Date(startDate).toISOString() : null,
        location: location.trim() || null,
        city: city.trim() || null,
        organizer_id: user.id,
        ruleset_id: rulesetId,
      });

      const built: { id: string; name: string; key: string; entered: number }[] = [];
      for (const discipline of namedDisciplines) {
        const competition = await createCompetition(tournament.id, {
          name: discipline.name.trim(),
          type: discipline.type,
          format: discipline.format,
          status: "REGISTRATION",
          min_age: discipline.minAge.trim() ? Number(discipline.minAge) : null,
          max_age: discipline.maxAge.trim() ? Number(discipline.maxAge) : null,
        });
        built.push({
          id: competition.id,
          name: competition.name,
          key: discipline.key,
          entered: 0,
        });
      }

      setTournamentId(tournament.id);
      setCreated(built);
      if (entries.length === 0) {
        setEntries([newEntry(defaultDisciplineKey), newEntry(defaultDisciplineKey)]);
      }
      setStep(2);
    });
  }

  /** Enters the manually typed rows. The imported ones go through the review. */
  async function submitTypedEntries() {
    await run(async () => {
      const counts = new Map(created.map((row) => [row.id, row.entered]));
      for (const entry of filled) {
        const competition = created.find((row) => row.key === entry.disciplineKey);
        const discipline = namedDisciplines.find((row) => row.key === entry.disciplineKey);
        // A team discipline has no individual entrants; its teams are built on
        // the discipline's own page, where roles and rosters live.
        if (!competition || discipline?.type === "TEAM") continue;
        await addParticipant(competition.id, {
          // A linked profile wins; the typed name is only a fallback for
          // someone with no profile at all.
          athlete_id: entry.athleteId,
          display_name: entry.athleteId ? null : entry.name.trim(),
          city: entry.city.trim() || null,
          club_name: entry.club.trim() || null,
          birth_year: entry.birthYear.trim() ? Number(entry.birthYear) : null,
          seed: entry.seed ? Number(entry.seed) : null,
        });
        counts.set(competition.id, (counts.get(competition.id) ?? 0) + 1);
      }
      setCreated((rows) => rows.map((row) => ({ ...row, entered: counts.get(row.id) ?? row.entered })));
      setEntries([]);
      setStep(3);
    });
  }

  const canLeaveStepOne = title.trim().length >= 2 && Boolean(rulesetId);
  const canLeaveStepTwo = namedDisciplines.length >= 1;

  if (!user) {
    return (
      <Alert tone="warning" title="Нужен вход">
        Создание турнира доступно организаторам после входа в систему.
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------- stepper */}
      <ol className="scroll-x flex gap-1.5" aria-label="Шаги создания турнира">
        {STEPS.map((label, index) => {
          const done = index < step;
          const active = index === step;
          return (
            <li key={label} className="flex-1" aria-current={active ? "step" : undefined}>
              <div
                className={cn(
                  "flex items-center gap-2 rounded-[var(--radius-sm)] border px-3 py-2 text-xs whitespace-nowrap",
                  active
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                    : done
                      ? "border-[var(--success)]/50 text-[var(--success)]"
                      : "border-[var(--border)] text-[var(--muted)]",
                )}
              >
                {done ? <Check className="size-3.5" strokeWidth={2.5} /> : null}
                <span className="font-record">{index + 1}</span>
                <span>{label}</span>
              </div>
            </li>
          );
        })}
      </ol>

      <motion.div
        key={step}
        initial={reduceMotion ? undefined : { opacity: 0, y: 8 }}
        animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.2 }}
      >
        {/* ------------------------------------------------ step 1: basics */}
        {step === 0 ? (
          <Card className="space-y-4 p-5">
            <Field label="Название турнира">
              {(props) => (
                <Input
                  {...props}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Открытый турнир Мстинской традиции"
                />
              )}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Дата начала"
                hint="От неё считается возраст в категориях с ограничением"
              >
                {(props) => (
                  <Input
                    {...props}
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                  />
                )}
              </Field>
              <Field label="Город">
                {(props) => (
                  <Input
                    {...props}
                    value={city}
                    onChange={(event) => setCity(event.target.value)}
                    placeholder="Великий Новгород"
                  />
                )}
              </Field>
            </div>
            <Field label="Место проведения">
              {(props) => (
                <Input
                  {...props}
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  placeholder="Спортивный зал"
                />
              )}
            </Field>
            <Field label="Регламент">
              {(props) => (
                <Select
                  {...props}
                  value={rulesetId}
                  onChange={(event) => setRulesetId(event.target.value)}
                >
                  {rulesets.length === 0 ? <option value="">Регламенты не заведены</option> : null}
                  {rulesets.map((set) => (
                    <option key={set.id} value={set.id}>
                      {set.title}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            {error ? <Alert tone="danger">{error}</Alert> : null}
            <div className="pt-1">
              <Button type="button" disabled={!canLeaveStepOne} onClick={() => setStep(1)}>
                Дальше: дисциплины
              </Button>
            </div>
          </Card>
        ) : null}

        {/* -------------------------------------------- step 2: disciplines */}
        {step === 1 ? (
          <Card className="space-y-4 p-5">
            <div>
              <h3 className="font-display text-lg font-semibold tracking-tight">Дисциплины</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">
                У каждой дисциплины свой состав, своя сетка и свой чемпион. Один боец может
                заявиться в несколько — например, и в ветеранскую, и в мужскую абсолютку.
              </p>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((preset) => (
                <Button
                  key={preset.label}
                  type="button"
                  variant="secondary"
                  size="sm"
                  icon={<Plus className="size-3.5" strokeWidth={2.5} />}
                  onClick={() =>
                    setDisciplines((rows) => {
                      const seeded = { ...preset.discipline, key: crypto.randomUUID() };
                      // Fill the first blank row rather than leaving it behind.
                      const blank = rows.find((row) => !row.name.trim());
                      return blank
                        ? rows.map((row) => (row.key === blank.key ? { ...seeded, key: row.key } : row))
                        : [...rows, seeded];
                    })
                  }
                >
                  {preset.label}
                </Button>
              ))}
            </div>

            <ul className="space-y-2">
              {disciplines.map((discipline, index) => (
                <li
                  key={discipline.key}
                  className="grid gap-2 rounded-[var(--radius-sm)] border border-[var(--border)] p-2 sm:grid-cols-[1.6fr_1fr_1fr_4.5rem_4.5rem_2rem] sm:items-center"
                >
                  <Input
                    value={discipline.name}
                    onChange={(event) => updateDiscipline(discipline.key, { name: event.target.value })}
                    placeholder="Название дисциплины"
                    aria-label={`Дисциплина ${index + 1}`}
                  />
                  <Select
                    value={discipline.type}
                    onChange={(event) =>
                      updateDiscipline(discipline.key, {
                        type: event.target.value as CompetitionType,
                      })
                    }
                    aria-label={`Тип дисциплины ${index + 1}`}
                  >
                    {(Object.keys(competitionType) as CompetitionType[]).map((key) => (
                      <option key={key} value={key}>
                        {competitionType[key]}
                      </option>
                    ))}
                  </Select>
                  <Select
                    value={discipline.format}
                    onChange={(event) =>
                      updateDiscipline(discipline.key, {
                        format: event.target.value as CompetitionFormat,
                      })
                    }
                    aria-label={`Формат дисциплины ${index + 1}`}
                  >
                    {(Object.keys(competitionFormat) as CompetitionFormat[]).map((key) => (
                      <option key={key} value={key}>
                        {competitionFormat[key]}
                      </option>
                    ))}
                  </Select>
                  <Input
                    value={discipline.minAge}
                    onChange={(event) =>
                      updateDiscipline(discipline.key, { minAge: event.target.value })
                    }
                    placeholder="от"
                    inputMode="numeric"
                    aria-label={`Минимальный возраст в дисциплине ${index + 1}`}
                  />
                  <Input
                    value={discipline.maxAge}
                    onChange={(event) =>
                      updateDiscipline(discipline.key, { maxAge: event.target.value })
                    }
                    placeholder="до"
                    inputMode="numeric"
                    aria-label={`Максимальный возраст в дисциплине ${index + 1}`}
                  />
                  <button
                    type="button"
                    aria-label={`Удалить дисциплину ${index + 1}`}
                    disabled={disciplines.length === 1}
                    onClick={() =>
                      setDisciplines((rows) => rows.filter((row) => row.key !== discipline.key))
                    }
                    className="justify-self-end rounded-full p-1.5 text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--danger)] disabled:opacity-40"
                  >
                    <Trash2 className="size-4" strokeWidth={2} />
                  </button>
                </li>
              ))}
            </ul>

            <p className="text-xs text-[var(--muted)]">
              Возраст «от» и «до» — необязательные и независимые. Пусто с обеих сторон значит, что
              ограничения нет и год рождения вообще не спрашивается. Считается по году турнира:
              «45+» — это те, кому в год турнира исполняется 45.
            </p>
            <p className="text-xs text-[var(--muted)]">
              На этом шаге турнир и дисциплины создаются в базе: без них сервер не сможет
              проверить колонку «Категория» в файле заявок.
            </p>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={<Plus className="size-3.5" strokeWidth={2.5} />}
              onClick={() => setDisciplines((rows) => [...rows, newDiscipline()])}
            >
              Добавить дисциплину
            </Button>

            {error ? <Alert tone="danger">{error}</Alert> : null}

            <div className="flex flex-wrap gap-2 border-t border-[var(--border)] pt-3">
              <Button
                type="button"
                disabled={!canLeaveStepTwo || busy}
                onClick={() => void createTournamentAndDisciplines()}
              >
                {busy ? "Создаём…" : "Создать турнир и дисциплины"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setStep(0)} disabled={busy}>
                Назад
              </Button>
            </div>
          </Card>
        ) : null}

        {/* ------------------------------------------ step 3: participants */}
        {step === 2 ? (
          <Card className="space-y-4 p-5">
            <div>
              <h3 className="font-display text-lg font-semibold tracking-tight">Участники</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Если у бойца уже есть профиль — найдите и привяжите его, чтобы не создавать дубль.
                Город и клуб нужны, чтобы развести своих в первом круге; год рождения — только там,
                где у дисциплины есть возрастное ограничение.
              </p>
            </div>

            <AthletePicker
              athletes={athletes}
              taken={takenAthleteIds}
              onPick={(athlete) => {
                const patch = {
                  athleteId: athlete.id,
                  name: athlete.nickname ?? "Спортсмен",
                  birthYear: athlete.birth_year ? String(athlete.birth_year) : "",
                };
                const empty = entries.find((entry) => !entry.name.trim());
                if (empty) updateEntry(empty.key, patch);
                else addEntry(patch);
              }}
            />

            <ul className="space-y-2">
              {entries.map((entry, index) => {
                const discipline = disciplines.find((row) => row.key === entry.disciplineKey);
                const needsYear = Boolean(discipline?.minAge.trim() || discipline?.maxAge.trim());
                return (
                  <li
                    key={entry.key}
                    className="grid gap-2 rounded-[var(--radius-sm)] border border-[var(--border)] p-2 sm:grid-cols-[1.5rem_1.4fr_1fr_1fr_1fr_5rem_4rem_2rem] sm:items-center"
                  >
                    <span className="font-record text-xs text-[var(--muted)]">{index + 1}</span>
                    <span className="min-w-0">
                      <Input
                        value={entry.name}
                        onChange={(event) =>
                          updateEntry(entry.key, { name: event.target.value, athleteId: null })
                        }
                        placeholder="Фамилия и имя"
                        aria-label={`Участник ${index + 1}`}
                      />
                      {entry.athleteId ? (
                        <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-[var(--accent)]">
                          <Link2 className="size-3" strokeWidth={2} />
                          привязан существующий профиль
                        </span>
                      ) : null}
                    </span>
                    <Select
                      value={entry.disciplineKey}
                      onChange={(event) =>
                        updateEntry(entry.key, { disciplineKey: event.target.value })
                      }
                      aria-label={`Дисциплина участника ${index + 1}`}
                    >
                      {namedDisciplines.map((row) => (
                        <option key={row.key} value={row.key}>
                          {row.name}
                          {ageLabel(row) ? ` · ${ageLabel(row)}` : ""}
                        </option>
                      ))}
                    </Select>
                    <Input
                      value={entry.city}
                      onChange={(event) => updateEntry(entry.key, { city: event.target.value })}
                      placeholder="Город"
                      aria-label={`Город участника ${index + 1}`}
                    />
                    <Input
                      value={entry.club}
                      onChange={(event) => updateEntry(entry.key, { club: event.target.value })}
                      placeholder="Клуб"
                      aria-label={`Клуб участника ${index + 1}`}
                    />
                    <Input
                      value={entry.birthYear}
                      onChange={(event) => updateEntry(entry.key, { birthYear: event.target.value })}
                      placeholder={needsYear ? "год р. *" : "год р."}
                      inputMode="numeric"
                      aria-label={`Год рождения участника ${index + 1}`}
                    />
                    <Input
                      value={entry.seed}
                      onChange={(event) => updateEntry(entry.key, { seed: event.target.value })}
                      placeholder="Посев"
                      inputMode="numeric"
                      aria-label={`Посев участника ${index + 1}`}
                    />
                    <button
                      type="button"
                      aria-label={`Удалить участника ${index + 1}`}
                      onClick={() =>
                        setEntries((rows) => rows.filter((row) => row.key !== entry.key))
                      }
                      className="justify-self-end rounded-full p-1.5 text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--danger)]"
                    >
                      <Trash2 className="size-4" strokeWidth={2} />
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={<Plus className="size-3.5" strokeWidth={2.5} />}
                onClick={() => addEntry()}
              >
                Добавить участника
              </Button>
{/* An ordinary link: the template route is public, so there is no
                  token to attach and nothing for JavaScript to do. */}
              <ButtonLink
                href={tournamentId ? participantTemplateUrl(tournamentId) : "#"}
                variant="secondary"
                size="sm"
                download
                icon={<Download className="size-3.5" strokeWidth={2.25} />}
              >
                Скачать бланк
              </ButtonLink>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={importBusy}
                icon={<FileSpreadsheet className="size-3.5" strokeWidth={2.25} />}
                onClick={() => fileInputRef.current?.click()}
              >
                {importBusy ? "Проверяем файл…" : "Загрузить заявки"}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void handleImportFile(file);
                }}
              />
            </div>
            <p className="text-xs text-[var(--muted)]">
              Скачайте бланк и заполните его — в нём уже есть нужные колонки и второй лист со
              списком дисциплин. Бланк открыт для всех, так что его можно раздать тренерам клубов.
              Заполненный файл проверяется на сервере: он покажет ошибки по строкам и ничего не
              сохранит, пока вы не подтвердите.
            </p>

            {importReport ? (
              <div className="border-t border-[var(--border)] pt-4">
                <ParticipantImportReview
                  report={importReport}
                  onCancel={() => setImportReport(null)}
                  onCommitted={(count, perCompetition) => {
                    setImportReport(null);
                    setImportSummary(`Заведено участников из файла: ${count}.`);
                    setCreated((rows) =>
                      rows.map((row) => ({
                        ...row,
                        entered: row.entered + (perCompetition[row.name] ?? 0),
                      })),
                    );
                  }}
                />
              </div>
            ) : null}

            {importSummary ? <Alert tone="success">{importSummary}</Alert> : null}
            {error ? <Alert tone="danger">{error}</Alert> : null}

            <div className="flex flex-wrap gap-2 border-t border-[var(--border)] pt-3">
              <Button
                type="button"
                disabled={busy || importBusy}
                icon={<UserPlus className="size-3.5" strokeWidth={2.25} />}
                onClick={() => void submitTypedEntries()}
              >
                {busy
                  ? "Сохраняем…"
                  : filled.length > 0
                    ? `Завести вручную (${filled.length}) и закончить`
                    : "Закончить"}
              </Button>
            </div>
          </Card>
        ) : null}

        {/* ------------------------------------------------- step 4: result */}
        {step === 3 && tournamentId ? (
          <Card className="space-y-4 p-5">
            <div>
              <h3 className="font-display text-lg font-semibold tracking-tight">Турнир создан</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Сетка и подгруппы настраиваются в каждой дисциплине отдельно — там же жребий,
                судейство и итоги.
              </p>
            </div>

            <ul className="space-y-2">
              {created.map((competition) => (
                <li key={competition.id}>
                  <Link
                    href={`/tournaments/${tournamentId}/competitions/${competition.id}`}
                    className="flex items-center gap-3 rounded-[var(--radius-sm)] border border-[var(--border-strong)] px-3 py-2.5 transition-colors hover:bg-[var(--surface-muted)]"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {competition.name}
                    </span>
                    <span className="font-record text-xs text-[var(--muted)]">
                      заявлено {competition.entered}
                    </span>
                    <ArrowRight className="size-4 shrink-0 text-[var(--muted)]" strokeWidth={2} />
                  </Link>
                </li>
              ))}
            </ul>

            <div className="border-t border-[var(--border)] pt-3">
              <ButtonLink href={`/tournaments/${tournamentId}`} variant="secondary">
                Открыть турнир целиком
              </ButtonLink>
            </div>
          </Card>
        ) : null}
      </motion.div>
    </div>
  );
}

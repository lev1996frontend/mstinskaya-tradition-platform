"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Check, FileSpreadsheet, Link2, Plus, Search, Trash2, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { listAthletes, listRuleSets } from "@/api/catalog";
import {
  addParticipant,
  createCompetition,
  createTournament,
  generateBracket,
  previewBracket,
} from "@/api/tournaments";
import { Alert, Badge, Button, Card, cn } from "@/components/ui";
import { Field, Input, Select } from "@/components/ui/form";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError, ApiUnreachableError } from "@/lib/api";
import { competitionFormat, weaponCategory } from "@/lib/labels";
import type { Athlete, BracketPlanView, CompetitionFormat, WeaponCategory } from "@/types";

import { CityVerdict, PairPreview, PlanSummary } from "./bracket-generator";
import { parseParticipantsExcel } from "./participant-import";
import { WeaponGlyph } from "./weapon-mark";

/**
 * Organizer wizard: basic info → participants → distribution review → bracket.
 *
 * The participants step links an **existing** athlete profile whenever there is
 * one — that is the whole reason for the search box. A person is only entered
 * by bare name when they have no profile on the platform at all, so the wizard
 * can never mint a second identity for someone who already exists.
 *
 * Nothing is written until each step's own action runs, and the distribution
 * review is a real backend dry run, not a local guess.
 */

type Entry = {
  key: string;
  /** Set when this row is linked to an existing platform profile. */
  athleteId: string | null;
  name: string;
  city: string;
  seed: string;
};

const STEPS = ["Основное", "Участники", "Распределение", "Сетка"] as const;

function describeError(error: unknown): string {
  if (error instanceof ApiUnreachableError) return "Не удалось связаться с API.";
  if (error instanceof ApiError) {
    if (error.status === 401) return "Требуется вход в систему.";
    if (error.status === 403) return "Действие доступно организатору или инструктору.";
    return error.message;
  }
  return "Не удалось сохранить.";
}

function newEntry(): Entry {
  return { key: crypto.randomUUID(), athleteId: null, name: "", city: "", seed: "" };
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
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // step 1
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [location, setLocation] = useState("");
  const [city, setCity] = useState("");
  const [format, setFormat] = useState<CompetitionFormat>("SINGLE_ELIMINATION");
  const [rulesetId, setRulesetId] = useState("");
  const [rulesets, setRulesets] = useState<{ id: string; title: string }[]>([]);

  // step 2
  const [entries, setEntries] = useState<Entry[]>([newEntry(), newEntry()]);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [importBusy, setImportBusy] = useState(false);
  const [importSummary, setImportSummary] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // step 3/4
  const [competitionId, setCompetitionId] = useState<string | null>(null);
  const [tournamentId, setTournamentId] = useState<string | null>(null);
  const [plan, setPlan] = useState<BracketPlanView | null>(null);
  const [finalWeapon, setFinalWeapon] = useState<WeaponCategory | null>(null);

  useEffect(() => {
    void (async () => {
      const [sets, people] = await Promise.all([listRuleSets(), listAthletes()]);
      setRulesets(sets.map((set) => ({ id: set.id, title: `${set.title} · ${set.version}` })));
      if (sets[0]) setRulesetId(sets[0].id);
      setAthletes(people);
    })();
  }, []);

  const filled = entries.filter((entry) => entry.name.trim());
  const takenAthleteIds = new Set(entries.map((e) => e.athleteId).filter(Boolean) as string[]);

  function updateEntry(key: string, patch: Partial<Entry>) {
    setEntries((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  /**
   * Reads an .xlsx file (ФИО/позывной in column A, город in column B) and
   * turns each row into an entry, matching existing athlete profiles by
   * nickname so a linked import never mints a duplicate identity. Rows land
   * in the same editable list as manually typed ones, so the organizer can
   * still fix a name or city before anything is saved.
   */
  async function handleImportFile(file: File) {
    setImportBusy(true);
    setImportSummary(null);
    setError(null);
    try {
      const rows = await parseParticipantsExcel(file, athletes);
      if (rows.length === 0) {
        setError(
          "В файле не найдено участников. Первая строка листа — заголовки, со второй — ФИО/позывной и город.",
        );
        return;
      }
      setEntries((current) => {
        const kept = current.filter((entry) => entry.name.trim());
        const imported = rows.map((row) => ({
          key: crypto.randomUUID(),
          athleteId: row.athleteId,
          name: row.name,
          city: row.city,
          seed: "",
        }));
        return [...kept, ...imported];
      });
      const matched = rows.filter((row) => row.athleteId).length;
      setImportSummary(
        `Импортировано участников: ${rows.length}. Сопоставлено с профилем: ${matched}.`,
      );
    } catch {
      setError("Не удалось прочитать файл. Поддерживается формат .xlsx.");
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

  /** Creates the tournament + competition and enters everyone, then previews. */
  async function submitParticipants() {
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
      const competition = await createCompetition(tournament.id, {
        name: title.trim(),
        type: "INDIVIDUAL",
        format,
        status: "REGISTRATION",
      });

      for (const entry of filled) {
        await addParticipant(competition.id, {
          // A linked profile wins; the typed name is only a fallback for
          // someone with no profile at all.
          athlete_id: entry.athleteId,
          display_name: entry.athleteId ? null : entry.name.trim(),
          city: entry.city.trim() || null,
          seed: entry.seed ? Number(entry.seed) : null,
        });
      }

      setTournamentId(tournament.id);
      setCompetitionId(competition.id);
      setPlan(await previewBracket(competition.id));
      setStep(2);
    });
  }

  async function commitBracket() {
    await run(async () => {
      if (!competitionId || !tournamentId) return;
      await generateBracket(competitionId, { final_weapon: finalWeapon });
      setStep(3);
      router.push(`/tournaments/${tournamentId}/competitions/${competitionId}`);
    });
  }

  const canLeaveStepOne = title.trim().length >= 2 && rulesetId;
  const canLeaveStepTwo = filled.length >= 2;

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
            <li key={label} className="flex-1">
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
                <span className="font-record">
                  {done ? <Check className="size-3.5" strokeWidth={2.5} /> : index + 1}
                </span>
                {label}
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
              <Field label="Дата начала">
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
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Формат">
                {(props) => (
                  <Select
                    {...props}
                    value={format}
                    onChange={(event) => setFormat(event.target.value as CompetitionFormat)}
                  >
                    {(Object.keys(competitionFormat) as CompetitionFormat[]).map((key) => (
                      <option key={key} value={key}>
                        {competitionFormat[key]}
                      </option>
                    ))}
                  </Select>
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
            </div>
            {error ? <Alert tone="danger">{error}</Alert> : null}
            <div className="pt-1">
              <Button type="button" disabled={!canLeaveStepOne} onClick={() => setStep(1)}>
                Дальше: участники
              </Button>
            </div>
          </Card>
        ) : null}

        {/* ------------------------------------------ step 2: participants */}
        {step === 1 ? (
          <Card className="space-y-4 p-5">
            <div>
              <h3 className="font-display text-lg font-semibold tracking-tight">Участники</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Если у бойца уже есть профиль на платформе — найдите и привяжите его, чтобы не
                создавать дубль. Город нужен, чтобы развести земляков в первом круге.
              </p>
            </div>

            <AthletePicker
              athletes={athletes}
              taken={takenAthleteIds}
              onPick={(athlete) => {
                const empty = entries.find((entry) => !entry.name.trim());
                const patch = { athleteId: athlete.id, name: athlete.nickname ?? "Спортсмен" };
                if (empty) updateEntry(empty.key, patch);
                else setEntries((rows) => [...rows, { ...newEntry(), ...patch }]);
              }}
            />

            <ul className="space-y-2">
              {entries.map((entry, index) => (
                <li
                  key={entry.key}
                  className="grid gap-2 rounded-[var(--radius-sm)] border border-[var(--border)] p-2 sm:grid-cols-[1.5rem_1fr_1fr_5rem_2rem] sm:items-center"
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
                  <Input
                    value={entry.city}
                    onChange={(event) => updateEntry(entry.key, { city: event.target.value })}
                    placeholder="Город"
                    aria-label={`Город участника ${index + 1}`}
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
                    onClick={() => setEntries((rows) => rows.filter((row) => row.key !== entry.key))}
                    className="justify-self-end rounded-full p-1.5 text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--danger)]"
                  >
                    <Trash2 className="size-4" strokeWidth={2} />
                  </button>
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={<Plus className="size-3.5" strokeWidth={2.5} />}
                onClick={() => setEntries((rows) => [...rows, newEntry()])}
              >
                Добавить участника
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={importBusy}
                icon={<FileSpreadsheet className="size-3.5" strokeWidth={2.25} />}
                onClick={() => fileInputRef.current?.click()}
              >
                {importBusy ? "Читаем файл…" : "Импорт из Excel"}
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
              Файл .xlsx: первая строка — заголовки, со второй — столбец A «ФИО/позывной», столбец
              B «Город». Импортированные строки можно поправить перед сохранением.
            </p>

            {importSummary ? <Alert tone="success">{importSummary}</Alert> : null}
            {error ? <Alert tone="danger">{error}</Alert> : null}

            <div className="flex flex-wrap gap-2 border-t border-[var(--border)] pt-3">
              <Button
                type="button"
                disabled={!canLeaveStepTwo || busy}
                icon={<UserPlus className="size-3.5" strokeWidth={2.25} />}
                onClick={() => void submitParticipants()}
              >
                {busy ? "Сохраняем…" : `Дальше: распределение (${filled.length})`}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setStep(0)} disabled={busy}>
                Назад
              </Button>
            </div>
          </Card>
        ) : null}

        {/* ------------------------------------------- step 3: review plan */}
        {step === 2 && plan ? (
          <Card className="space-y-4 p-5">
            <div>
              <h3 className="font-display text-lg font-semibold tracking-tight">
                Проверка распределения
              </h3>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Так будет выглядеть первый круг. Сетку ещё не построена — можно вернуться и
                поправить состав.
              </p>
            </div>

            <PlanSummary plan={plan} />
            <CityVerdict plan={plan} />
            <PairPreview plan={plan} />

            <div className="space-y-2 border-t border-[var(--border)] pt-3">
              <p className="record-label text-[var(--chrome-muted)]">Оружие финала</p>
              <p className="text-xs text-[var(--muted)]">
                В финале жребий не бросается — оружие определяется правилами турнира.
              </p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setFinalWeapon(null)}
                  aria-pressed={finalWeapon === null}
                  className={cn(
                    "rounded-[var(--radius-sm)] border px-2.5 py-1.5 text-xs transition-colors",
                    finalWeapon === null
                      ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                      : "border-[var(--border-strong)] text-[var(--muted)] hover:bg-[var(--surface-muted)]",
                  )}
                >
                  Не задавать
                </button>
                {(["PALKA", "NOZH", "HANDS", "KISTEN"] as WeaponCategory[]).map((weapon) => (
                  <button
                    key={weapon}
                    type="button"
                    onClick={() => setFinalWeapon(weapon)}
                    aria-pressed={finalWeapon === weapon}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border px-2.5 py-1.5 text-xs transition-colors",
                      finalWeapon === weapon
                        ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                        : "border-[var(--border-strong)] text-[var(--muted)] hover:bg-[var(--surface-muted)]",
                    )}
                  >
                    <WeaponGlyph weapon={weapon} size={14} />
                    {weaponCategory[weapon]}
                  </button>
                ))}
              </div>
            </div>

            {error ? <Alert tone="danger">{error}</Alert> : null}

            <div className="flex flex-wrap gap-2 border-t border-[var(--border)] pt-3">
              <Button type="button" disabled={busy} onClick={() => void commitBracket()}>
                {busy ? "Строим сетку…" : "Построить сетку"}
              </Button>
              {competitionId && tournamentId ? (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={() =>
                    router.push(`/tournaments/${tournamentId}/competitions/${competitionId}`)
                  }
                >
                  Открыть дисциплину без сетки
                </Button>
              ) : null}
            </div>
          </Card>
        ) : null}

        {step === 3 ? (
          <Alert tone="success" title="Сетка построена">
            Открываем дисциплину…
          </Alert>
        ) : null}
      </motion.div>
    </div>
  );
}

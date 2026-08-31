/**
 * Backend enums are locale-free; every user-facing string lives here so the
 * wording stays consistent across pages.
 */

import type {
  AthleteLevel,
  AthleteParticipationOutcome,
  CompetitionFormat,
  CompetitionStatus,
  CompetitionType,
  CourseLevel,
  CourseType,
  DrawType,
  LotMethod,
  MatchStage,
  MatchStatus,
  ParticipantStatus,
  ResultMethod,
  RuleType,
  TournamentStatus,
  WeaponCategory,
} from "@/types";

export type Tone = "neutral" | "info" | "active" | "success" | "warning" | "danger";

export const tournamentStatus: Record<TournamentStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: "Черновик", tone: "neutral" },
  REGISTRATION: { label: "Регистрация", tone: "info" },
  READY: { label: "Готов к жеребьёвке", tone: "info" },
  BRACKET_CREATED: { label: "Сетка построена", tone: "info" },
  RUNNING: { label: "Идёт", tone: "active" },
  ACTIVE: { label: "Активен", tone: "active" },
  FINAL: { label: "Финал", tone: "warning" },
  FINISHED: { label: "Завершён", tone: "success" },
  ARCHIVED: { label: "В архиве", tone: "neutral" },
};

export const competitionStatus: Record<CompetitionStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: "Черновик", tone: "neutral" },
  REGISTRATION: { label: "Регистрация", tone: "info" },
  RUNNING: { label: "Идёт", tone: "active" },
  ACTIVE: { label: "Активна", tone: "active" },
  FINISHED: { label: "Завершена", tone: "success" },
  CANCELLED: { label: "Отменена", tone: "danger" },
};

export const competitionType: Record<CompetitionType, string> = {
  INDIVIDUAL: "Личная",
  TEAM: "Командная",
};

export const competitionFormat: Record<CompetitionFormat, string> = {
  SINGLE_ELIMINATION: "Олимпийская система",
  ROUND_ROBIN: "Каждый с каждым",
  GROUP_PLAYOFF: "Группы + плей-офф",
};

export const matchStatus: Record<MatchStatus, { label: string; tone: Tone }> = {
  SCHEDULED: { label: "Ожидает соперника", tone: "neutral" },
  READY_FOR_LOT: { label: "Ждёт жребия", tone: "info" },
  LOT_COMPLETED: { label: "Жребий брошен", tone: "info" },
  READY: { label: "Готов к бою", tone: "info" },
  IN_PROGRESS: { label: "Идёт", tone: "active" },
  FINISHED: { label: "Завершён", tone: "success" },
  CANCELLED: { label: "Отменён", tone: "danger" },
};

export const matchStage: Record<MatchStage, string> = {
  QUALIFICATION: "Квалификация",
  GROUP: "Группа",
  TEAM_BOUT: "Трое на трое",
  ROUND_OF_128: "1/64 финала",
  ROUND_OF_64: "1/32 финала",
  ROUND_OF_32: "1/16 финала",
  ROUND_OF_16: "1/8 финала",
  QUARTERFINAL: "Четвертьфинал",
  SEMIFINAL: "Полуфинал",
  FINAL: "Финал",
};

export const resultMethod: Record<ResultMethod, string> = {
  JUDGE_DECISION: "Решение судей",
  ROUND_WINS: "По соступам",
  DISARM: "Обезоруживание",
  PIN_AND_FINISH: "Удержание и добивание",
  WITHDRAWAL: "Отказ",
  DISQUALIFICATION: "Дисквалификация",
  NO_SHOW: "Неявка",
};

/** The four lot categories. */
export const weaponCategory: Record<WeaponCategory, string> = {
  PALKA: "Тростка",
  NOZH: "Нож",
  HANDS: "Безоружный",
  KISTEN: "Кистень",
};

export const lotMethod: Record<LotMethod, string> = {
  PHYSICAL_DICE: "Живой кубик",
  ONLINE_DICE: "Онлайн-жребий",
};

/** How a соступ ended. */
export const roundEndReason: Record<string, string> = {
  POINTS: "3 очка",
  CLEAN_HIT: "Чистая победа",
  KISTEN_CLEAN: "Чистая победа",
  DISARM: "Обезоруживание",
  JUDGE_DECISION: "Решение судей",
  WITHDRAWAL: "Отказ",
};

export const participantStatus: Record<ParticipantStatus, { label: string; tone: Tone }> = {
  REGISTERED: { label: "Зарегистрирован", tone: "neutral" },
  CONFIRMED: { label: "Подтверждён", tone: "info" },
  APPROVED: { label: "Допущен", tone: "success" },
  WAITLISTED: { label: "В листе ожидания", tone: "warning" },
  WITHDRAWN: { label: "Снялся", tone: "warning" },
  DISQUALIFIED: { label: "Дисквалифицирован", tone: "danger" },
  ELIMINATED: { label: "Выбыл", tone: "neutral" },
};

/**
 * How an athlete's run through one competition is summarized on their
 * profile. CHAMPION/FINALIST come from the final's real result; ELIMINATED
 * names the stage a lost match happened at. None of this is a numeric
 * placement — see `AthleteParticipationView`.
 */
export const athleteOutcome: Record<AthleteParticipationOutcome, { label: string; tone: Tone }> = {
  CHAMPION: { label: "Чемпион", tone: "success" },
  FINALIST: { label: "Финалист", tone: "info" },
  ELIMINATED: { label: "Выбыл", tone: "neutral" },
  STANDINGS: { label: "Круговой этап", tone: "info" },
  IN_PROGRESS: { label: "Турнир продолжается", tone: "active" },
  WITHDRAWN: { label: "Снялся", tone: "warning" },
  DISQUALIFIED: { label: "Дисквалифицирован", tone: "danger" },
};

export const drawType: Record<DrawType, string> = {
  RANDOM: "Случайная",
  SEEDED: "С посевом",
  MANUAL: "Ручная",
};

export const athleteLevel: Record<AthleteLevel, string> = {
  BEGINNER: "Начинающий",
  PRACTITIONER: "Практикующий",
  INSTRUCTOR: "Инструктор",
  MASTER: "Мастер",
};

export const courseType: Record<CourseType, string> = {
  GENERAL: "Общий",
  ATHLETE: "Для спортсменов",
  INSTRUCTOR: "Для инструкторов",
  JUDGE: "Для судей",
};

export const courseLevel: Record<CourseLevel, string> = {
  BEGINNER: "Начальный",
  INTERMEDIATE: "Средний",
  ADVANCED: "Продвинутый",
};

export const ruleType: Record<RuleType, string> = {
  GENERAL: "Общее",
  SAFETY: "Безопасность",
  COMBAT: "Ведение боя",
  JUDGING: "Судейство",
  VIOLATION: "Нарушения",
};

export const documentType: Record<string, string> = {
  RULES: "Регламент",
  POSITION: "Положение",
  RESULTS: "Результаты",
};

export const teamMemberRole: Record<string, string> = {
  FIGHTER: "Боец",
  RESERVE: "Запасной",
  CAPTAIN: "Капитан",
};

export const eventType: Record<string, string> = {
  DRAW_CREATED: "Создана жеребьёвка",
  MATCH_UPDATED: "Изменён бой",
  PLAYER_WITHDRAWN: "Участник снялся",
  PLAYER_DISQUALIFIED: "Дисквалификация",
  BRACKET_CHANGED: "Изменена сетка",
  BRACKET_GENERATED: "Построена сетка",
  BYE_GRANTED: "Свободный проход",
  PARTICIPANT_ADVANCED: "Выход в следующий круг",
  LOT_DRAWN: "Брошен жребий",
  LOT_COMPLETED: "Жребий завершён",
  LOT_OVERRIDDEN: "Жребий изменён судьёй",
  BOUT_STARTED: "Начат поединок",
  FINAL_STARTED: "Начат финал",
  ROUND_STARTED: "Начат соступ",
  ROUND_SCORED: "Засчитано очко",
  ROUND_COMPLETED: "Завершён соступ",
  BOUT_COMPLETED: "Завершён поединок",
  WINNER_DECLARED: "Объявлен победитель",
  TEAM_BOUTS_GENERATED: "Созданы командные встречи",
  TEAM_PAIRING_COMPLETED: "Завершена командная схватка",
};

/**
 * Journal severity. Most events are routine record-keeping (info); a
 * disqualification or a judge overriding an already-thrown lot is the kind of
 * entry that should stand out from "жребий брошен" in the same list. Anything
 * not listed here reads as routine (info).
 */
export const eventTone: Record<string, Tone> = {
  PLAYER_WITHDRAWN: "warning",
  PLAYER_DISQUALIFIED: "danger",
  LOT_OVERRIDDEN: "warning",
  MATCH_UPDATED: "warning",
  WINNER_DECLARED: "success",
  BOUT_COMPLETED: "success",
  TEAM_PAIRING_COMPLETED: "success",
};

/** Falls back to the raw code so an unmapped backend value is still visible. */
export function labelOf<T extends string>(dict: Record<string, string>, key: T | null): string {
  if (!key) return "—";
  return dict[key] ?? key;
}

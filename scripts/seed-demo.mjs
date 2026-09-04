// Demo data for a local stack: enough of a real archive that every page has
// something to show — clubs, athletes, three tournaments in different states,
// and one running competition carried all the way to recorded results.
//
//   node scripts/seed-demo.mjs            # against http://localhost:8000
//   API=http://host:8000 node scripts/...  # or wherever the API is
//
// Needs the backend up and migrated (`docker compose up -d` then
// `docker compose exec backend alembic upgrade head` from `backend/`).
//
// Everything goes in over the public API rather than straight into Postgres, so
// the data it leaves behind is data the application itself would accept —
// business rules included — and the script doubles as a smoke test of the write
// endpoints.
//
// Re-runnable: every step looks for what it would create before creating it, so
// a half-finished run (or a second run against the same database) tops the data
// up instead of failing on a unique constraint.
//
// Everyone it creates shares one password, printed at the end with the sign-in
// address. Demo credentials on a local database — never point this at anything
// that isn't a throwaway.
const API = process.env.API ?? "http://localhost:8000";
const PASSWORD = "Mstina2026!";

async function call(method, path, body, token) {
  const res = await fetch(API + path, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(data).slice(0, 300)}`);
  return data;
}

const post = (path, body, token) => call("POST", path, body, token);
const get = (path, token) => call("GET", path, undefined, token);
const list = async (path) => {
  try {
    const data = await get(path);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};

/** Create only what isn't there yet, matched on `find`. */
async function ensure(listPath, find, body) {
  const existing = (await list(listPath)).find(find);
  return existing ?? post(listPath, body);
}

async function makeUser(email, first, last) {
  const password = PASSWORD;
  try {
    await post("/api/v1/auth/register", { email, password, first_name: first, last_name: last });
  } catch (e) {
    const message = String(e);
    if (!message.includes("409") && !message.includes("already") && !message.includes("400")) throw e;
  }
  const tokens = await post("/api/v1/auth/login", { email, password });
  const me = await get("/api/v1/users/me", tokens.access_token);
  return { id: me.id, token: tokens.access_token, name: `${first} ${last}` };
}

const iso = (days) => new Date(Date.now() + days * 864e5).toISOString();

console.log("-> users");
const organizer = await makeUser("organizer@mstina-demo.ru", "Пётр", "Замятин");
/**
 * Драковое имя — earned in a fight and for something, never cut down from a
 * surname: the point of it was that death would take longer to find you, and a
 * name that plainly says whose son you are defeats that. So each one here comes
 * from how the man fights or what happened to him, and the bio says which.
 */
const roster = [
  ["gorbunov", "Илья", "Горбунов", "Полымя", "Боровичи", 1994, "INSTRUCTOR", "Заводится с первого удара и гаснет только к концу схода."],
  ["zhilin", "Никита", "Жилин", "Молчун", "Валдай", 1998, "PRACTITIONER", "За весь круг не сказал ни слова — ни до, ни после."],
  ["shatalov", "Артём", "Шаталов", "Кистень", "Вышний Волочёк", 1991, "INSTRUCTOR", "Бьёт с оттяжкой, будто на цепи: отсюда и имя."],
  ["kudrin", "Роман", "Кудрин", "Косой", "Боровичи", 2000, "PRACTITIONER", "Заходит всегда со стороны, прямо не идёт никогда."],
  ["lomov", "Фёдор", "Ломов", "Сажа", "Валдай", 1989, "MASTER", "Работал в кузне, на сход приходил не отмывшись."],
  ["sizov", "Глеб", "Сизов", "Репей", "Вышний Волочёк", 2002, "BEGINNER", "Вцепится в рукав — так до конца круга и не отдерёшь."],
];
const fighters = [];
for (const [slug, first, last, nick, city, year, level, why] of roster) {
  const user = await makeUser(`${slug}@mstina-demo.ru`, first, last);
  fighters.push({ ...user, nick, city, year, level, why });
}

console.log("-> ruleset");
const ruleset = await ensure("/api/v1/rulesets", (r) => r.title === "Правила Мстинской традиции", {
  title: "Правила Мстинской традиции",
  description: "Свод, по которому судят сходы: поединок, стенка, круг.",
  version: "1.0",
  status: "ACTIVE",
  published_at: iso(-120),
});

console.log("-> clubs");
const clubs = [];
for (const [name, city, about] of [
  ["Мста", "Боровичи", "Домашний клуб традиции, ведёт сходы на реке."],
  ["Валдай", "Валдай", "Школа палочного боя и стенки."],
  ["Волхов", "Вышний Волочёк", "Круговой бой и работа ножом."],
]) {
  clubs.push(
    await ensure("/api/v1/clubs", (c) => c.name === name, { name, city, country: "Россия", description: about }),
  );
}

console.log("-> athletes");
const athletes = [];
for (const [index, fighter] of fighters.entries()) {
  athletes.push(
    await ensure("/api/v1/athletes", (a) => a.user_id === fighter.id, {
      user_id: fighter.id,
      nickname: fighter.nick,
      birth_year: fighter.year,
      experience_years: 2 + index * 2,
      level: fighter.level,
      bio: `${fighter.why} ${fighter.name}, ${fighter.city}.`,
    }),
  );
}

console.log("-> tournaments");
const tournament = (title, body) => ensure("/api/v1/tournaments", (t) => t.title === title, { title, ...body });

const running = await tournament("Мстинский сход 2026", {
  description: "Главный сход года: поединки на палках и ножах, стенка на берегу Мсты.",
  status: "RUNNING",
  start_date: iso(-1),
  end_date: iso(1),
  location: "Берег Мсты",
  city: "Боровичи",
  country: "Россия",
  organizer_id: organizer.id,
  ruleset_id: ruleset.id,
});

const upcoming = await tournament("Валдайская стенка", {
  description: "Стенка на стенку и круговой бой, набор участников открыт.",
  status: "REGISTRATION",
  start_date: iso(34),
  end_date: iso(35),
  location: "Городской вал",
  city: "Валдай",
  country: "Россия",
  organizer_id: organizer.id,
  ruleset_id: ruleset.id,
});

const archived = await tournament("Зимний круг 2025", {
  description: "Прошедший сход: круговой бой один на один.",
  status: "ARCHIVED",
  start_date: iso(-280),
  end_date: iso(-279),
  location: "Манеж",
  city: "Вышний Волочёк",
  country: "Россия",
  organizer_id: organizer.id,
  ruleset_id: ruleset.id,
});

console.log("-> categories and registrations");
const categories = [];
for (const [name, about] of [
  ["Палка", "Поединок на палках, личный зачёт."],
  ["Нож", "Поединок на ножах, личный зачёт."],
  ["Безоружный", "Без оружия, личный зачёт."],
]) {
  categories.push(
    await ensure(`/api/v1/tournaments/${running.id}/categories`, (c) => c.name === name, {
      name,
      description: about,
    }),
  );
}

const registered = await list(`/api/v1/tournaments/${running.id}/participants`);
for (const [index, athlete] of athletes.entries()) {
  if (registered.some((p) => p.athlete_id === athlete.id)) continue;
  await post(`/api/v1/tournaments/${running.id}/participants`, {
    category_id: categories[index % categories.length].id,
    athlete_id: athlete.id,
    status: index < 4 ? "APPROVED" : "REGISTERED",
  });
}

console.log("-> competition, draw, bracket");
const competition =
  (await list(`/api/v1/tournaments/${running.id}/competitions`)).find((c) => c.name === "Палка · личный зачёт") ??
  (await post("/api/v1/competitions", {
    tournament_id: running.id,
    name: "Палка · личный зачёт",
    description: "Одиночная выбывающая сетка на шестерых.",
    type: "INDIVIDUAL",
    format: "SINGLE_ELIMINATION",
    status: "RUNNING",
  }));

const existingEntrants = await list(`/api/v1/competitions/${competition.id}/participants`);
const entrants = [];
for (const [index, athlete] of athletes.entries()) {
  const found = existingEntrants.find((p) => p.athlete_id === athlete.id);
  if (found) {
    entrants.push(found);
    continue;
  }
  const fighter = fighters[index];
  entrants.push(
    await post(`/api/v1/competitions/${competition.id}/participants`, {
      competition_id: competition.id,
      athlete_id: athlete.id,
      type: "ATHLETE",
      seed: index + 1,
      status: "APPROVED",
      city: fighter.city,
      club_id: clubs[index % clubs.length].id,
    }),
  );
}

const draw =
  (await list(`/api/v1/competitions/${competition.id}/draws`)).find((d) => d.name === "Жеребьёвка палки") ??
  (await post(`/api/v1/competitions/${competition.id}/draws`, {
    competition_id: competition.id,
    name: "Жеребьёвка палки",
    type: "SEEDED",
    status: "GENERATED",
  }));

const existingBrackets = await list(`/api/v1/competitions/${competition.id}/brackets`);
const brackets = [];
for (const [round, position, name] of [
  [1, 1, "Полуфинал 1"],
  [1, 2, "Полуфинал 2"],
  [2, 1, "Финал"],
]) {
  brackets.push(
    existingBrackets.find((b) => b.name === name) ??
      (await post(`/api/v1/competitions/${competition.id}/brackets`, {
        competition_id: competition.id,
        draw_id: draw.id,
        name,
        round,
        position,
      })),
  );
}

console.log("-> matches and results");
const existingMatches = await list(`/api/v1/competitions/${competition.id}/matches`);
const matches = [];
for (const [a, b, bracket, status, stage] of [
  [0, 1, brackets[0], "FINISHED", "SEMIFINAL"],
  [2, 3, brackets[1], "FINISHED", "SEMIFINAL"],
  [0, 2, brackets[2], "SCHEDULED", "FINAL"],
]) {
  matches.push(
    existingMatches.find((m) => m.bracket_id === bracket.id) ??
      (await post("/api/v1/competition-matches", {
        competition_id: competition.id,
        draw_id: draw.id,
        bracket_id: bracket.id,
        participant_a_id: entrants[a].id,
        participant_b_id: entrants[b].id,
        stage,
        status,
      })),
  );
}

for (const [matchIndex, winnerIndex, method, comment] of [
  [0, 0, "JUDGE_DECISION", "Решение судей: чище работа по корпусу."],
  [1, 2, "DISARM", "Обезоружен на второй сшибке."],
]) {
  try {
    await post(`/api/v1/matches/${matches[matchIndex].id}/result`, {
      match_id: matches[matchIndex].id,
      winner_id: entrants[winnerIndex].id,
      method,
      comment,
    });
  } catch (e) {
    // 409 = a result is already recorded. Results are append-then-correct, so a
    // re-run must not overwrite one that's already in the journal.
    if (!String(e).includes("409")) throw e;
  }
}

const all = await get("/api/v1/tournaments");
console.log("\nseeded:");
console.log("  tournaments:", all.map((t) => `${t.title} [${t.status}]`).join(", "));
console.log("  clubs:", (await list("/api/v1/clubs")).length, "· athletes:", (await list("/api/v1/athletes")).length);
console.log("  running:      http://localhost:3000/tournaments/" + running.id);
console.log("  discipline:   http://localhost:3000/tournaments/" + running.id + "/competitions/" + competition.id);
console.log("  registration: http://localhost:3000/tournaments/" + upcoming.id);
console.log("  archived:     http://localhost:3000/tournaments/" + archived.id);
console.log("\nsign in at http://localhost:3000/login — password for everyone: " + PASSWORD);
console.log("  organizer: organizer@mstina-demo.ru");
console.log("  fighters:  " + roster.map(([slug]) => `${slug}@mstina-demo.ru`).join(", "));

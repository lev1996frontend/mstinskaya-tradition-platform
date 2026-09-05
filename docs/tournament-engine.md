
# Tournament Engine Specification

## Цель

Система управления соревнованиями Мстинской традиции.

Поддерживаемые форматы:

1. Личные бои 1х1
2. Круговая система "каждый с каждым"
3. Командные соревнования

Система должна поддерживать:

* автоматическую жеребьёвку;
* создание турнирной сетки;
* быстрое изменение результатов;
* отказ участников;
* дисквалификацию;
* историю изменений.

---

# Основные сущности

## Tournament

Событие.

Пример:

Открытый турнир Мстинской традиции 2026

Поля:

id UUID

title

description

location

city

country

start_date

end_date

status:

DRAFT
REGISTRATION
RUNNING
FINISHED
ARCHIVED

organizer_id

ruleset_id

---

# Competition

Отдельная дисциплина внутри турнира.

Пример:

Турнир 2026

 ├── Мужчины оружие
 ├── Женщины оружие
 ├── Команды 3х3

Поля:

id UUID

tournament_id

name

type:

INDIVIDUAL
TEAM

format:

SINGLE_ELIMINATION
ROUND_ROBIN
GROUP_PLAYOFF

status

---

# Participant

Участник соревнования.

Может быть:

* спортсмен;
* команда.

participants

id UUID

competition_id

type:

ATHLETE
TEAM

status:

REGISTERED
CONFIRMED
RESERVE
WITHDRAWN
DISQUALIFIED

`RESERVE` — заявленный, но вне жеребьёвки: ждёт, когда его поставят вместо
выбывшего. Не то же самое, что `WITHDRAWN` / `DISQUALIFIED`: те вышли, а
запасной ещё не входил, и присуждать проход без боя против него не за что.

---

# Team

Команда.

teams

id UUID

competition_id

name

club_id

captain_id

---

# TeamMember

Состав команды.

team_members

id UUID

team_id

athlete_id

role:

FIGHTER
RESERVE
CAPTAIN

---

# Draw Engine

Жеребьёвка.

Поддерживает правила:

avoid_same_city

avoid_same_club

avoid_same_instructor

avoid_same_team

Пример:

Москва:

* Иван
* Сергей

Первый бой:

❌ Иван - Сергей

если есть другие варианты.

---

# Draw

draws

id UUID

competition_id

type:

RANDOM
SEEDED
MANUAL

created_at

---

# Bracket

Турнирная сетка.

brackets

id UUID

competition_id

round:

1
2
SEMIFINAL
FINAL

position

---

# Match

Бой.

matches

id UUID

competition_id

participant_a_id

participant_b_id

stage:

QUALIFICATION
GROUP
QUARTERFINAL
SEMIFINAL
FINAL

status:

SCHEDULED
RUNNING
FINISHED
CANCELLED

winner_id

---

# MatchResult

Результат.

Важно:

НЕ храним очки.

Только решение.

match_results

id UUID

match_id

winner_id

method:

JUDGE_DECISION

WITHDRAWAL

DISQUALIFICATION

NO_SHOW

comment

---

# ParticipantHistory

История изменений.

Например:

Иван

10:00 зарегистрирован

11:00 подтверждён

12:30 снялся

Таблица:

participant_status_history

id UUID

participant_id

old_status

new_status

reason

created_at

---

# Competition Events

Журнал действий.

Для судейской команды:

competition_events

id UUID

competition_id

event_type:

DRAW_CREATED

MATCH_UPDATED

PLAYER_WITHDRAWN

PLAYER_DISQUALIFIED

PARTICIPANT_REPLACED

WALKOVER_REVERSED

BRACKET_CHANGED

payload JSON

created_at

---

# Алгоритм проведения

## Если участников много

Например:

32 человека

32
 |
16
 |
8
 |
4
 |
2
 |
FINAL

---

## Если участников мало

Например:

5 человек

Создаем:

каждый с каждым

После этого:

1 место ┐
        ├ полуфинал
4 место ┘

2 место ┐
        ├ полуфинал
3 место ┘

---

# Live обновление

После завершения боя:

Backend отправляет событие:

MATCH_FINISHED

Frontend обновляет:

* сетку;
* результаты;
* следующий бой.

Технология:

FastAPI WebSocket.

---

# Снятие и замена

Снятие бойца **не перестраивает сетку**. Состав боёв, их идентификаторы и
нумерация остаются прежними; меняется лишь то, чем закрываются его
незаигранные бои. Уже проведённые бои не трогаются никогда.

Два пути, и выбор между ними делается в момент снятия.

## Снятие без замены

`POST /api/v1/participants/{id}/withdraw` с причиной. Каждый незаигранный бой
снявшегося присуждается сопернику как `WALKOVER` (`result_type`: `WITHDRAWAL`
или `DISQUALIFICATION`), победитель продвигается дальше. Бой, соперник в
котором ещё не определён, присудить некому — он закрывается позже, в момент,
когда напротив садится победитель предыдущего круга.

Начатый бой (`LOT_COMPLETED`, `IN_PROGRESS`) снятие блокирует: жребий уже
брошен, и судья должен сначала завершить или отменить бой.

## Снятие с заменой

Тот же запрос с `replacement_participant_id`. Проход без боя **не выдаётся
вовсе** — заменяющий садится на освободившееся место, и соперник получает бой.

Заменяющий — это отдельная запись участника, а не переписанное имя в старой:
выбывший сохраняет свою строку, свой статус и свою историю. Связь пишется в
`tournament_participants.replaces_participant_id` — на заменяющем, указывая на
выбывшего. Заменяющий наследует посев и подгруппу, иначе групповая таблица
потеряет строку.

Кем можно заменить: запасным (`RESERVE`) или любым заявленным на этот турнир.
Отказы — до любой записи, чтобы отклонённая замена не оставила бойца
полуснятым:

* `ALREADY_FOUGHT` — снявшийся уже провёл бой;
* `BOUT_IN_FLIGHT` — у него начатый бой;
* `ALREADY_IN_COMPETITION` — заменяющий уже в этой сетке;
* `AGE_OUT_OF_BOUNDS` — заменяющий не проходит по возрастным границам
  дисциплины (та же проверка, что и при импорте заявки);
* `REPLACEMENT_IS_OUT` — заменяющий сам снят или дисквалифицирован.

## Замена после снятия

`POST /api/v1/participants/{id}/replace` — для случая, когда бойца сняли утром,
а замену клуб нашёл через час. К этому моменту проход без боя уже выдан и
соперник уже продвинут, поэтому операция отменяет и то, и другое: удаляет
записанный `WALKOVER`, открывает бой заново и убирает соперника из следующего
круга (`WALKOVER_REVERSED` в журнале).

Отменяется **только** проход без боя. Если соперник успел провести бой, в
который его продвинули, замена отказывает с `OPPONENT_ALREADY_FOUGHT`:
отменить его проход значило бы стереть состоявшийся поединок, что запрещено
`docs/architecture.md`.

## Подбор замены

`GET /api/v1/participants/{id}/replacement-candidates` — только чтение,
ничего не пишет. Список ранжирован: сначала запасные того же клуба, что у
выбывшего, затем прочие запасные, затем остальные заявленные. Каждый кандидат
несёт основание (`SAME_CLUB_RESERVE` / `RESERVE` / `OTHER_COMPETITION`) и
`busy_in` — дисциплины, в которых он уже дерётся. `busy_in` не запрет, а
предупреждение о возможной накладке по времени: решает организатор.

Автоматизация кончается на предложении. В сетку заменяющего ставит только
явный запрос организатора.

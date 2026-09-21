# TODO — ревью приложения (2026-09-19)

> Обновление 2026-09-19 (3): все пункты закрыты, кроме одного — SSR-паттерн для
> role-requests остаётся [DEFERRED], см. объяснение внизу (требует новой
> security-чувствительной инфраструктуры — серверного чтения сессии — которой
> в кодовой базе нет нигде, включая приватные страницы; не стал изобретать её
> в рамках багфикс-сессии без отдельного решения по архитектуре).

Сводный бэклог по итогам ревью frontend (Next.js) и backend (FastAPI) на предмет
продуктовых/UI проблем, багов, несоответствий и техдолга. Фокус — недавно
влившийся модуль role-requests (модерация ролей) и связанные с ним изменения
(profile, site-header, labels, routes, types).

Приоритеты: 🔴 высокий (бага/риск), 🟡 средний, ⚪ низкий/косметика.

---

## Backend

### Architecture Violations

- 🟡 [FIXED] **`tournaments` лезло напрямую в модели `athletes`** — было 8 сайтов прямого доступа (`age_split_service.py`, `bracket_service.py`, `engine_service.py`, `read_common.py`, `read_service.py` ×2, `tournament_service.py`, `withdrawal_service.py`) плюс `ratings/service.py` ×4. Добавлен `app/core/athletes_access.py` (зеркалит `identity_access.py`: `get_athlete`, `get_athletes_by_ids`, re-export типа `Athlete` для аннотаций), все 9 файлов переведены на него. `participant_import.py` уже был в порядке (шёл через `AthleteService`) — не трогал.
- 🟡 [FIXED] **`ratings` тоже лезла напрямую в `athletes`** — закрыто тем же рефакторингом (`app/modules/ratings/service.py`, 4 места → `get_athlete`).
- ⚪ [FIXED частично] **`rules` и `equipment` читали `media.models.MediaFile` напрямую** — `equipment_service.py`: единственный прямой `session.get(MediaFile, ...)` заменён на уже существующий `MediaService(session).get_media_file(...)`. `rule_service.py`: оставлен как есть — единственное настоящее прямое обращение там (`list_rule_set_documents`) это `SELECT RuleSetDocument JOIN MediaFile` для одной read-проекции; `MediaService` не даёt bulk/join-метода, и городить его ради одного списочного запроса — это добавление абстракции ради одного вызова (сама модель `MediaFile` там уже импортируется и как тип, что не проблема). Второе место (`create_rule_set_document`) уже и так шло через `MediaService`.
- 🟡 [FIXED] **Роль `ADMIN` в `privileged_access.py` была недостижима** — миграция `20260919_admin_role_and_cleanup.py` сидит роль (без выдачи).
- ⚪ [FIXED] **CLAUDE.md устарел** (три роутера → пять) — обновлено.

### Bugs

- 🔴 [FIXED] **Race condition / lost update при одновременном ревью заявки на роль** — `select(...).with_for_update()`.
- 🟡 [FIXED] **Нет рейт-лимита на создание заявок на роль** — `@limiter.limit("5/hour")`.

### Technical Debt / Inconsistencies

- ⚪ **Нет audit-трейла решений по role-request** — осознанное решение по спеке, действий не требуется.
- ⚪ [FIXED] **Дублирующийся unique-индекс на `Role.code`** — убран.
- ⚪ **`session_auth.py`: `Authorization`-заголовок перекрывает cookie** — проверено, осознанный безопасный дизайн, действий не требуется.
- ⚪ [FIXED] **Нет защиты от `CORS_ORIGINS=*` + `allow_credentials=True`** — startup-guard добавлен.

### Продуктовое решение (принято пользователем 2026-09-19)

- 🟡 [FIXED] **Самозапрос роли MODERATOR исключён.** `ROLE_CODES` в `role_request.py` и `RoleCode`-Literal в `schemas/role_request.py` больше не включают `MODERATOR` (было `INSTRUCTOR/ORGANIZER/JUDGE/MODERATOR`, стало `INSTRUCTOR/ORGANIZER/JUDGE`). Новых модераторов теперь может назначить только тот, у кого уже есть эта роль, через `identity_access.assign_role`. Зеркальный список на фронте (`REQUESTABLE_ROLES`) тоже обновлён. Существующие исторические заявки/гранты на MODERATOR не тронуты (тип ответа хранит `role_code: str`, не ограничен Literal'ом).

---

## Frontend

### Product/UX

- 🔴 [FIXED] **Модератор видел собственную заявку на роль в очереди со активными кнопками**.
- 🔴 [FIXED] **Сырые английские ошибки бэкенда показывались в русскоязычном UI** — `roleRequestErrorLabel` в `lib/labels.ts`.
- 🟡 [FIXED] **Нет дат в UI заявок на роль** — добавлены.
- 🟡 [FIXED] **Очередь модерации показывала только PENDING** — вкладки PENDING/APPROVED/REJECTED.
- 🟡 [FIXED] **Кнопка "Создать турнир" показывалась гостям** — `CreateTournamentAction`.
- 🟡 [FIXED] **Профиль показывал сырые коды ролей** — `labelOf(roleCodeLabel, ...)`, `roleCodeLabel` дополнен `ADMIN`.
- ⚪ [FIXED] **Нет отмены/отзыва заявки на роль** — добавлен `DELETE /api/v1/role-requests/{id}` (backend, только для своей PENDING-заявки — `RoleRequestService.withdraw`, hard-delete, без четвёртого статуса) + кнопка "Отозвать заявку" в `role-request-panel.tsx`. Покрыто тестами (`test_withdraw_own_pending_request_succeeds`, `test_withdraw_other_users_request_is_404`, `test_withdraw_resolved_request_is_409`).
- ⚪ [FIXED] **Самозапрос роли MODERATOR** — убран из `REQUESTABLE_ROLES` (см. backend-раздел выше; ваше решение).

### Bugs

- 🟡 [FIXED] **Fetch-и в role-requests без защиты от размонтирования**.
- 🟡 [FIXED] **`refresh()` в очереди модерации без обработки ошибок**.
- ⚪ [FIXED] **Небезопасный non-null assertion**.
- ⚪ [FIXED] **Страницы модерации и профиля не могли экспортировать `metadata`** — добавлены `layout.tsx`.

### Technical Debt / Inconsistencies

- 🟡 [DEFERRED] **Role-requests не следует паттерну "сервер фетчит / клиент мутирует".** Проверил: **ни одна** страница во всём приложении не читает сессию на сервере — `next/headers`/`cookies()` не встречается нигде в `frontend/src`, `lib/api.ts` прямо документирует, что server-компоненты не прокидывают auth-cookie. То есть паттерн "сервер фетчит" в CLAUDE.md описан для *публичных* страниц; ни одной приватной, пользовательской страницы (той, что должна знать "кто вошёл") с серверным фетчем в кодовой базе не существует — не только у role-requests. Перевести role-requests на SSR означало бы первым делом создавать не существующую нигде инфраструктуру (серверное чтение httpOnly-cookie сессии и её проброс в backend-запрос) — это архитектурное решение, затрагивающее модель безопасности всего приложения, а не точечный багфикс. Не стал изобретать его без отдельного разговора. Видимое поведение (offline-различение, skeleton, cancellation guard) уже приведено в соответствие с остальным приложением в предыдущем проходе.
- ⚪ [FIXED] **Нет loading-skeleton для панелей role-requests**.
- ⚪ [FIXED] **Прямая индексация словарей лейблов вместо `labelOf`**.
- ⚪ [FIXED] **`RoleCode`/`roleCodeLabel` не включали `ADMIN`**.
- 🟡 [Частично] **Список запрашиваемых ролей продублирован между frontend и backend** — перекрёстные комментарии добавлены; полноценная синхронизация (эндпоинт со списком ролей) не сделана — сочтено избыточным ради списка из 3 констант, меняющегося редко.
- ⚪ **`CurrentUser.roles` типизирован как `string[]`** — оставлено осознанно (см. объяснение в предыдущей версии этого файла): сужение типа потребовало бы либо неверно расширять `RoleCode`, либо заводить отдельный более широкий тип ролей.

---

## Область охвата / что уже проверено и в порядке

- Роутинг и гейтинг страницы модерации в порядке.
- `role_requests` корректно вызывает `identity_access.assign_role` при одобрении.
- Проверки "нельзя ревьюить свою заявку", 409/400/404 — реализованы и покрыты тестами.
- Партиционный уникальный индекс корректно объявлен для Postgres и SQLite.
- Email-уведомления шлются после `session.commit()`, ошибки отправки не роллбэкают состояние.
- Прямых записей в таблицы identity вне двух задокументированных исключений не найдено.

## Проверка после правок

- Backend: `pytest` (весь набор, включая 4 новых теста на withdraw + 1 на исключение MODERATOR из самозапроса) — зелёный.
- Frontend: `npx tsc --noEmit` — чисто; `npm run lint` — без новых ошибок (один предсуществующий `react-hooks/set-state-in-effect` в `app/verify-email/page.tsx`, не в объёме этой правки).
- Две новые миграции (`20260919_admin_role_and_cleanup.py`) не прогонялись на реальном Postgres в этой сессии — прогоните `alembic upgrade head` на реальной БД перед деплоем.

# Подтверждение ролей (инструктор/организатор/судья/модератор) — проект

2026-09-15. Вторая часть инициативы, упомянутой в
`2026-09-14-email-verification-design.md`: «роль «организатор» с
одобрением — отдельная спека, ляжет на ту же email-инфраструктуру». Заодно
закрывает более общий вопрос — единственная роль, которую сейчас выдаёт
система, это `USER` при регистрации (`AuthService.register_user`); для
`INSTRUCTOR`/`ORGANIZER`/`JUDGE` нет вообще никакого способа их получить,
а отдельной админки в проекте не будет и не планируется.

## Задача

Ввести самообслуживаемый флоу «заявка → подтверждение» для ролей
`INSTRUCTOR`, `ORGANIZER`, `JUDGE`, а также для новой служебной роли
`MODERATOR`, которая и подтверждает остальные — без отдельного
admin-приложения: видимость и права определяются существующей моделью
`Role`/`Permission`/`RolePermission` (сейчас не используется) и обычными
permission-проверками на маршрутах того же Next.js-фронтенда.

## Границы модуля и осознанное исключение из «Identity module must not be modified»

`role_requests` — новый домен (`app/modules/role_requests/`), владеет
только таблицей заявок. Он **не** пишет в таблицы `identity`
(`users`/`roles`/`user_roles`) напрямую — по тому же правилу 5 из
`docs/clubs-domain.md`, которое уже один раз осознанно нарушалось для
`email_verified_at` (см. `2026-09-14-email-verification-design.md`).

Второе осознанное исключение — по той же логике: выдача роли (создание
строки в `user_roles`) физически может делать только identity-слой.
Добавляется:

* `AuthService.assign_role(session, user_id, role_code) -> None` в
  `app/modules/identity/services/auth_service.py` — ищет `Role` по `code`,
  создаёт `UserRole`, если такой связки ещё нет (идемпотентно). Роли
  (`INSTRUCTOR`/`ORGANIZER`/`JUDGE`/`MODERATOR`/`USER`) — фиксированный
  набор, заводится миграцией Alembic, а не создаётся на лету.
* `assign_role` в `app/core/identity_access.py` — тонкая write-обёртка
  поверх `AuthService.assign_role`, по образцу того, как
  `AuthService.verify_email` уже документирован как исключение из
  «ничего здесь не пишет в таблицы identity». Модуль обновляет свой
  докстринг, перечисляя оба исключения.

`docs/clubs-domain.md` (пункт 5) и раздел `CLAUDE.md` про identity
обновляются в этом же PR, чтобы явно называть оба исключения — не
оставлять документы молчаливо неточными.

## Данные

Миграция Alembic добавляет:

* Таблицу `roles`, если ролей `INSTRUCTOR`/`ORGANIZER`/`JUDGE`/`MODERATOR`
  там ещё нет (`USER` уже создаётся лениво в `AuthService.register_user`;
  этой миграцией она тоже заводится явно, чтобы все пять кодов были
  сидированы одним местом).
* Permission `role_requests.review` и связь `role_permissions` к роли
  `MODERATOR`.
* Одноразовый data-скрипт (в той же или отдельной ревизии) выдаёт роль
  `MODERATOR` пользователю с email `leokibutca@gmail.com` — единственный
  ручной bootstrap. Дальше новые модераторы заводятся через тот же
  request/approve флоу (заявка на роль `MODERATOR`, подтверждают
  действующие модераторы).
* Новую таблицу `role_requests` (в модуле `role_requests`):
  * `id`, `user_id` (FK `users.id`), `role_code`
    (`INSTRUCTOR`/`ORGANIZER`/`JUDGE`/`MODERATOR`),
  * `status` (`PENDING`/`APPROVED`/`REJECTED`),
  * `justification: str` — обоснование, которое пишет заявитель,
  * `reviewed_by: UUID | None` (FK `users.id`), `reviewed_at: datetime | None`,
  * `rejection_reason_code: str | None`
    (`INSUFFICIENT_EVIDENCE`/`NOT_RECOGNIZED`/`DUPLICATE_REQUEST`/`OTHER`),
  * `rejection_reason_text: str | None` — обязателен, если код `OTHER`,
  * `created_at`, `updated_at`.
  * Частичный уникальный индекс `(user_id, role_code)` где
    `status = 'PENDING'` — не более одной висящей заявки на одну роль у
    одного пользователя одновременно; на разные роли — можно параллельно.

Заявки не перезаписываются задним числом: решённая (`APPROVED`/`REJECTED`)
запись остаётся как есть навсегда (история решений), повторная попытка
после отказа — это **новая** строка `role_requests`, а не переоткрытие
старой.

## Поток

1. `POST /api/v1/role-requests {role_code, justification}` — любой
   авторизованный пользователь. 400, если роль не из допустимого набора,
   или у пользователя эта роль уже есть, или уже есть его собственная
   `PENDING`-заявка на эту же роль. Создаёт `PENDING`, коммитит, затем шлёт
   письмо (`EmailService`) всем пользователям с ролью `MODERATOR` — отказ
   отправки не должен ронять создание заявки, только логируется (тот же
   принцип, что и у письма верификации).
2. `GET /api/v1/role-requests/me` — список заявок текущего пользователя со
   статусами и причиной отказа (без permission-проверки — это его
   собственные данные).
3. `GET /api/v1/role-requests?status=PENDING` — список для ревью, только
   с `role_requests.review` (через `has_permission` из
   `identity_access.py`); 403 иначе. Пагинация как в остальных read-роутах.
4. `PATCH /api/v1/role-requests/{id} {status, reason_code?, reason_text?}`
   — только с `role_requests.review`. `status` — `APPROVED` или
   `REJECTED` (заявитель не может патчить сам себя, `reviewed_by` всегда
   отличен от `user_id`, проверка на бэке).
   * 409, если заявка уже не `PENDING` (решения неизменяемы, без
     `PUT`-коррекции в духе `MATCH_UPDATED` — здесь это не historical
     correction, а разовое действие).
   * `APPROVED`: `reviewed_by/at` проставляются, вызывается
     `identity_access.assign_role(session, request.user_id, request.role_code)`,
     письмо заявителю об одобрении.
   * `REJECTED`: `reason_code` обязателен (400 без него), `reason_text`
     обязателен при `reason_code == "OTHER"`; письмо заявителю с текстом
     причины (готовая формулировка для остальных кодов, введённый текст
     для `OTHER`).

## Письма (переиспользуют `app/core/email.py`)

Три новых метода на `EmailService`, тот же паттерн, что
`send_verification_email` (dev без `resend_api_key` — только лог, не
сетевой вызов):

* `send_role_request_submitted(to, role_code, applicant_name)` — всем
  модераторам при создании заявки.
* `send_role_request_approved(to, role_code)` — заявителю.
* `send_role_request_rejected(to, role_code, reason_text)` — заявителю.

Список адресов модераторов — новый read-helper в `identity_access.py`,
`get_emails_with_role_code(session, role_code) -> list[str]`, тот же
уровень, что уже есть `get_role_codes`.

## Фронтенд (отдельный шаг после бэкенда — не смешиваем в одной задаче)

* `/profile`: блок «Заявки на роль» — форма подачи (`role_code` select +
  `justification` textarea) и список собственных заявок со статусами/
  причиной отказа.
* `/moderation/role-requests`: список `PENDING`-заявок, действия
  «одобрить»/«отклонить» (select причины + textarea при «другое»).
  Пункт меню виден, только если `MODERATOR` есть в ролях из `/users/me`;
  это чисто UX-скрытие — реальная защита на бэке через `role_requests.review`
  (страница явно обрабатывает 403 от API редиректом, а не полагается
  только на скрытие пункта меню).

## Тестирование

* Бэкенд: `backend/tests/test_role_requests_api.py`, по образцу
  `test_email_verification_api.py` (`sqlite+aiosqlite` в памяти,
  `EmailService` подменяется — никаких настоящих сетевых вызовов).
  Сценарии: заявка создаётся и шлёт письмо модераторам → повторная заявка
  на ту же роль, пока первая `PENDING`, даёт 400 → заявка на роль, которая
  уже есть у юзера, даёт 400 → одобрение реально создаёт `UserRole` и
  письмо заявителю → отказ без `reason_code` даёт 400 → отказ с `OTHER` без
  `reason_text` даёт 400 → повторный `PATCH` уже решённой заявки даёт 409 →
  список/`PATCH` без `role_requests.review` даёт 403 → `GET /me` отдаёт
  только заявки текущего пользователя.
* Фронтенд: автотестов в проекте нет — обе страницы проверяются вручную
  через dev-сервер (подача, одобрение, отказ с обеими формами причины,
  скрытие пункта меню без роли `MODERATOR`, 403 при прямом заходе на URL).

## Не входит в эту задачу

* Клубная привязка ролей (`ORGANIZER`/`INSTRUCTOR` конкретного клуба) —
  сейчас роль выдаётся платформенно, без привязки к клубу; если понадобится
  scoping, это отдельная спека поверх этой модели.
* Отзыв/понижение уже выданной роли — вне рамок (сейчас только выдача).
* Реальная верификация документов/сертификатов — подтверждение построено
  на доверии к обоснованию (`justification`) и решению модератора, не на
  загрузке файлов.

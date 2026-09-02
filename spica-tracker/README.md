# Спика — трекер задач бухгалтерской фирмы

Веб-приложение (кабинет сотрудника) для отслеживания задач в бухгалтерской фирме «Спика»: канбан-доска, календарный план (грид «клиент × даты»), авторизация по ролям, live-синхронизация задач между кабинетами.

## Стек

- Next.js 16 (App Router, Turbopack) + React 19 + TypeScript
- Tailwind CSS 4
- Prisma 6 + SQLite
- JWT (jsonwebtoken) + bcryptjs
- dnd-kit (перетаскивание карточек)

## Запуск

```bash
npm install
npm run db:seed        # создание БД и тестовых данных (при первом запуске)
npm run dev            # http://localhost:3000
```

### Важно про Prisma

В проекте используется **Prisma 6.19.3** (не 7/8). После изменения `prisma/schema.prisma`:

```bash
npx prisma db push     # применить схему к dev.db
npx prisma generate    # перегенерировать клиент
```

`npx` в Windows PowerShell может блокироваться политикой выполнения — используйте `npx.cmd` или `cmd /c "npx ..."`.

## Переменные окружения (`.env`)

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="<секрет для подписи токенов>"
```

## Тестовые учётки

Пароль у всех: `password123`

| Email | Роль |
|-------|------|
| `admin@spica.ru` | Руководитель (ADMIN) |
| `salary@spica.ru` | Исполнитель, ЗП (EXECUTOR, SALARY) |
| `tax@spica.ru` | Исполнитель, Налоги (EXECUTOR, TAX) |
| `client@alfa.ru` | Клиент (CLIENT) |

## Роли и видимость задач

- **ADMIN/EXECUTOR** — видят все задачи; при создании могут указать тип, срок, срочность, сумму налога и дату уплаты.
- **CLIENT** — видит только задачи своей компании, где он создатель ИЛИ статус `SENT_TO_CLIENT`; внутренние задачи сотрудников ему скрыты. Может создавать задачи (тип, срок), сумма налога недоступна.

## Функциональность

- Канбан-доска: колонки Новые / В работе / На доработке / Отправлено клиенту / Выполнено / Просрочено, drag-and-drop смены статуса.
- Календарный план: грид «клиент × даты» по налоговым и зарплатным датам задач.
- Авто-распределение задач по `AssignmentRule` (иначе — на primary-исполнителя клиента).
- Live-обновление задач между кабинетами (polling ~10 сек): новая задача появляется вверху колонки у других сотрудников.
- Значок срочности (флаг «Срочно» или просрочка) и «Отв. — инициалы» на карточке.
- Комментарии к задачам и уведомление клиента (`isClientNotified`).

## Структура

```
prisma/
  schema.prisma    # модели User, Client, AssignmentRule, Task, Comment, Document
  seed.ts          # тестовые данные
src/
  proxy.ts         # защита маршрутов /dashboard (бывший middleware)
  lib/             # auth (JWT-сессия), prisma (singleton), task-meta (статусы/типы)
  app/
    api/           # auth (login/logout/me), tasks (GET/POST, PATCH, comments), calendar
    dashboard/     # доска (KanbanBoard, TaskCard), календарь (CalendarPlan), форма задачи
    login/         # страница входа
```

# Правила работы с проектом Spica Tracker

## Важная информация о хостинге

Этот проект **полностью перенесен с платформы Railway на собственный VPS-сервер у хостинг-провайдера Beget**.

### Актуальный контекст проекта:

1. **Хостинг:** Beget VPS (Ubuntu). Доступ по SSH: `root@159.194.243.225`.
2. **Домен:** Основной рабочий адрес теперь `https://www.aistudiazv.ru` (настроен Nginx как reverse proxy на порт 3000 + бесплатный SSL от Let's Encrypt).
3. **Стек и запуск:** Приложение работает через Docker Compose (`docker compose up -d`). Next.js запущен в режиме `standalone`, база данных — PostgreSQL 17 в отдельном контейнере.
4. **База данных:** Все данные уже успешно мигрированы из старой базы Railway в новую на Beget.
5. **Рабочая директория на сервере:** `/opt/tracker/spica-tracker`

### Строгие правила для всех ответов:

- Все команды для деплоя, настройки сервера, работы с базой данных или перезапуска приложения должны быть адаптированы **исключительно для среды Ubuntu на Beget с использованием Docker Compose и SSH**.
- **Категорически не предлагай решения, команды или упоминания Railway, Vercel, Heroku или других облачных PaaS**.
- При работе с базой данных используй только локальные команды внутри контейнера или через `docker compose exec`.
- Для перезапуска приложения используй `docker compose up -d --build` (для пересборки) или `docker compose restart` (для быстрого перезапуска).
- Для работы с Prisma используй `docker compose exec app npx prisma [команда]`.
- Nginx настроен как reverse proxy и автоматически перенаправляет трафик с домена на порт 3000.
- SSL-сертификат от Let's Encrypt настроен и автоматически обновляется через Certbot.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Ezda

**Ezda** — веб-приложение для планирования, сохранения и обмена маршрутами для велосипедных поездок.

Главная идея: пользователь открывает карту, выбирает начальную и конечную точки, получает велосипедный маршрут, сохраняет его и может поделиться им с другими людьми.

## Цели продукта

Ezda должен объединить в одном месте:
- построение велосипедных маршрутов;
- анализ расстояния, времени и набора высоты;
- сохранение маршрутов;
- публикацию и обмен маршрутами;
- поиск готовых маршрутов других пользователей;
- в перспективе — социальное сообщество велосипедистов и фактические поездки с GPS.

**Ключевая концепция:** карта — основа интерфейса, но продуктом являются маршруты и сообщество вокруг них.

## Основной пользовательский сценарий

**Открыл → построил → сохранил → поделился → другой человек открыл.**

Пользователь должен иметь возможность:
1. открыть интерактивную карту;
2. выбрать старт и финиш;
3. построить велосипедный маршрут;
4. увидеть расстояние, время и набор высоты;
5. сохранить маршрут с названием и описанием;
6. получить публичную страницу и ссылку;
7. открыть чужой маршрут и использовать его как основу для своей поездки.

## MVP

Первая версия должна включать:
- интерактивную карту;
- выбор стартовой и конечной точки;
- построение велосипедного маршрута;
- расстояние;
- время поездки;
- набор высоты;
- сохранение маршрута;
- публичную страницу маршрута;
- уникальную ссылку;
- список публичных маршрутов.

### Что будет развиваться дальше

**Маршруты**
- промежуточные точки;
- редактирование;
- копирование чужого маршрута;
- поиск и фильтры;
- фотографии и точки интереса.

**Сообщество**
- профили пользователей;
- подписки;
- лайки;
- комментарии;
- сохранение чужих маршрутов.

**Поездки**
- разделение планируемого `Route` и фактической `Ride`;
- GPS-трекинг;
- фактическая скорость и время;
- остановки;
- история поездок;
- сравнение планового и фактического маршрута.

## Техническая архитектура

Предполагаемый стек:
- **Next.js + React + TypeScript** — веб-приложение;
- **MapLibre GL JS** — интерактивная карта;
- **OpenRouteService / GraphHopper / Valhalla** — построение маршрутов;
- **PostgreSQL + PostGIS** — пользователи и геоданные;
- **Drizzle ORM** — работа с БД;
- **GeoJSON** — геометрия маршрутов;
- **Docker** — локальная инфраструктура;
- **Vercel** — возможное размещение в production.

## Текущий MVP

Сейчас в репозитории реализованы:
- Next.js-приложение;
- MapLibre-карта;
- выбор двух точек на карте;
- API построения маршрута;
- OpenRouteService как основной routing provider;
- прямолинейный fallback без ORS API key;
- PostgreSQL/PostGIS через Docker Compose;
- базовая схема маршрутов в Drizzle.

## Локальный запуск

### Docker

Требуется Docker Desktop.

```bash
cp .env.example .env
docker compose up --build
```

После запуска открыть http://localhost:3000.

SQL-миграции применяются автоматически: сервис `migrate` дожидается готовности PostgreSQL и выполняет `npm run db:migrate` — как для чистой volume, так и для уже существующей.

Если `ORS_API_KEY` пустой, приложение использует прямолинейный fallback. Для реального велосипедного маршрута по дорогам добавьте ключ OpenRouteService в `.env`.

### Без Docker

Для frontend-разработки:

```bash
npm install
npm run dev
```

После запуска открыть http://localhost:3000.

Для функций, использующих PostgreSQL, необходимо отдельно запустить PostgreSQL/PostGIS и указать `DATABASE_URL` в `.env`.

## Принцип развития

Ezda должен развиваться от простого планировщика маршрутов в платформу, где велосипедисты **создают, находят, сохраняют и делятся маршрутами**.

При реализации новых функций приоритетом остаётся основной пользовательский сценарий MVP, простота интерфейса и возможность дальнейшего масштабирования архитектуры.


## Supabase + Vercel production database

Ezda uses PostgreSQL/PostGIS through Drizzle. Supabase provides the production PostgreSQL database; Vercel runs the Next.js application.

### Database connection

For Vercel/serverless runtime, set `DATABASE_URL` to the **Supabase Transaction Pooler** connection string from the Supabase Connect panel. The application configures Postgres.js with a single connection and `prepare: false`, which is required for Supabase transaction pooling. Supabase recommends transaction pooling for serverless workloads. 

For local Docker development, keep:

```text
DATABASE_URL=postgres://ezda:ezda@localhost:5432/ezda
```

### PostGIS

Migrations in `supabase/migrations/` are the single source of truth for the database schema:

- `20260922150000_ensure_postgis_gis_schema.sql` ensures PostGIS lives in the dedicated `gis` schema, reinstalling a copy preinstalled into `public` by the `postgis/postgis` Docker image (PostGIS is not relocatable);
- `20260922160000_initial_routes.sql` creates `public.routes`, stores route geometry as `gis.geography(LineString, 4326)`, creates a GiST spatial index, and converts the previous MVP `routes.geometry` GeoJSON text column when upgrading an existing database.

Applied files are recorded in `public.schema_migrations`. Do not edit a migration after it has been applied — add a new file instead. `lib/db/schema.ts` describes the same schema for the application runtime; files generated by `npm run db:generate` under `drizzle/` are not applied.

Apply pending migrations to any `DATABASE_URL` and verify the schema:

```bash
npm run db:migrate
node scripts/verify-migrations.mjs
```

Docker Compose runs these migrations automatically once the database is healthy. The Supabase CLI (`supabase db push`) remains an optional alternative if it is installed.

Do not put a Supabase service-role key or database password in client-side code or `NEXT_PUBLIC_*` variables.

### Vercel environment variables

Configure these in Vercel Project Settings → Environment Variables:

```text
DATABASE_URL=<Supabase Transaction Pooler URI>
ORS_API_KEY=<OpenRouteService key>
```

Use the database URL in Production and Preview as appropriate for the corresponding Supabase database. After changing environment variables, redeploy the Vercel project.

No `NEXT_PUBLIC_SUPABASE_*` variables are required yet because Ezda currently talks to Supabase through server-side PostgreSQL/Drizzle rather than the browser Data API.

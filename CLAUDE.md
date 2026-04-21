# CLAUDE.md

Сервис объявлений о продаже земельных участков: каталог, поиск, карта,
аналитика скоров (инфраструктура, фичи, цена).

## Структура

```
app/
  backend/            FastAPI + Motor (async MongoDB)
    main.py           lifespan: connect → ensure_indexes → seed_admin
    config.py         env, коллекции, фичи, веса, JWT
    database.py       connect/disconnect, get_db, ensure_indexes, фабрики репо
    auth.py           PBKDF2-SHA256, JWT, require_admin/require_user
    models.py         Pydantic-модели для роутов
    utils.py          общие хелперы (serialize_doc_deep, parse_area)
    repositories/     тонкий слой доступа к коллекциям
      plot_repository.py    CRUD + поиск по plots
      infra_repository.py   CRUD + $geoNear по infra_objects
      user_repository.py    CRUD по users
    services/
      geo_service.py        compute_distances, recalculate_all_scores
      feature_service.py    извлечение фич (embeddings)
      listing_service.py    формирование карточек
      search_service.py     BM25 + Jina rerank, инвалидация кеша
    routes/
      auth.py               /api/auth/*
      users.py              /api/users/*
      plots.py              /api/plots/*
      infrastructure.py     /api/infra/*
      data_io.py            /api/data/{export,import,stats,clear}
  frontend/           React + Vite + TypeScript + Tailwind
    src/pages/        PlotsList, PlotDetail, PlotsMap, AddPlot, EditPlot,
                      ComparePlots, MyPlots, AdminPanel, LoginPage
    src/features/     plots (queries/mutations), forms (zod schemas)
    src/api.ts        HTTP-клиент к backend
  docs/
    data_model.md     каноническое описание схемы БД и запросов
    use_cases.puml    UC1–UC11
  data/               seed-данные (plots, infrastructure)
hello_world/          заготовка (не трогать для продукт. работы)
```

## Модель данных

Каноническое описание: `app/docs/data_model.md`. Три коллекции MongoDB:

- **plots** — объявления. Индексы: `geo_location` 2dsphere, `avito_id`
  unique sparse, `price`, `area_sotki`, `total_score`.
- **users** — пользователи (PBKDF2-SHA256). Индекс: `username` unique.
- **infra_objects** — единая коллекция инфраструктуры. Поле `type` ∈
  {`metro_station`, `hospital`, `school`, `kindergarten`, `store`,
  `pickup_point`, `bus_stop`, `negative`}, `subtype` только для
  `type="negative"`. Индексы: `location` 2dsphere, `(type, name)`,
  `subtype`.

Расстояния до инфраструктуры **не** хранятся в `plots` — считаются
одним `$geoNear` с `$group by type` при запросе карточки или
создании/обновлении участка.

## Частые команды

```bash
# Запуск всего стека
cd app && docker-compose up --build

# Backend standalone (нужен Mongo)
cd app/backend && pip install -r requirements.txt && uvicorn main:app --reload

# Frontend standalone
cd app/frontend && npm install && npm run dev
```

## Важные инварианты

- `plots.geo_location`, `infra_objects.location` — GeoJSON Point
  `{type:"Point", coordinates:[lon, lat]}` (lon первый).
- `owner_id` в `plots` — строковый ObjectId пользователя либо `null`.
- Скоры в `plots` (`infra_score`, `negative_score`, `total_score`)
  пересчитываются фоном после изменений в `infra_objects`.
- `features` — фиксированные 15 ключей из `config.FEATURE_DEFINITIONS`.

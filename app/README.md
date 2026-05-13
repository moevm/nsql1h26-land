# Land Plots — сервис объявлений о продаже земельных участков

Веб-приложение для публикации, поиска и аналитики объявлений о земельных
участках с учётом окружающей инфраструктуры. Backend на FastAPI + Motor
(async MongoDB), frontend на React 19 + Vite + TypeScript + TailwindCSS.

## Что реализовано

- **Каталог и карточки участков**: список с фильтрами (цена, площадь,
  скор), детальная страница, история цен, избранное, сравнение участков,
  раздел «Мои объявления».
- **Карта** (react-leaflet с кластеризацией): участки на карте,
  ограничение по bounds, переход к карточке.
- **Поиск**: гибридный BM25 (русская токенизация) + rerank через Jina
  Embeddings / Reranker API, кеширование результатов.
- **Скоринг**: `total_score` считается из инфраструктурного,
  негативного, фичевого скоров и ценового фактора с настраиваемыми
  весами. Расстояния до объектов берутся одним `$geoNear` по коллекции
  `infra_objects`.
- **Фичи участка**: 15 фиксированных признаков (газ, электричество,
  ИЖС/СНТ, лес, дорога и т.д.), извлекаются через embeddings.
- **Аутентификация**: PBKDF2-SHA256 + JWT, роли `admin` / `user`,
  автосоздание admin/admin и user/user при старте.
- **Админка**: управление пользователями, инфраструктурой
  (метро, школы, больницы, магазины, негативные объекты), импорт/экспорт
  данных, фоновый пересчёт скоров после изменений.
- **CRUD объявлений**: создание, редактирование, удаление, привязка к
  владельцу.

## Запуск

Полный стек через Docker (рекомендуется):

```bash
cd app
cp .env.example .env   # при необходимости отредактировать JINA_API_KEY, JWT_SECRET
cd ..
docker-compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000 (docs: `/docs`)
- Mongo Express: http://localhost:8081
- MongoDB: `localhost:27017`

Также созданы тестовые пользователи:

# 1)админ

  логин : admin
  пароль: admin
  
# 2)обычный пользователь

  логин: user
  пароль: user

Локальный запуск без Docker (нужен запущенный MongoDB):

```bash
# Backend
cd app/backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
export MONGODB_URI="mongodb://localhost:27017"
export JINA_API_KEY="your-key"
uvicorn main:app --reload

# Frontend (в отдельном терминале)
cd app/frontend
npm install
npm run dev
```

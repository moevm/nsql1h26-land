# Land Plots Service

Сервис для просмотра, поиска и аналитики объявлений земельных участков.

## Функционал

1. **Просмотр объявлений** — список с пагинацией и сортировкой (цена, площадь, score, дата)
2. **Детальная страница** — информация + аналитика (скоры, расстояния до инфраструктуры, характеристики)
3. **Удаление объявлений**
4. **Добавление объявлений** — при добавлении автоматически:
   - Вычисляются текстовые фичи через sentence-transformers (has_gas, has_electricity, ...)
   - Рассчитываются расстояния до объектов инфраструктуры через MongoDB geo-запросы
   - Генерируется эмбеддинг для HNSW vector search
5. **Поиск** — текстовый запрос → эмбеддинг → MongoDB Atlas $vectorSearch (top 100) → Jina Reranker
6. **Импорт/Экспорт** — полная выгрузка/загрузка данных через веб-интерфейс

## Стек

- **Backend**: Python, FastAPI, Motor (async MongoDB)
- **Frontend**: React, TypeScript, Vite, TailwindCSS
- **БД**: MongoDB (Atlas для vector search HNSW)
- **ML**: sentence-transformers (paraphrase-multilingual-MiniLM-L12-v2)
- **Reranking**: Jina Reranker API

## MongoDB коллекции

| Коллекция | Описание | Индексы |
|-----------|----------|---------|
| `plots` | Объявления участков | 2dsphere, avito_id unique, HNSW vector |
| `metro_stations` | Станции метро | 2dsphere |
| `hospitals` | Больницы | 2dsphere |
| `schools` | Школы | 2dsphere |
| `kindergartens` | Детские сады | 2dsphere |
| `stores` | Магазины | 2dsphere |
| `pickup_points` | Пункты выдачи | 2dsphere |
| `bus_stops` | Автобусные остановки | 2dsphere |
| `negative_objects` | Негативные объекты (промзоны, тюрьмы, свалки) | 2dsphere |

## Запуск

```bash
cd app

# Скопировать .env
cp .env.example .env
# Заполнить JINA_API_KEY (опционально)

# Запуск через Docker Compose
docker-compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

## MongoDB Atlas Vector Search

Для работы HNSW vector search необходимо создать search-индекс в Atlas:

1. Перейти в Atlas → Database → Search → Create Search Index
2. Выбрать JSON Editor и вставить:

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 384,
      "similarity": "cosine"
    }
  ]
}
```

3. Имя индекса: `vector_index`, коллекция: `plots`

При отсутствии Atlas автоматически используется фолбэк — вычисление cosine similarity в Python.

## API эндпоинты

### Объявления
- `GET /api/plots?page=1&page_size=20&sort=price&order=desc` — список
- `GET /api/plots/{id}` — одно объявление с аналитикой
- `POST /api/plots` — добавить (авто-расчёт фич и расстояний)
- `DELETE /api/plots/{id}` — удалить
- `GET /api/plots/search?q=текст&top_n=20` — поиск

### Инфраструктура
- `GET /api/infra/collections` — список коллекций
- `GET /api/infra/{collection}` — объекты коллекции
- `POST /api/infra/{collection}` — добавить объект
- `PUT /api/infra/{collection}` — перезаписать коллекцию
- `DELETE /api/infra/{collection}/{id}` — удалить объект

### Данные
- `GET /api/data/export` — экспорт всех коллекций
- `GET /api/data/export/{collection}` — экспорт одной коллекции
- `POST /api/data/import/plots` — импорт объявлений
- `POST /api/data/import/infra/{collection}` — импорт инфраструктуры
- `DELETE /api/data/clear/{collection}` — очистить коллекцию
- `GET /api/data/stats` — статистика

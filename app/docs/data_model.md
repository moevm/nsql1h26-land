# Модель данных

## Нереляционная модель

### ссылка на папку с картинками, там лучше качество
https://drive.google.com/drive/folders/1QLcHLlxI4P24EhOHe_re_kR7_CDStTa1?hl=ru

### JSON-схема коллекции `plots`

```json
{
  "$jsonSchema": {
    "bsonType": "object",
    "required": ["title", "lat", "lon"],
    "properties": {
      "_id":             { "bsonType": "objectId" },
      "avito_id":        { "bsonType": "long" },
      "title":           { "bsonType": "string", "maxLength": 100 },
      "description":     { "bsonType": "string", "maxLength": 8000 },
      "price":           { "bsonType": "double" },
      "area_sotki":      { "bsonType": "double" },
      "price_per_sotka": { "bsonType": "double" },
      "location":        { "bsonType": "string", "maxLength": 50 },
      "address":         { "bsonType": "string", "maxLength": 250 },
      "geo_ref":         { "bsonType": "string", "maxLength": 150 },
      "lat":             { "bsonType": "double" },
      "lon":             { "bsonType": "double" },
      "geo_location": {
        "bsonType": "object",
        "properties": {
          "type":        { "bsonType": "string", "enum": ["Point"] },
          "coordinates": { "bsonType": "array", "items": { "bsonType": "double" }, "minItems": 2, "maxItems": 2 }
        }
      },
      "url":             { "bsonType": "string", "maxLength": 200 },
      "thumbnail":       { "bsonType": "string", "maxLength": 300 },
      "images_count":    { "bsonType": "int" },
      "was_lowered":     { "bsonType": "bool" },
      "features": {
        "bsonType": "object",
        "properties": {
          "has_gas":            { "bsonType": "double" },
          "has_electricity":    { "bsonType": "double" },
          "has_water":          { "bsonType": "double" },
          "has_sewage":         { "bsonType": "double" },
          "has_house":          { "bsonType": "double" },
          "is_izhs":            { "bsonType": "double" },
          "is_snt":             { "bsonType": "double" },
          "is_quiet":           { "bsonType": "double" },
          "has_forest":         { "bsonType": "double" },
          "near_river":         { "bsonType": "double" },
          "has_road":           { "bsonType": "double" },
          "has_fence":          { "bsonType": "double" },
          "flat_terrain":       { "bsonType": "double" },
          "has_communications": { "bsonType": "double" },
          "documents_ready":    { "bsonType": "double" }
        }
      },
      "feature_score":   { "bsonType": "double" },
      "features_text":   { "bsonType": "string", "maxLength": 500 },
      "distances": {
        "bsonType": "object",
        "properties": {
          "nearest_metro":        { "bsonType": "object", "properties": { "name": {"bsonType":"string"}, "km": {"bsonType":"double"} } },
          "nearest_hospital":     { "bsonType": "object", "properties": { "name": {"bsonType":"string"}, "km": {"bsonType":"double"} } },
          "nearest_school":       { "bsonType": "object", "properties": { "name": {"bsonType":"string"}, "km": {"bsonType":"double"} } },
          "nearest_kindergarten": { "bsonType": "object", "properties": { "name": {"bsonType":"string"}, "km": {"bsonType":"double"} } },
          "nearest_store":        { "bsonType": "object", "properties": { "name": {"bsonType":"string"}, "km": {"bsonType":"double"} } },
          "nearest_pickup_point": { "bsonType": "object", "properties": { "name": {"bsonType":"string"}, "km": {"bsonType":"double"} } },
          "nearest_bus_stop":     { "bsonType": "object", "properties": { "name": {"bsonType":"string"}, "km": {"bsonType":"double"} } },
          "nearest_negative":     { "bsonType": "object", "properties": { "name": {"bsonType":"string"}, "km": {"bsonType":"double"} } }
        }
      },
      "infra_score":     { "bsonType": "double" },
      "negative_score":  { "bsonType": "double" },
      "total_score":     { "bsonType": "double" },
      "created_at":      { "bsonType": "date" },
      "updated_at":      { "bsonType": "date" },
      "owner_id":        { "bsonType": "string" },
      "owner_name":      { "bsonType": "string" }
    }
  }
}
```

### JSON-схема коллекции `users`

```json
{
  "$jsonSchema": {
    "bsonType": "object",
    "required": ["username", "password_hash", "salt", "role"],
    "properties": {
      "_id":           { "bsonType": "objectId" },
      "username":      { "bsonType": "string", "maxLength": 50 },
      "password_hash": { "bsonType": "string", "minLength": 64, "maxLength": 128 },
      "salt":          { "bsonType": "string", "minLength": 64, "maxLength": 128 },
      "role":          { "bsonType": "string", "enum": ["user", "admin"] },
      "created_at":    { "bsonType": "date" }
    }
  }
}
```

### JSON-схема инфраструктурных коллекций (7 шт.)

Общая схема для `metro_stations`, `hospitals`, `schools`, `kindergartens`, `stores`, `pickup_points`, `bus_stops`.

```json
{
  "$jsonSchema": {
    "bsonType": "object",
    "required": ["name", "location"],
    "properties": {
      "_id":  { "bsonType": "objectId" },
      "name": { "bsonType": "string", "maxLength": 80 },
      "location": {
        "bsonType": "object",
        "required": ["type", "coordinates"],
        "properties": {
          "type":        { "bsonType": "string", "enum": ["Point"] },
          "coordinates": {
            "bsonType": "array",
            "items": { "bsonType": "double" },
            "minItems": 2,
            "maxItems": 2,
            "description": "[longitude, latitude]"
          }
        }
      }
    }
  }
}
```

### JSON-схема коллекции `negative_objects`

```json
{
  "$jsonSchema": {
    "bsonType": "object",
    "required": ["name", "type", "location"],
    "properties": {
      "_id":  { "bsonType": "objectId" },
      "name": { "bsonType": "string", "maxLength": 80 },
      "type": { "bsonType": "string", "enum": ["landfill", "industrial", "highway", "sewage_plant", "prison", "power_plant"] },
      "location": {
        "bsonType": "object",
        "required": ["type", "coordinates"],
        "properties": {
          "type":        { "bsonType": "string", "enum": ["Point"] },
          "coordinates": {
            "bsonType": "array",
            "items": { "bsonType": "double" },
            "minItems": 2,
            "maxItems": 2,
            "description": "[longitude, latitude]"
          }
        }
      }
    }
  }
}
```

---

## Описание назначений коллекций, типов данных и сущностей

### Коллекция `plots` — объявления о продаже земельных участков

Каждый документ является одним объявлением с аналитикой.

| Поле | BSON-тип | Среднее (байт) | Макс (байт) | Назначение |
|------|----------|-----:|-----:|-----------|
| `_id` | ObjectId | 12 | 12 | Уникальный идентификатор MongoDB |
| `avito_id` | Int64 | 8 | 8 | ID объявления на Авито (unique sparse) |
| `title` | String | 30 | 57 | Заголовок объявления |
| `description` | String | 1 068 | 6 310 | Полное текстовое описание |
| `price` | Double | 8 | 8 | Цена (₽) |
| `area_sotki` | Double | 8 | 8 | Площадь (сотки) |
| `price_per_sotka` | Double | 8 | 8 | Расчётная цена за сотку |
| `location` | String | 17 | 21 | Район/город (напр. «Петергоф») |
| `address` | String | 90 | 174 | Полный адрес |
| `geo_ref` | String | 23 | 86 | Гео-описание от пайплайна |
| `lat` | Double | 8 | 8 | Широта |
| `lon` | Double | 8 | 8 | Долгота |
| `geo_location` | Object (GeoJSON) | 58 | 58 | `{type:"Point", coordinates:[lon,lat]}` для 2dsphere |
| `url` | String | 100 | 134 | URL оригинального объявления на Авито |
| `thumbnail` | String | 172 | 233 | URL миниатюры изображения |
| `images_count` | Int32 | 4 | 4 | Количество фотографий |
| `was_lowered` | Boolean | 1 | 1 | Была ли снижена цена |
| `features` | Object (15 полей × Double) | 120 | 120 | Вероятностные оценки 15 текстовых характеристик |
| `feature_score` | Double | 8 | 8 | Взвешенная сумма фич |
| `features_text` | String | 194 | 293 | Человекочитаемая строка найденных характеристик |
| `distances` | Object (8 вложенных) | 480 | 480 | Расстояния до 8 типов ближайших инфра-объектов |
| `infra_score` | Double | 8 | 8 | Общий балл инфраструктуры (0–1) |
| `negative_score` | Double | 8 | 8 | Балл удалённости от негативных объектов (0–1) |
| `total_score` | Double | 8 | 8 | Итоговый балл участка (0–1) |
| `created_at` | DateTime | 8 | 8 | Дата создания записи |
| `updated_at` | DateTime | 8 | 8 | Дата обновления |
| `owner_id` | String | 24 | 24 | ID пользователя-владельца |
| `owner_name` | String | 10 | 55 | Имя пользователя-владельца |

**Индексы:** `geo_location` (2dsphere), `avito_id` (unique sparse), `price`, `area_sotki`, `total_score`.

#### Вложенный объект `features`

15 полей типа Double — вероятностные оценки (0.0–1.0) для каждой текстовой характеристики:

| Ключ | Значение |
|------|----------|
| `has_gas` | Подведён газ |
| `has_electricity` | Электричество |
| `has_water` | Водоснабжение |
| `has_sewage` | Канализация / септик |
| `has_house` | Есть дом / постройки |
| `is_izhs` | Категория ИЖС |
| `is_snt` | СНТ / ДНП |
| `is_quiet` | Тихое место |
| `has_forest` | Лес рядом |
| `near_river` | Водоём рядом |
| `has_road` | Хороший подъезд |
| `has_fence` | Огорожен |
| `flat_terrain` | Ровный участок |
| `has_communications` | Все коммуникации |
| `documents_ready` | Документы готовы |

#### Вложенный объект `distances`

8 вложенных объектов `{name: String, km: Double}`:

| Ключ | Источник (коллекция) |
|------|---------------------|
| `nearest_metro` | `metro_stations` |
| `nearest_hospital` | `hospitals` |
| `nearest_school` | `schools` |
| `nearest_kindergarten` | `kindergartens` |
| `nearest_store` | `stores` |
| `nearest_pickup_point` | `pickup_points` |
| `nearest_bus_stop` | `bus_stops` |
| `nearest_negative` | `negative_objects` |

---

### Коллекция `users` — пользователи

| Поле | BSON-тип | Размер (байт) | Назначение |
|------|----------|-----:|-----------|
| `_id` | ObjectId | 12 | Уникальный идентификатор |
| `username` | String | ~10 | Логин |
| `password_hash` | String | 64 | PBKDF2-SHA256 хеш пароля |
| `salt` | String | 64 | Рандомная соль |
| `role` | String | ~5 | Роль: `"user"` или `"admin"` |
| `created_at` | DateTime | 8 | Дата регистрации |

**Среднее:** ~163 байт / документ  
**Индексы:** `username` (unique).

---

### Инфраструктурные коллекции (7 шт.)

Семь коллекций с **единой схемой** содержат объекты инфраструктуры. Используются при создании / импорте участков для расчёта
`distances` (ближайший объект каждого типа через `$geoNear`).

#### JSON-схема (общая для 7 коллекций)

#### Общая структура полей

| Поле | BSON-тип | Среднее (байт) | Макс (байт) | Назначение |
|------|----------|-----:|-----:|-----------|
| `_id` | ObjectId | 12 | 12 | Уникальный идентификатор MongoDB |
| `name` | String | ~35 | 55 | Название объекта (станция, больница, …) |
| `location` | Object (GeoJSON Point) | 58 | 58 | `{type:"Point", coordinates:[lon,lat]}` для 2dsphere |
| **BSON-оверхед** | — | ~25 | ~30 | Ключи полей, типы, длины строк |
| **Итого** | | **~130** | **~155** | |

**Индексы:** `location` (2dsphere), `name` (B-tree).

##### `metro_stations` — станции метрополитена
##### `hospitals` — больницы и медицинские учреждения
##### `schools` — школы
##### `kindergartens` — детские сады
##### `stores` — продуктовые магазины и супермаркеты
##### `pickup_points` — пункты выдачи заказов
##### `bus_stops` — автобусные остановки

#### Сводная таблица инфра-коллекций

| Коллекция | Кол-во | Средн. `name` (байт) | Средн. документ (байт) | Суммарно (байт) | Роль в `distances` |
|-----------|:------:|:-----:|:------:|:------:|---------------------|
| `metro_stations` | 15 | 30 | 125 | 1 875 | `nearest_metro` |
| `hospitals` | 9 | 48 | 143 | 1 287 | `nearest_hospital` |
| `schools` | 10 | 36 | 131 | 1 310 | `nearest_school` |
| `kindergartens` | 8 | 54 | 149 | 1 192 | `nearest_kindergarten` |
| `stores` | 10 | 40 | 135 | 1 350 | `nearest_store` |
| `pickup_points` | 9 | 44 | 139 | 1 251 | `nearest_pickup_point` |
| `bus_stops` | 12 | 54 | 149 | 1 788 | `nearest_bus_stop` |
| **Итого (7 колл.)** | **73** | — | **~139** | **~10 053** | |

---

### Коллекция `negative_objects` 

Объекты, снижающие привлекательность участка: свалки, промзоны, шумные магистрали,
очистные сооружения, исправительные учреждения, ТЭЦ. Чем дальше ближайший
негативный объект тем выше `negative_score`.

#### Поля

| Поле | BSON-тип | Среднее (байт) | Макс (байт) | Назначение |
|------|----------|-----:|-----:|-----------|
| `_id` | ObjectId | 12 | 12 | Уникальный идентификатор |
| `name` | String | ~35 | 55 | Человекочитаемое название |
| `type` | String | ~12 | 14 | Категория негативного объекта |
| `location` | Object (GeoJSON Point) | 58 | 58 | Координаты для `$geoNear` |
| **BSON-оверхед** | — | ~30 | ~35 | Ключи, типы, длины |
| **Итого** | | **~147** | **~174** | |

**Индексы:** `location` (2dsphere), `name` (B-tree).

#### Классификация по типам

| `type` | Кол-во | Описание | Примеры |
|--------|:------:|----------|---------|
| `landfill` | 3 | Свалки, полигоны ТБО | Новосёлки, Красный Бор, Новый Свет |
| `industrial` | 5 | Промышленные зоны | Обухово, Металлострой, Парнас, Кировский, Шушары |
| `highway` | 2 | Шумные магистрали (КАД) | КАД южный, КАД северный |
| `sewage_plant` | 1 | Очистные сооружения | Очистные Красное Село |
| `prison` | 2 | Исправительные учреждения | ИК-6 Обухово, СИЗО-1 Кресты |
| `power_plant` | 1 | Электростанции / ТЭЦ | ТЭЦ Южная |
| **Итого** | **14** | | |

#### Связь с `plots.distances`

При создании / импорте участка выполняется `$geoNear` к `negative_objects`:

```javascript
db.negative_objects.aggregate([
  { $geoNear: { near: { type: "Point", coordinates: [lon, lat] }, distanceField: "dist_meters", spherical: true } },
  { $limit: 1 },
  { $project: { name: 1, dist_meters: 1 } }
])
```

Результат записывается в `plots.distances.nearest_negative` в `{name, km}`.
Далее из `km` рассчитывается `negative_score` (0–1): чем больше расстояние тем выше балл.

---

## Оценка объёма информации

### Размер одного документа `plots`

Оценим **средний** размер документа `plots` по реальным данным (2174 записи):

| Группа полей | Среднее (байт) | Комментарий |
|-------------|------:|-----------|
| Служебное: `_id`, `avito_id` | 20 | ObjectId + Int64 |
| Текст: `title`, `description`, `location`, `address`, `geo_ref` | 1 228 | UTF-8, среднее по данным |
| Числовые: `price`, `area_sotki`, `price_per_sotka`, `lat`, `lon` | 40 | 5 × Double |
| Гео: `geo_location` | 58 | GeoJSON Point |
| Медиа: `url`, `thumbnail`, `images_count`, `was_lowered` | 277 | |
| Фичи: `features` (15 × Double) + `feature_score` + `features_text` | 322 | 120 + 8 + 194 |
| Расстояния: `distances` (8 × {name, km}) | 480 | ~60 байт × 8 |
| Скоры: `infra_score`, `negative_score`, `total_score` | 24 | 3 × Double |
| Мета: `created_at`, `updated_at`, `owner_id`, `owner_name` | 50 | |
| **BSON-оверхед** (ключи полей, типы, длины) | ~450 | ~30 полей верхнего уровня + вложенные |
| **Итого средний документ** | **~2 949** | |

Обозначим **N** — количество объявлений (plots).

Размер коллекции `plots`:

$$S_{\text{plots}}(N) = 2\,949 \times N \;\text{(байт)} \approx 2.88 \times N \;\text{(КБ)}$$

### Размеры инфра-коллекций

Обозначим число объектов инфраструктуры каждого типа как $I_j$ ($j = 1 \ldots 8$), и суммарное $I = \sum_{j=1}^{8} I_j$.

#### Инфраструктурные коллекции (7 шт.)

Средний размер документа (с BSON-оверхедом) ≈ **139 байт** (от 125 для `metro_stations` до 149 для `kindergartens` / `bus_stops`).

| Коллекция | Кол-во | Средн. документ (байт) | Суммарно (байт) |
|-----------|:------:|:------:|:------:|
| `metro_stations` | 15 | 125 | 1 875 |
| `hospitals` | 9 | 143 | 1 287 |
| `schools` | 10 | 131 | 1 310 |
| `kindergartens` | 8 | 149 | 1 192 |
| `stores` | 10 | 135 | 1 350 |
| `pickup_points` | 9 | 139 | 1 251 |
| `bus_stops` | 12 | 149 | 1 788 |
| **Итого (7 колл.)** | **73** | **~139** | **~10 053** |

#### Коллекция `negative_objects`

Средний размер документа ≈ **147 байт** (дополнительное поле `type`).

| Коллекция | Кол-во | Средн. документ (байт) | Суммарно (байт) |
|-----------|:------:|:------:|:------:|
| `negative_objects` | 14 | 147 | 2 058 |

#### Общий объём инфраструктуры

$$S_{\text{infra}}(I) \approx 140 \times I \;\text{(байт)}$$

Текущие количества: $I = 73 + 14 = 87$ объектов → **~12 111 байт (~11.8 КБ)**.

### Размер коллекции `users`

Обозначим $U$ — количество пользователей. Средний документ ≈ **163 байт**.

$$S_{\text{users}}(U) = 163 \times U \;\text{(байт)}$$

### Индексы

MongoDB создаёт B-tree и 2dsphere индексы. Оценка размера индексов для `plots`:

| Индекс | Оценка (байт/запись) |
|--------|-----:|
| `_id` (B-tree) | ~40 |
| `avito_id` (unique sparse) | ~40 |
| `price` | ~40 |
| `area_sotki` | ~40 |
| `total_score` | ~40 |
| `geo_location` (2dsphere) | ~200 |
| **Итого индексы plots** | **~400** |

$$S_{\text{idx\_plots}}(N) = 400 \times N$$

Индексы инфра (2 × B-tree + 2dsphere на каждую) ≈ 280 байт × I.

### Общая формула объёма

$$\boxed{S_{\text{total}}(N) = 3\,349 \times N + 410 \times I + 203 \times U \;\;\text{(байт)}}$$

При фиксированных $I = 87$, $U = 10$:

$$S_{\text{total}}(N) \approx 3\,349 N + 37\,700 \;\;\text{(байт)}$$

**Пример:** При $N = 2\,174$ (текущие данные):
- plots + индексы: 2 174 × 3 349 ≈ **7.3 МБ**
- infra + индексы: 87 × 410 ≈ **34.8 КБ**
- users: 10 × 203 ≈ **2.0 КБ**
- **Общий объём: ≈ 7.3 МБ**

---

## Избыточность модели

### «Чистый» объём данных

«Чистые» данные - это поля, непосредственно описывающие участок (без аналитических,без BSON-оверхеда):

| Поле / группа | Среднее (байт) |
|---------------|------:|
| `avito_id` | 8 |
| `title`, `description`, `location`, `address`, `geo_ref` | 1 228 |
| `price`, `area_sotki`, `lat`, `lon` | 32 |
| `url`, `thumbnail`, `images_count`, `was_lowered` | 277 |
| `created_at` | 8 |
| **Итого «чистый» документ** | **~1 553** |

«Производные» (аналитические) данные, **рассчитываемые автоматически**:

| Группа | Среднее (байт) | Назначение |
|--------|------:|-----------|
| `features` (15 × Double) | 120 | Оценки фич |
| `feature_score`, `features_text` | 202 | Агрегаты фич |
| `distances` (8 объектов) | 480 | Кэш расстояний |
| `price_per_sotka`, `infra_score`, `negative_score`, `total_score` | 32 | Скоры |
| `geo_location` | 58 | Дубль lat/lon для 2dsphere |
| `owner_id`, `owner_name` | 34 | Денормализация пользователя |
| **Итого производных** | **~926** |

BSON-оверхед ≈ **470 байт** (ключи, типы, вложенные структуры).

### Формула избыточности

Избыточность $R$ — отношение фактического объёма к «чистому» объёму данных:

$$R = \frac{S_{\text{total}}(N)}{S_{\text{clean}}(N)} = \frac{3\,349 \times N + 410 \times I + 203 \times U}{1\,553 \times N}$$

При фиксированных $I = 87$, $U = 10$:

$$\boxed{R(N) = \frac{3\,349 N + 37\,700}{1\,553 N} = 2.16 + \frac{24.3}{N}}$$

| N | R (коэффициент избыточности) |
|---|---|
| 100 | 2.40 |
| 1 000 | 2.18 |
| 2 174 | 2.17 |
| 10 000 | 2.16 |

**При больших N избыточность стремится к ≈ 2.16×.**

Основной вклад в избыточность:
1. **Кэш расстояний** (480 байт) — денормализация из инфра-коллекций
2. **BSON-оверхед** (~470 байт) — хранение имён полей в каждом документе
3. **Текстовые и агрегированные фичи** (`features_text`, `feature_score`) — дополнительный объём для быстрого ранжирования


---

## Направление роста модели

Рост по сущности `Plots (N)` самый быстрый. Модель растёт линейно примерно на 3.35 КБ на документ (данные и индексы). При N = 100 000 объём составит около 320 МБ. Основное влияние дают `description` и кэш `distances`.

Рост по инфраструктуре `I` медленный. Примерно 130 байт на объект. Влияние на общий объём небольшое. Увеличение I не меняет размер `plots`, но при пересчёте расстояний время `$geoNear` растёт логарифмически за счёт 2dsphere-индекса.

Рост по пользователям `U` минимальный. Примерно 163 байта на пользователя. При реалистичных значениях U вклад в объём несущественный.

Вложенные объекты в `plots` фиксированные: `features` (15 полей) и `distances` (8 объектов), их структура не расширяется автоматически.

**Главный вектор роста — N (количество объявлений).** Инфраструктура и пользователи растут на порядки медленнее.


---

## Примеры хранения данных в БД

### Примеры данных (нереляционная модель)

#### Пример документа `plots`

```json
{
  "_id": ObjectId("682fc1a5e3b7f2001a4d52c1"),
  "avito_id": 7547791865,
  "title": "Участок 4 сот. (СНТ, ДНП)",
  "description": "Продается участок 4 сотки.\n\nУчасток правильной квадратной формы, разработан. Есть плодовые деревья, цветы, кустарники (крыжовник, смородина, малина). На территории участка находятся теплица и парник, сарай для хранения инвентаря и еврокуб. Есть летний водопровод. Есть отдельный погребок. Тихое и уютное место, достойные соседи...",
  "price": 1400000,
  "area_sotki": 4.0,
  "price_per_sotka": 350000.0,
  "location": "Петергоф",
  "address": "Ленинградская область, Ломоносовский район, деревня Низино, садоводческое некоммерческое товарищество Сад-2",
  "geo_ref": "д. Низино, садоводческое некоммерческое товарищество Сад-2",
  "lat": 59.837417,
  "lon": 29.884385,
  "geo_location": {
    "type": "Point",
    "coordinates": [29.884385, 59.837417]
  },
  "url": "https://www.avito.ru/sankt-peterburg_peterhof/zemelnye_uchastki/uchastok_4_sot._snt_dnp_7547791865",
  "thumbnail": "https://00.img.avito.st/image/1/1.wPJgw7a-bBsWba4UbIikzgFibh3SdGgb0hMNEd6gY9nbYG4...",
  "images_count": 13,
  "was_lowered": false,
  "features": {
    "has_gas": 0.3752,
    "has_electricity": 0.3212,
    "has_water": 0.5228,
    "has_sewage": 0.4943,
    "has_house": 0.5357,
    "is_izhs": 0.3684,
    "is_snt": 0.3613,
    "is_quiet": 0.5999,
    "has_forest": 0.4556,
    "near_river": 0.4559,
    "has_road": 0.4874,
    "has_fence": 0.3033,
    "flat_terrain": 0.2769,
    "has_communications": 0.2187,
    "documents_ready": 0.1435
  },
  "feature_score": 1.0701,
  "features_text": "тихое место (60%), дом/постройки (54%), водоснабжение (52%), канализация (49%), хороший подъезд (49%), водоём рядом (46%)...",
  "distances": {
    "nearest_metro": { "name": "Проспект Ветеранов", "km": 8.45 },
    "nearest_hospital": { "name": "Ломоносовская больница", "km": 3.21 },
    "nearest_school": { "name": "Школа №6 Петергоф", "km": 2.15 },
    "nearest_kindergarten": { "name": "Детский сад №5 Петергоф", "km": 1.92 },
    "nearest_store": { "name": "Дикси Петергоф", "km": 1.88 },
    "nearest_pickup_point": { "name": "Ozon Петергоф", "km": 2.01 },
    "nearest_bus_stop": { "name": "Остановка Петергоф фонтаны", "km": 1.76 },
    "nearest_negative": { "name": "Очистные Красное Село", "km": 5.32 }
  },
  "infra_score": 0.1842,
  "negative_score": 0.2472,
  "total_score": 0.3521,
  "created_at": ISODate("2026-03-01T14:02:33Z"),
  "updated_at": null,
  "owner_id": null,
  "owner_name": null
}
```

#### Примеры документов инфраструктуры

**metro_stations:**
```json
{
  "_id": ObjectId("682fc1a5e3b7f2001a4d5001"),
  "name": "Проспект Ветеранов",
  "location": {
    "type": "Point",
    "coordinates": [30.2501, 59.8418]
  }
}
```

**hospitals:**
```json
{
  "_id": ObjectId("682fc1a5e3b7f2001a4d5010"),
  "name": "Александровская больница",
  "location": {
    "type": "Point",
    "coordinates": [30.3894, 59.8663]
  }
}
```

**schools:**
```json
{
  "_id": ObjectId("682fc1a5e3b7f2001a4d5020"),
  "name": "Школа №1 Красное Село",
  "location": {
    "type": "Point",
    "coordinates": [30.0849, 59.7382]
  }
}
```

**kindergartens:**
```json
{
  "_id": ObjectId("682fc1a5e3b7f2001a4d5030"),
  "name": "Детский сад №10 Красное Село",
  "location": {
    "type": "Point",
    "coordinates": [30.0900, 59.7350]
  }
}
```

**stores:**
```json
{
  "_id": ObjectId("682fc1a5e3b7f2001a4d5035"),
  "name": "Лента Колпино",
  "location": {
    "type": "Point",
    "coordinates": [30.5900, 59.7510]
  }
}
```

**pickup_points:**
```json
{
  "_id": ObjectId("682fc1a5e3b7f2001a4d5040"),
  "name": "Wildberries Пушкин",
  "location": {
    "type": "Point",
    "coordinates": [30.3980, 59.7150]
  }
}
```

**bus_stops:**
```json
{
  "_id": ObjectId("682fc1a5e3b7f2001a4d5045"),
  "name": "Остановка Зеленогорск вокзал",
  "location": {
    "type": "Point",
    "coordinates": [29.6989, 60.1956]
  }
}
```

**negative_objects:**
```json
{
  "_id": ObjectId("682fc1a5e3b7f2001a4d5050"),
  "name": "Полигон Новосёлки",
  "type": "landfill",
  "location": {
    "type": "Point",
    "coordinates": [30.2188, 60.0872]
  }
}
```

**users:**
```json
{
  "_id": ObjectId("682fc1a5e3b7f2001a4d5100"),
  "username": "admin",
  "password_hash": "a1b2c3d4e5f6...64 hex chars",
  "salt": "f6e5d4c3b2a1...64 hex chars",
  "role": "admin",
  "created_at": ISODate("2026-03-01T14:02:33Z")
}
```

---

## Реляционная модель

### Графическое представление модели

### Описание назначений коллекций, типов данных и сущностей

Для реляционной модели используются таблицы `plots`, `plot_features`, `plot_distances`, `users` и 8 инфраструктурных таблиц.

Оценка среднего размера строки в `plots` (без учёта внешних таблиц):

| Группа полей | Среднее (байт) | Комментарий |
|-------------|------:|-----------|
| Идентификаторы (`id`, `avito_id`, `owner_id`) | 24 | 3 × bigint |
| Текстовые поля (`title`, `description`, `location`, `address`, `geo_ref`) | 1 220 | TOAST/varlena, средние значения |
| Числа (`price`, `area_sotki`, `price_per_sotka`, `lat`, `lon`) | 40 | 5 × 8 байт |
| Гео (`geo_location`) | 32 | geography Point |
| Медиа/ссылки (`url`, `thumbnail`, `images_count`, `was_lowered`) | 277 | |
| Скоры и мета (`feature_score`, `features_text`, `infra_score`, `negative_score`, `total_score`, даты, `owner_name`) | 290 | |
| Оверхед строки PostgreSQL | ~80 | заголовок + выравнивание + null bitmap |
| **Итого `plots`** | **~1 963** | |

Оценка таблицы `plot_features` (15 признаков + PK/FK): **~160 байт/строка**.

Оценка таблицы `plot_distances` (8 пар `{name, km}` + PK/FK): **~520 байт/строка**.

Оценка таблицы `users`: **~190 байт/строка**.

Оценка инфраструктурных таблиц (`metro_stations` ... `negative_objects`): **~150 байт/строка**.

### Оценка объёма информации

Обозначим:

- $N$ — количество участков (`plots`)
- $I$ — количество инфраструктурных объектов (сумма по 8 таблицам)
- $U$ — количество пользователей

Тогда объём данных реляционной модели:

$$S_{\text{data,rel}}(N) = (1\,963 + 160 + 520)N + 150I + 190U = 2\,643N + 150I + 190U$$

Оценка индексов:

- `plots`: PK + `avito_id` + `price` + `area_sotki` + `total_score` + GiST(`geo_location`) ≈ **520 байт/участок**
- `plot_features` и `plot_distances`: PK/FK индексы ≈ **80 байт/участок**
- инфраструктура: PK + GiST(`location`) ≈ **220 байт/объект**
- `users`: PK + unique(`username`) ≈ **80 байт/пользователь**

$$S_{\text{idx,rel}}(N) = 600N + 220I + 80U$$

Итоговая формула:

$$\boxed{S_{\text{total,rel}}(N) = 3\,243N + 370I + 270U}$$

При фиксированных $I=87$ и $U=10$:

$$S_{\text{total,rel}}(N) = 3\,243N + 34\,590$$

### Избыточность модели

«Чистый» объём для участка (только исходные бизнес-поля без производных метрик и кэшей) примем как:

$$S_{\text{clean,rel}}(N) = 1\,553N$$

Тогда коэффициент избыточности:

$$R_{\text{rel}}(N)=\frac{S_{\text{total,rel}}(N)}{S_{\text{clean,rel}}(N)}=\frac{3\,243N+370I+270U}{1\,553N}$$

При фиксированных $I=87$, $U=10$:

$$\boxed{R_{\text{rel}}(N)=\frac{3\,243N+34\,590}{1\,553N}=2.09+\frac{22.3}{N}}$$

### Направление роста модели

Рост по `N` остаётся главным: каждый новый участок добавляет строку в `plots`, `plot_features`, `plot_distances` и записи в индексах. Суммарный прирост близок к 3.24 КБ на объект.

Рост по `I` линейный и значительно медленнее, около 370 байт на инфраструктурный объект с учётом индексов.

Рост по `U` минимальный, около 270 байт на пользователя с индексами.

Основная нагрузка на чтение возникает в сценариях с `JOIN` таблиц `plots` + `plot_features` + `plot_distances` и в геооперациях по GiST-индексам.

### Примеры хранения данных в БД

#### Примеры данных (реляционная модель)

```sql
-- plots
INSERT INTO plots (
  id, avito_id, title, description, price, area_sotki, price_per_sotka,
  location, address, geo_ref, lat, lon, geo_location,
  url, thumbnail, images_count, was_lowered,
  feature_score, features_text, infra_score, negative_score, total_score,
  created_at, updated_at, owner_id, owner_name
) VALUES (
  12345, 7547791865, 'Участок 4 сот. (СНТ, ДНП)', 'Продается участок 4 сотки...',
  1400000, 4.0, 350000,
  'Петергоф', 'Ленинградская область, Ломоносовский район...',
  'д. Низино, СНТ Сад-2', 59.837417, 29.884385,
  ST_SetSRID(ST_MakePoint(29.884385, 59.837417), 4326)::geography,
  'https://www.avito.ru/...', 'https://00.img.avito.st/...', 13, false,
  1.0701, 'тихое место (60%), дом/постройки (54%)...', 0.1842, 0.2472, 0.3521,
  NOW(), NULL, NULL, NULL
);

-- plot_features
INSERT INTO plot_features (
  plot_id, has_gas, has_electricity, has_water, has_sewage, has_house,
  is_izhs, is_snt, is_quiet, has_forest, near_river,
  has_road, has_fence, flat_terrain, has_communications, documents_ready
) VALUES (
  12345, 0.3752, 0.3212, 0.5228, 0.4943, 0.5357,
  0.3684, 0.3613, 0.5999, 0.4556, 0.4559,
  0.4874, 0.3033, 0.2769, 0.2187, 0.1435
);
```

#### Связанные сущности и инфраструктура

```sql
-- plot_distances
INSERT INTO plot_distances (
  plot_id,
  nearest_metro_name, nearest_metro_km,
  nearest_hospital_name, nearest_hospital_km,
  nearest_school_name, nearest_school_km,
  nearest_kindergarten_name, nearest_kindergarten_km,
  nearest_store_name, nearest_store_km,
  nearest_pickup_point_name, nearest_pickup_point_km,
  nearest_bus_stop_name, nearest_bus_stop_km,
  nearest_negative_name, nearest_negative_km
) VALUES (
  12345,
  'Проспект Ветеранов', 8.45,
  'Ломоносовская больница', 3.21,
  'Школа №6 Петергоф', 2.15,
  'Детский сад №5 Петергоф', 1.92,
  'Дикси Петергоф', 1.88,
  'Ozon Петергоф', 2.01,
  'Остановка Петергоф фонтаны', 1.76,
  'Очистные Красное Село', 5.32
);

-- users
INSERT INTO users (id, username, password_hash, salt, role, created_at)
VALUES (1, 'admin', 'a1b2c3d4e5f6...64 hex chars', 'f6e5d4c3b2a1...64 hex chars', 'admin', NOW());

-- metro_stations
INSERT INTO metro_stations (id, name, location)
VALUES (101, 'Проспект Ветеранов', ST_SetSRID(ST_MakePoint(30.2501, 59.8418), 4326)::geography);

-- negative_objects
INSERT INTO negative_objects (id, name, type, location)
VALUES (201, 'Полигон Новосёлки', 'landfill', ST_SetSRID(ST_MakePoint(30.2188, 60.0872), 4326)::geography);
```

---

## Примеры запросов к модели

### Текст запросов

#### Q1. Постраничный просмотр каталога (UC1, UC2, UC3)

```javascript
// Подсчёт количества для пагинации
db.plots.countDocuments({
  price: { $gte: 500000, $lte: 3000000 },
  area_sotki: { $gte: 5 }
})

// Сортированная выборка с пропуском и лимитом
db.plots.find(
  { price: { $gte: 500000, $lte: 3000000 }, area_sotki: { $gte: 5 } }
)
.sort({ total_score: -1 })
.skip(0)
.limit(20)
```

#### Q2. Поиск по каталогу и ранжирование (UC4)

```javascript
db.plots.find(
  {
    price: { $gte: 500000, $lte: 3000000 },
    area_sotki: { $gte: 5 }
  },
  {
    title: 1,
    description: 1,
    price: 1,
    area_sotki: 1,
    total_score: 1,
    features_text: 1
  }
)
.sort({ total_score: -1 })
.limit(100)
```

#### Q3. Просмотр деталей одного участка (UC5)

```javascript
db.plots.findOne(
  { _id: ObjectId("682fc1a5e3b7f2001a4d52c1") }
)
```

#### Q4. Данные для карты (UC6)

```javascript
db.plots.find(
  {},
  { title: 1, price: 1, area_sotki: 1, lat: 1, lon: 1, total_score: 1, location: 1, features_text: 1 }
)
.skip(0)
.limit(200)
```

#### Q5. Создание объявления (UC8)

```javascript
// Шаг 1: Вычислить расстояния — $geoNear к каждой из 8 инфра-коллекций
db.metro_stations.aggregate([
  {
    $geoNear: {
      near: { type: "Point", coordinates: [29.88, 59.84] },
      distanceField: "dist_meters",
      spherical: true
    }
  },
  { $limit: 1 },
  { $project: { name: 1, dist_meters: 1 } }
])
// ... повторяется для hospitals, schools, kindergartens, stores, pickup_points, bus_stops, negative_objects

// Шаг 2: Вставить документ
db.plots.insertOne({ ... })
```

#### Q6. Обновление объявления (UC9, UC14)

```javascript
// Шаг 1: Найти существующий
db.plots.findOne({ _id: ObjectId("...") })

// Шаг 2: (опционально) Пересчитать $geoNear × 8 при смене координат
// Шаг 3: Обновить
db.plots.updateOne(
  { _id: ObjectId("...") },
  { $set: { title: "Новый заголовок", updated_at: ISODate("2026-03-11T12:00:00Z"), ... } }
)

// Шаг 4: Получить обновлённый документ
db.plots.findOne({ _id: ObjectId("...") })
```

#### Q7. Удаление объявления (UC10, UC15)

```javascript
db.plots.findOne({ _id: ObjectId("...") }, { owner_id: 1 })  // проверка владельца
db.plots.deleteOne({ _id: ObjectId("...") })
```

#### Q8. Регистрация / логин (UC аутентификации)

```javascript
// Регистрация
db.users.findOne({ username: "ivan" })  // проверка уникальности
db.users.insertOne({
  username: "ivan",
  password_hash: "...",
  salt: "...",
  role: "user",
  created_at: ISODate("2026-03-11T12:00:00Z")
})

// Логин
db.users.findOne({ username: "ivan" })
```

#### Q9. Экспорт всех данных (UC11)

```javascript
db.plots.find({})
db.metro_stations.find({})
db.hospitals.find({})
db.schools.find({})
db.kindergartens.find({})
db.stores.find({})
db.pickup_points.find({})
db.bus_stops.find({})
db.negative_objects.find({})
```

#### Q10. Импорт объявлений (UC12)

```javascript
db.plots.updateOne(
  { avito_id: 7547791865 },
  { $set: { ... } },
  { upsert: true }
)
```

#### Q11. Статистика (UC13)

```javascript
db.plots.countDocuments({})
db.metro_stations.countDocuments({})
db.hospitals.countDocuments({})
// ... для каждой из 10 коллекций
```

#### Q12. CRUD инфраструктуры

```javascript
// Список объектов
db.metro_stations.find({})

// Добавление
db.metro_stations.insertOne({
  name: "Новая станция",
  location: { type: "Point", coordinates: [30.35, 59.94] }
})

// Удаление
db.metro_stations.deleteOne({ _id: ObjectId("...") })

// Полная замена коллекции
db.metro_stations.deleteMany({})
db.metro_stations.insertMany([...])
```

---

### Текст запросов (реляционная модель)

#### Q1. Постраничный просмотр каталога (UC1, UC2, UC3)

```sql
-- Подсчёт количества для пагинации
SELECT COUNT(*)
FROM plots p
WHERE p.price BETWEEN 500000 AND 3000000
  AND p.area_sotki >= 5;

-- Сортированная выборка
SELECT p.id, p.title, p.price, p.area_sotki, p.total_score
FROM plots p
WHERE p.price BETWEEN 500000 AND 3000000
  AND p.area_sotki >= 5
ORDER BY p.total_score DESC
LIMIT 20 OFFSET 0;
```

#### Q2. Поиск по каталогу и ранжирование (UC4)

```sql
SELECT p.id, p.title, p.description, p.price, p.area_sotki, p.total_score
FROM plots p
WHERE p.price BETWEEN 500000 AND 3000000
  AND p.area_sotki >= 5
ORDER BY p.total_score DESC
LIMIT 100;
```

#### Q3. Просмотр деталей одного участка (UC5)

```sql
SELECT p.*, pf.*, pd.*
FROM plots p
LEFT JOIN plot_features pf ON pf.plot_id = p.id
LEFT JOIN plot_distances pd ON pd.plot_id = p.id
WHERE p.id = 12345;
```

#### Q4. Данные для карты (UC6)

```sql
SELECT p.id, p.title, p.price, p.area_sotki,
       ST_Y(p.geo_location::geometry) AS lat,
       ST_X(p.geo_location::geometry) AS lon,
       p.total_score, p.location, p.features_text
FROM plots p
ORDER BY p.id
LIMIT 200 OFFSET 0;
```

#### Q5. Создание объявления (UC8)

```sql
-- Шаг 1: найти ближайшие объекты инфраструктуры (пример для метро)
SELECT m.name,
       ST_Distance(p_in::geography, m.location) / 1000.0 AS km
FROM metro_stations m,
     (SELECT ST_SetSRID(ST_MakePoint(29.88, 59.84), 4326)::geography AS p_in) q
ORDER BY m.location <-> q.p_in
LIMIT 1;

-- Шаг 2: вставка участка
INSERT INTO plots (avito_id, title, description, price, area_sotki, lat, lon, geo_location, created_at)
VALUES (7547791865, 'Новый участок', 'Описание...', 1400000, 4.0, 59.84, 29.88,
        ST_SetSRID(ST_MakePoint(29.88, 59.84), 4326)::geography, NOW())
RETURNING id;

-- Шаг 3: вставка производных данных
INSERT INTO plot_features (plot_id, has_gas, has_electricity, has_water)
VALUES (12345, 0.37, 0.32, 0.52);

INSERT INTO plot_distances (plot_id, nearest_metro_name, nearest_metro_km)
VALUES (12345, 'Проспект Ветеранов', 8.45);
```

#### Q6. Обновление объявления (UC9, UC14)

```sql
-- Шаг 1: найти текущее состояние
SELECT * FROM plots WHERE id = 12345;

-- Шаг 2: обновить поля
UPDATE plots
SET title = 'Новый заголовок',
    updated_at = NOW()
WHERE id = 12345;

-- Шаг 3: получить обновлённый документ
SELECT * FROM plots WHERE id = 12345;
```

#### Q7. Удаление объявления (UC10, UC15)

```sql
-- Проверка владельца
SELECT owner_id FROM plots WHERE id = 12345;

-- Удаление
DELETE FROM plots WHERE id = 12345;
```

#### Q8. Регистрация / логин (UC аутентификации)

```sql
-- Регистрация
SELECT id FROM users WHERE username = 'ivan';

INSERT INTO users (username, password_hash, salt, role, created_at)
VALUES ('ivan', '...', '...', 'user', NOW());

-- Логин
SELECT id, username, password_hash, salt, role
FROM users
WHERE username = 'ivan';
```

#### Q9. Экспорт всех данных (UC11)

```sql
SELECT * FROM plots;
SELECT * FROM plot_features;
SELECT * FROM plot_distances;
SELECT * FROM metro_stations;
SELECT * FROM hospitals;
SELECT * FROM schools;
SELECT * FROM kindergartens;
SELECT * FROM stores;
SELECT * FROM pickup_points;
SELECT * FROM bus_stops;
SELECT * FROM negative_objects;
SELECT * FROM users;
```

#### Q10. Импорт объявлений (UC12)

```sql
INSERT INTO plots (avito_id, title, price, area_sotki, lat, lon, geo_location, created_at)
VALUES (7547791865, 'Участок', 1400000, 4.0, 59.84, 29.88,
        ST_SetSRID(ST_MakePoint(29.88, 59.84), 4326)::geography, NOW())
ON CONFLICT (avito_id) DO UPDATE
SET title = EXCLUDED.title,
    price = EXCLUDED.price,
    area_sotki = EXCLUDED.area_sotki,
    lat = EXCLUDED.lat,
    lon = EXCLUDED.lon,
    geo_location = EXCLUDED.geo_location,
    updated_at = NOW();
```

#### Q11. Статистика (UC13)

```sql
SELECT COUNT(*) FROM plots;
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM metro_stations;
SELECT COUNT(*) FROM hospitals;
SELECT COUNT(*) FROM schools;
SELECT COUNT(*) FROM kindergartens;
SELECT COUNT(*) FROM stores;
SELECT COUNT(*) FROM pickup_points;
SELECT COUNT(*) FROM bus_stops;
SELECT COUNT(*) FROM negative_objects;
```

#### Q12. CRUD инфраструктуры

```sql
-- Список объектов
SELECT * FROM metro_stations;

-- Добавление
INSERT INTO metro_stations (name, location)
VALUES ('Новая станция', ST_SetSRID(ST_MakePoint(30.35, 59.94), 4326)::geography);

-- Удаление
DELETE FROM metro_stations WHERE id = 777;

-- Полная замена данных
TRUNCATE TABLE metro_stations RESTART IDENTITY;
INSERT INTO metro_stations (name, location) VALUES
  ('Станция 1', ST_SetSRID(ST_MakePoint(30.25, 59.84), 4326)::geography),
  ('Станция 2', ST_SetSRID(ST_MakePoint(30.31, 59.90), 4326)::geography);
```

### Количество запросов для юзкейсов

| Use Case | Описание | Реляционная модель | Нереляционная модель | Зависимость от N / I |
|----------|----------|--------------------|----------------------|----------------------|
| **UC1** Просмотр каталога | Пагинация каталога | 2 запроса, 1 таблица (`plots`) | 2 запроса, 1 коллекция (`plots`) | O(1) с индексами |
| **UC2** Фильтрация | Фильтрация каталога | 2 запроса, 1 таблица (`plots`) | 2 запроса, 1 коллекция (`plots`) | O(1) с индексами |
| **UC3** Сортировка | Сортировка выдачи | 2 запроса, 1 таблица (`plots`) | 2 запроса, 1 коллекция (`plots`) | O(log N), худший O(N) |
| **UC4** Поиск и ранжирование | Поиск с сортировкой по score | 1-2 запроса, 1 таблица (`plots`) | 1-2 запроса, 1 коллекция (`plots`) | O(log N), худший O(N) |
| **UC5** Детали участка | Карточка объекта | 1 запрос, 3 таблицы (`plots`, `plot_features`, `plot_distances`) | 1 запрос, 1 коллекция (`plots`) | O(1) |
| **UC6** Карта | Пакетная загрузка маркеров | 1 + ⌈N/200⌉ запросов, 1 таблица (`plots`) | 1 + ⌈N/200⌉ запросов, 1 коллекция (`plots`) | O(N) суммарно |
| **UC7** Переход на Авито | Клиентский редирект | 0 | 0 | - |
| **UC8** Создание участка | Геообогащение + сохранение | 11 запросов, 11 таблиц | 9 запросов, 9 коллекций | O(1) с индексами |
| **UC9** Редактирование | Чтение + обновление (+гео при смене координат) | 3-11 запросов, 1-9 таблиц | 3-12 запросов, 1-9 коллекций | O(1) |
| **UC10** Удаление | Проверка владельца + удаление | 2 запроса, 1 таблица (`plots`) | 2 запроса, 1 коллекция (`plots`) | O(1) |
| **UC11** Экспорт | Выгрузка всех сущностей | 12 запросов, 12 таблиц | 10 запросов, 10 коллекций | O(N + I + U) |
| **UC12** Импорт M записей | Пакетный upsert/обогащение | 11 × M запросов, 11 таблиц | 9 × M запросов, 9 коллекций | O(M) |
| **UC13** Статистика | Подсчеты по сущностям | 10 запросов, 10 таблиц | 10 запросов, 10 коллекций | O(1) |
| **UC14** Редактирование (admin) | То же, что UC9 | 3-11 запросов, 1-9 таблиц | 3-12 запросов, 1-9 коллекций | O(1) |
| **UC15** Удаление (admin) | То же, что UC10 | 2 запроса, 1 таблица (`plots`) | 2 запроса, 1 коллекция (`plots`) | O(1) |



## Вывод

По итогам сравнения обе модели рабочие, но дают разный компромисс.

Сравнение формул объёма при одинаковых $I$ и $U$:
- нереляционная: $S_{total,doc}(N)=3349N+410I+203U$
- реляционная: $S_{total,rel}(N)=3243N+370I+270U$

Разность объёма (нереляционная минус реляционная):

$$\Delta S(N)=S_{total,doc}(N)-S_{total,rel}(N)=106N+40I-67U$$

При $I=87$, $U=10$:

$$\Delta S(N)=106N+2810$$

Это означает, что реляционная модель экономит примерно 106 байт на каждый новый объект `plots` и имеет меньшую константу по инфраструктуре.

Сравнение формул избыточности:
- нереляционная: $R_{doc}(N)=2.16+\frac{24.3}{N}$
- реляционная: $R_{rel}(N)=2.09+\frac{22.3}{N}$

Разность избыточности:

$$\Delta R(N)=R_{doc}(N)-R_{rel}(N)=0.07+\frac{2.0}{N}$$

Следовательно, реляционная модель системно менее избыточна на всей области $N>0$, а при росте $N$ предельный разрыв стремится к 0.07.

Сравнение на практических масштабах (при $I=87$, $U=10$):

| N | $S_{total,doc}(N)$ | $S_{total,rel}(N)$ | Экономия реляционной |
|---:|---:|---:|---:|
| 1 000 | 3 386 700 байт | 3 277 590 байт | 109 110 байт (~3.2%) |
| 2 174 | 7 318 226 байт | 7 084 772 байт | 233 454 байт (~3.2%) |
| 10 000 | 33 527 700 байт | 32 464 590 байт | 1 063 110 байт (~3.2%) |

При этом по количеству запросов в прикладных сценариях записи документная модель проще (например, UC8 и UC12: 9 против 11 запросов на запись/объект).

Итог:
- при текущем профиле нагрузки (поиск, каталог, быстрый вывод карточек) приоритетнее **NoSQL (MongoDB)**
- при акценте на минимизацию избыточности, строгую целостность и транзакционность приоритетнее **PostgreSQL**


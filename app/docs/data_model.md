# Модель данных

## Нереляционная модель

![Схема нереляционной модели](https://raw.githubusercontent.com/moevm/nsql1h26-land/main/docs/nosql-model.png)

### JSON-схема коллекции `plots`

```json
{
  "$jsonSchema": {
    "bsonType": "object",
    "required": ["title", "geo_location"],
    "properties": {
      "_id":             { "bsonType": "objectId" },
      "avito_id":        { "bsonType": "long" },
      "title":           { "bsonType": "string", "maxLength": 100 },
      "description":     { "bsonType": "string", "maxLength": 80000 },
      "price":           { "bsonType": "double" },
      "area_sotki":      { "bsonType": "double" },
      "price_per_sotka": { "bsonType": "double" },
      "location":        { "bsonType": "string", "maxLength": 50 },
      "address":         { "bsonType": "string", "maxLength": 2500 },
      "geo_ref":         { "bsonType": "string", "maxLength": 150 },
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
    "required": ["username", "password_hash", "role"],
    "properties": {
      "_id":           { "bsonType": "objectId" },
      "username":      { "bsonType": "string", "maxLength": 50 },
      "password_hash": { "bsonType": "string", "minLength": 64, "maxLength": 128 },
      "role":          { "bsonType": "string", "enum": ["user", "admin"] },
      "created_at":    { "bsonType": "date" }
    }
  }
}
```

### JSON-схема коллекции `infra_objects`

Единая коллекция инфраструктуры и негативных объектов.

```json
{
  "$jsonSchema": {
    "bsonType": "object",
    "required": ["name", "type", "location"],
    "properties": {
      "_id":  { "bsonType": "objectId" },
      "name": { "bsonType": "string", "maxLength": 80 },
      "type": {
        "bsonType": "string",
        "enum": [
          "metro_station",
          "hospital",
          "school",
          "kindergarten",
          "store",
          "pickup_point",
          "bus_stop",
          "negative"
        ]
      },
      "subtype": {
        "bsonType": "string",
        "enum": ["landfill", "industrial", "highway", "sewage_plant", "prison", "power_plant"]
      },
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
| `_id` | ObjectId | 12 | 12 | Уникальный идентификатор в MongoDB |
| `avito_id` | Int64 | 8 | 8 | ID объявления на Авито |
| `title` | String | 30 | 57 | Заголовок объявления |
| `description` | String | 1 068 | 6 310 | Полное текстовое описание |
| `price` | Double | 8 | 8 | Цена (₽) |
| `area_sotki` | Double | 8 | 8 | Площадь (сотки) |
| `price_per_sotka` | Double | 8 | 8 | Расчётная цена за сотку |
| `location` | String | 17 | 21 | Район/город |
| `address` | String | 90 | 174 | Полный адрес |
| `geo_ref` | String | 23 | 86 | Гео-описание |
| `geo_location` | Object (GeoJSON) | 58 | 58 | `{type:"Point", coordinates:[lon,lat]}`, 2dsphere |
| `url` | String | 100 | 134 | URL объявления на Авито |
| `thumbnail` | String | 172 | 233 | URL миниатюры изображения |
| `images_count` | Int32 | 4 | 4 | Количество фотографий |
| `was_lowered` | Boolean | 1 | 1 | Была ли снижена цена |
| `features` | Object (15 полей × Double) | 120 | 120 | Вероятностные оценки всех текстовых характеристик |
| `feature_score` | Double | 8 | 8 | Взвешенная сумма фич |
| `features_text` | String | 194 | 293 | Человекочитаемая строка найденных характеристик |
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
| `has_house` | дом / постройки |
| `is_izhs` | ИЖС |
| `is_snt` | СНТ / ДНП |
| `is_quiet` | Тихое место |
| `has_forest` | Лес рядом |
| `near_river` | Водоём рядом |
| `has_road` | Хороший подъезд |
| `has_fence` | Огорожен |
| `flat_terrain` | Ровный участок |
| `has_communications` | Есть связь, интернет|
| `documents_ready` | Документы для покупки готовы |

#### Расстояния (вычисляются при запросе)

Расстояния до ближайших инфраструктурных объектов **не хранятся** в коллекции `plots`. Вычисляются при запросе детальной карточки участка через `$geoNear` к `infra_objects` с фильтрацией по `type`.

Скоры (`infra_score`, `negative_score`, `total_score`) **хранятся** в `plots` для сортировки/фильтрации.

| Ключ | Источник (`infra_objects.type`) |
|------|---------------------|
| `nearest_metro` | `metro_station` |
| `nearest_hospital` | `hospital` |
| `nearest_school` | `school` |
| `nearest_kindergarten` | `kindergarten` |
| `nearest_store` | `store` |
| `nearest_pickup_point` | `pickup_point` |
| `nearest_bus_stop` | `bus_stop` |
| `nearest_negative` | `negative` |

---

### Коллекция `users` — пользователи

| Поле | BSON-тип | Размер (байт) | Назначение |
|------|----------|-----:|-----------|
| `_id` | ObjectId | 12 | Уникальный идентификатор |
| `username` | String | ~10 | Логин |
| `password_hash` | String | 64 | PBKDF2-SHA256 хеш пароля |
| `role` | String | ~5 | Роль: `"user"` или `"admin"` |
| `created_at` | DateTime | 8 | Дата регистрации |

**Среднее:** ~99 байт / документ
**Индексы:** `username` (unique).

---

### Коллекция `infra_objects`

Единая коллекция содержит и обычную инфраструктуру, и негативные объекты. Это упрощает расширение модели: новый тип добавляется через значение `type`, без заведения новой коллекции.

#### Общая структура полей

| Поле | BSON-тип | Среднее (байт) | Макс (байт) | Назначение |
|------|----------|-----:|-----:|-----------|
| `_id` | ObjectId | 12 | 12 | Уникальный идентификатор MongoDB |
| `name` | String | ~37 | 55 | Название объекта |
| `type` | String | ~11 | 14 | Тип: `metro_station`, `hospital`, `school`, `kindergarten`, `store`, `pickup_point`, `bus_stop`, `negative` |
| `subtype` | String | ~12 | 14 | Подтип только для `type="negative"` |
| `location` | Object (GeoJSON Point) | 58 | 58 | `{type:"Point", coordinates:[lon,lat]}` для 2dsphere |
| **BSON-оверхед** | — | ~30 | ~35 | Ключи полей, типы, длины строк |
| **Итого** | | **~145** | **~174** | |

**Индексы:** `location` (2dsphere), составной B-tree `type + name`, отдельный `subtype`.

#### Распределение типов (текущие данные)

| `type` | Кол-во | Роль в `distances` |
|--------|:------:|--------------------|
| `metro_station` | 15 | `nearest_metro` |
| `hospital` | 9 | `nearest_hospital` |
| `school` | 10 | `nearest_school` |
| `kindergarten` | 8 | `nearest_kindergarten` |
| `store` | 10 | `nearest_store` |
| `pickup_point` | 9 | `nearest_pickup_point` |
| `bus_stop` | 12 | `nearest_bus_stop` |
| `negative` | 14 | `nearest_negative` |
| **Итого** | **87** | |

#### Подтипы для `type="negative"`

`landfill` - Свалки, полигоны ТБО  
`industrial` - Промышленные зоны  
`highway` - Шумные магистрали  
`sewage_plant` - Очистные сооружения  
`prison` - Исправительные учреждения  
`power_plant` - Электростанции / ТЭЦ

#### Связь с `plots.distances`

При создании / импорте участка выполняется один `$geoNear` к `infra_objects` с группировкой по `type`:

```javascript
db.infra_objects.aggregate([
  {
    $geoNear: {
      near: { type: "Point", coordinates: [lon, lat] },
      distanceField: "dist_meters",
      spherical: true
    }
  },
  { $sort: { type: 1, dist_meters: 1 } },
  {
    $group: {
      _id: "$type",
      nearest_name: { $first: "$name" },
      dist_meters: { $first: "$dist_meters" }
    }
  }
])
```

Результаты используются для расчёта `infra_score` и `negative_score` (0-1).

---

## Оценка объёма информации

### Размер одного документа `plots`

Оценим **средний** размер документа `plots` по реальным данным (2174 записи):

| Группа полей | Среднее (байт) | Комментарий |
|-------------|------:|-----------|
| Служебное: `_id`, `avito_id` | 20 | ObjectId + Int64 |
| Текст: `title`, `description`, `location`, `address`, `geo_ref` | 1 228 | UTF-8, среднее по данным |
| Числовые: `price`, `area_sotki`, `price_per_sotka` | 24 | 3 × Double |
| Гео: `geo_location` | 58 | GeoJSON Point |
| Медиа: `url`, `thumbnail`, `images_count`, `was_lowered` | 277 | |
| Фичи: `features` (15 × Double) + `feature_score` + `features_text` | 322 | 120 + 8 + 194 |
| Скоры: `infra_score`, `negative_score`, `total_score` | 24 | 3 × Double |
| Мета: `created_at`, `updated_at`, `owner_id`, `owner_name` | 50 | |
| **BSON-оверхед** (ключи полей, типы, длины) | ~350 | ~22 поля верхнего уровня + вложенные |
| **Итого средний документ** | **~2 353** | |

Обозначим **N** — количество объявлений (plots).

Размер коллекции `plots`:

$$S_{\text{plots}}(N) = 2\,353 \times N \;\text{(байт)} \approx 2.30 \times N \;\text{(КБ)}$$

### Размеры коллекции `infra_objects`

Обозначим число объектов каждого типа как $I_j$ ($j = 1 \ldots 8$), и суммарное $I = \sum_{j=1}^{8} I_j$.

Средний размер документа (с BSON-оверхедом, полями `type`/`subtype`) ≈ **145 байт**.

На данный момент ограничились только примерами инфраструктуры СПБ, в будущем можно подгрузить побольше реальных данных.

| `type` | Кол-во | Средн. документ (байт) | Суммарно (байт) |
|--------|:------:|:------:|:------:|
| `metro_station` | 15 | 145 | 2 175 |
| `hospital` | 9 | 145 | 1 305 |
| `school` | 10 | 145 | 1 450 |
| `kindergarten` | 8 | 145 | 1 160 |
| `store` | 10 | 145 | 1 450 |
| `pickup_point` | 9 | 145 | 1 305 |
| `bus_stop` | 12 | 145 | 1 740 |
| `negative` | 14 | 145 | 2 030 |
| **Итого** | **87** | **145** | **12 615** |

#### Общий объём инфраструктуры

$$S_{\text{infra}}(I) \approx 145 \times I \;\text{(байт)}$$

Текущие количества: $I = 87$ объектов → **~12 615 байт (~12.3 КБ)**.

### Размер коллекции `users`

Обозначим $U$ — количество пользователей. Средний документ ≈ **99 байт**.

$$S_{\text{users}}(U) = 99 \times U \;\text{(байт)}$$

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

S_idx_plots(N) = 400 × N

Индексы `infra_objects` (2dsphere + `type+name` + `subtype`) ≈ 300 байт × I.

### Общая формула объёма

$$\boxed{S_{\text{total}}(N) = 2\,753 \times N + 445 \times I + 139 \times U \;\;\text{(байт)}}$$

При фиксированных $I = 87$, $U = 10$:

$$S_{\text{total}}(N) \approx 2\,753 N + 40\,105 \;\;\text{(байт)}$$

**Пример:** При $N = 2\,174$ (текущие данные):
- plots + индексы: 2 174 × 2 753 ≈ **5.99 МБ**
- infra + индексы: 87 × 445 ≈ **37.8 КБ**
- users: 10 × 139 ≈ **1.4 КБ**
- **Общий объём: ≈ 6.0 МБ**

---

## Избыточность данных

### «Чистый» объём данных

«Чистые» данные — поля, непосредственно описывающие участок:

| Поле / группа | Среднее (байт) |
|---------------|------:|
| `avito_id` | 8 |
| `title`, `description`, `location`, `address`, `geo_ref` | 1 228 |
| `price`, `area_sotki` | 16 |
| `geo_location` | 58 |
| `url`, `thumbnail`, `images_count`, `was_lowered` | 277 |
| `created_at` | 8 |
| **Итого «чистый» документ** | **~1 595** |

«Производные» (аналитические) данные, **рассчитываемые автоматически**:

| Группа | Среднее (байт) | Назначение |
|--------|------:|-----------|
| `features` (15 × Double) | 120 | Оценки фич |
| `feature_score`, `features_text` | 202 | Агрегаты фич |
| `price_per_sotka`, `infra_score`, `negative_score`, `total_score` | 32 | Скоры |
| `owner_id`, `owner_name` | 34 | Денормализация пользователя |
| **Итого производных** | **~388** |

BSON-оверхед ≈ **370 байт** (ключи, типы, вложенные структуры).

### Формула избыточности

Избыточность $R$ — отношение фактического объёма к «чистому» объёму данных:

$$R = \frac{S_{\text{total}}(N)}{S_{\text{clean}}(N)} = \frac{2\,753 \times N + 445 \times I + 139 \times U}{1\,595 \times N}$$

При фиксированных $I = 87$, $U = 10$:

$$\boxed{R(N) = \frac{2\,753 N + 40\,105}{1\,595 N} = 1.73 + \frac{25.1}{N}}$$

| N | R (коэффициент избыточности) |
|---|---|
| 100 | 1.98 |
| 1 000 | 1.75 |
| 2 174 | 1.74 |
| 10 000 | 1.73 |

**При больших N избыточность стремится к ≈ 1.73×.**

Основной вклад в избыточность:
1. **BSON-оверхед** (~370 байт) — хранение имён полей в каждом документе
2. **Текстовые и агрегированные фичи** (`features_text`, `feature_score`) — дополнительный объём для быстрого ранжирования
3. **Скоры** (`infra_score`, `negative_score`, `total_score`) — хранятся для сортировки/фильтрации


---

## Направление роста модели

Рост по сущности `Plots (N)` самый быстрый. Модель растёт линейно примерно на 2.75 КБ на документ (данные и индексы). При N = 100 000 объём составит около 263 МБ. Основное влияние даёт `description`.

Рост по инфраструктуре `I` медленный. Примерно 145 байт на объект данных и около 300 байт индексов на объект. Влияние на общий объём небольшое. Увеличение I не меняет размер `plots`, но время `$geoNear` растёт логарифмически за счёт 2dsphere-индекса.

Рост по пользователям `U` минимальный. Примерно 99 байт на пользователя. При реалистичных значениях U вклад в объём несущественный.

Вложенный объект `features` в `plots` фиксированный (15 полей), его структура не расширяется автоматически. Расстояния (`distances`) не хранятся - вычисляются при запросе детальной карточки.

**Главный вектор роста - N (количество объявлений).** Инфраструктура и пользователи растут заметно медленнее.


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
  "infra_score": 0.1842,
  "negative_score": 0.2472,
  "total_score": 0.3521,
  "created_at": ISODate("2026-03-01T14:02:33Z"),
  "updated_at": null,
  "owner_id": null,
  "owner_name": null
}
```

#### Примеры документов `infra_objects`

**`type: metro_station`:**
```json
{
  "_id": ObjectId("682fc1a5e3b7f2001a4d5001"),
  "type": "metro_station",
  "name": "Проспект Ветеранов",
  "location": {
    "type": "Point",
    "coordinates": [30.2501, 59.8418]
  }
}
```

**`type: hospital`:**
```json
{
  "_id": ObjectId("682fc1a5e3b7f2001a4d5010"),
  "type": "hospital",
  "name": "Александровская больница",
  "location": {
    "type": "Point",
    "coordinates": [30.3894, 59.8663]
  }
}
```

**`type: school`:**
```json
{
  "_id": ObjectId("682fc1a5e3b7f2001a4d5020"),
  "type": "school",
  "name": "Школа №1 Красное Село",
  "location": {
    "type": "Point",
    "coordinates": [30.0849, 59.7382]
  }
}
```

**`type: kindergarten`:**
```json
{
  "_id": ObjectId("682fc1a5e3b7f2001a4d5030"),
  "type": "kindergarten",
  "name": "Детский сад №10 Красное Село",
  "location": {
    "type": "Point",
    "coordinates": [30.0900, 59.7350]
  }
}
```

**`type: store`:**
```json
{
  "_id": ObjectId("682fc1a5e3b7f2001a4d5035"),
  "type": "store",
  "name": "Лента Колпино",
  "location": {
    "type": "Point",
    "coordinates": [30.5900, 59.7510]
  }
}
```

**`type: pickup_point`:**
```json
{
  "_id": ObjectId("682fc1a5e3b7f2001a4d5040"),
  "type": "pickup_point",
  "name": "Wildberries Пушкин",
  "location": {
    "type": "Point",
    "coordinates": [30.3980, 59.7150]
  }
}
```

**`type: bus_stop`:**
```json
{
  "_id": ObjectId("682fc1a5e3b7f2001a4d5045"),
  "type": "bus_stop",
  "name": "Остановка Зеленогорск вокзал",
  "location": {
    "type": "Point",
    "coordinates": [29.6989, 60.1956]
  }
}
```

**`type: negative`:**
```json
{
  "_id": ObjectId("682fc1a5e3b7f2001a4d5050"),
  "type": "negative",
  "subtype": "landfill",
  "name": "Полигон Новосёлки",
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
  "role": "admin",
  "created_at": ISODate("2026-03-01T14:02:33Z")
}
```

---

### Примеры запросов (нереляционная модель)

#### Текст запросов

#### Q1. Поиск, фильтрация и сортировка каталога (UC1)

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

#### Q2. Поиск по каталогу и ранжирование (UC1)

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

#### Q3. Просмотр деталей одного участка (UC2)

```javascript
// Шаг 1: Получить документ участка
db.plots.findOne(
  { _id: ObjectId("682fc1a5e3b7f2001a4d52c1") }
)

// Шаг 2: $geoNear к infra_objects и выбор ближайшего объекта по каждому type
db.infra_objects.aggregate([
  { $geoNear: { near: { type: "Point", coordinates: [29.884385, 59.837417] }, distanceField: "dist_meters", spherical: true } },
  { $sort: { type: 1, dist_meters: 1 } },
  { $group: { _id: "$type", name: { $first: "$name" }, dist_meters: { $first: "$dist_meters" } } }
])
```

#### Q4. Данные для карты (UC3)

```javascript
db.plots.find(
  {},
  { title: 1, price: 1, area_sotki: 1, geo_location: 1, total_score: 1, location: 1, features_text: 1 }
)
.skip(0)
.limit(200)
```

#### Q5. Создание объявления (UC5)

```javascript
// Шаг 1: $geoNear к infra_objects и выбор ближайшего объекта по каждому type
db.infra_objects.aggregate([
  {
    $geoNear: {
      near: { type: "Point", coordinates: [29.88, 59.84] },
      distanceField: "dist_meters",
      spherical: true
    }
  },
  { $sort: { type: 1, dist_meters: 1 } },
  { $group: { _id: "$type", name: { $first: "$name" }, dist_meters: { $first: "$dist_meters" } } }
])

// Шаг 2: Вставить документ
db.plots.insertOne({ ... })
```

#### Q6. Обновление объявления (UC6)

```javascript
// Шаг 1: Найти существующий
db.plots.findOne({ _id: ObjectId("...") })

// Шаг 2: (опционально) Пересчитать $geoNear к infra_objects при смене координат
// Шаг 3: Обновить
db.plots.updateOne(
  { _id: ObjectId("...") },
  { $set: { title: "Новый заголовок", updated_at: ISODate("2026-03-11T12:00:00Z"), ... } }
)

// Шаг 4: Получить обновлённый документ
db.plots.findOne({ _id: ObjectId("...") })
```

#### Q7. Удаление объявления (UC7, UC11)

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
  role: "user",
  created_at: ISODate("2026-03-11T12:00:00Z")
})

// Логин
db.users.findOne({ username: "ivan" })
```

#### Q9. Экспорт всех данных (UC8)

```javascript
db.plots.find({})
db.infra_objects.find({})
db.users.find({})
```

#### Q10. Импорт объявлений (UC9)

```javascript
db.plots.updateOne(
  { avito_id: 7547791865 },
  { $set: { ... } },
  { upsert: true }
)
```

#### Q11. Статистика (UC10)

```javascript
db.plots.countDocuments({})
db.infra_objects.countDocuments({})
db.users.countDocuments({})
```

#### Q12. CRUD инфраструктуры

```javascript
// Список объектов
db.infra_objects.find({ type: "metro_station" })

// Добавление
db.infra_objects.insertOne({
  type: "metro_station",
  name: "Новая станция",
  location: { type: "Point", coordinates: [30.35, 59.94] }
})

// Удаление
db.infra_objects.deleteOne({ _id: ObjectId("...") })

// Полная замена коллекции
db.infra_objects.deleteMany({ type: "metro_station" })
db.infra_objects.insertMany([...])
```

---

## Реляционная модель

### Графическое представление модели
![Схема реляционной модели](https://raw.githubusercontent.com/moevm/nsql1h26-land/main/docs/sql-model.png)
### Описание назначений коллекций, типов данных и сущностей

Для реляционной модели используются таблицы `plots`, `plot_features`, `plot_distances`, `users` и единая инфраструктурная таблица `infra_objects`.

Оценка среднего размера строки в `plots` (без учёта внешних таблиц):

| Группа полей | Среднее (байт) | Комментарий |
|-------------|------:|-----------|
| Идентификаторы (`id`, `avito_id`, `owner_id`) | 24 | 3 × bigint |
| Текстовые поля (`title`, `description`, `location`, `address`, `geo_ref`) | 1 220 | TOAST/varlena, средние значения; лимиты приложения: `description` до 80000, `address` до 2500 |
| Числа (`price`, `area_sotki`, `price_per_sotka`, `lat`, `lon`) | 40 | 5 × 8 байт |
| Гео (`geo_location`) | 32 | geography Point (через PostGIS) |
| Медиа/ссылки (`url`, `thumbnail`, `images_count`, `was_lowered`) | 277 | |
| Скоры и мета (`feature_score`, `features_text`, `infra_score`, `negative_score`, `total_score`, даты, `owner_name`) | 290 | |
| Оверхед строки PostgreSQL | ~80 | заголовок + выравнивание + null bitmap |
| **Итого `plots`** | **~1 963** | |

Оценка таблицы `plot_features` (15 признаков + PK/FK): **~160 байт/строка**.

Оценка таблицы `plot_distances` (8 пар `{name, km}` + PK/FK): **~520 байт/строка**.

Оценка таблицы `users`: **~190 байт/строка**.

Оценка таблицы `infra_objects` (`type`, `subtype`, `name`, `location`): **~160 байт/строка**.

### Оценка объёма информации

Обозначим:

- $N$ — количество участков (`plots`)
- $I$ — количество инфраструктурных объектов в `infra_objects`
- $U$ — количество пользователей

Тогда объём данных реляционной модели:

$$S_{\text{data,rel}}(N) = (1\,963 + 160 + 520)N + 160I + 190U = 2\,643N + 160I + 190U$$

Оценка индексов:

- `plots`: PK + `avito_id` + `price` + `area_sotki` + `total_score` + GiST(`geo_location`) ≈ **520 байт/участок**
- `plot_features` и `plot_distances`: PK/FK индексы ≈ **80 байт/участок**
- `infra_objects`: PK + GiST(`location`) + B-tree(`type`, `name`) + B-tree(`subtype`) ≈ **240 байт/объект**
- `users`: PK + unique(`username`) ≈ **80 байт/пользователь**

$$S_{\text{idx,rel}}(N) = 600N + 240I + 80U$$

Итоговая формула:

$$\boxed{S_{\text{total,rel}}(N) = 3\,243N + 400I + 270U}$$

При фиксированных $I=87$ и $U=10$:

$$S_{\text{total,rel}}(N) = 3\,243N + 37\,500$$

### Избыточность данных

$$S_{\text{clean,rel}}(N) = 1\,553N$$

Тогда коэффициент избыточности:

$$R_{\text{rel}}(N)=\frac{S_{\text{total,rel}}(N)}{S_{\text{clean,rel}}(N)}=\frac{3\,243N+400I+270U}{1\,553N}$$

При фиксированных $I=87$, $U=10$:

$$\boxed{R_{\text{rel}}(N)=\frac{3\,243N+37\,500}{1\,553N}=2.09+\frac{24.1}{N}}$$

### Направление роста модели

Рост по `N` остаётся главным: каждый новый участок добавляет строку в `plots`, `plot_features`, `plot_distances` и записи в индексах. Суммарный прирост близок к 3.24 КБ на объект.

Рост по `I` линейный и значительно медленнее, около 400 байт на инфраструктурный объект с учётом индексов.

Рост по `U` минимальный, около 270 байт на пользователя с индексами.

Основная нагрузка на чтение возникает в сценариях с `JOIN` таблиц `plots` + `plot_features` + `plot_distances` и в геозапросах PostGIS по GiST-индексу.

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
  ST_SetSRID(ST_MakePoint(29.884385, 59.837417), 4326)::geography, -- PostGIS
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
INSERT INTO users (id, username, password_hash, role, created_at)
VALUES (1, 'admin', 'a1b2c3d4e5f6...64 hex chars', 'admin', NOW());

-- infra_objects
INSERT INTO infra_objects (id, type, subtype, name, location)
VALUES (101, 'metro_station', NULL, 'Проспект Ветеранов', ST_SetSRID(ST_MakePoint(30.2501, 59.8418), 4326)::geography);

INSERT INTO infra_objects (id, type, subtype, name, location)
VALUES (201, 'negative', 'landfill', 'Полигон Новосёлки', ST_SetSRID(ST_MakePoint(30.2188, 60.0872), 4326)::geography);
```

### Примеры запросов (реляционная модель)

Во всех запросах ниже функции `ST_SetSRID`, `ST_MakePoint`, `ST_Distance`, операторы `<->`, `ST_X`, `ST_Y` относятся к расширению **PostGIS**.

#### Текст запросов

#### Q1. Поиск, фильтрация и сортировка каталога (UC1)

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

#### Q2. Поиск по каталогу и ранжирование (UC1)

```sql
SELECT p.id, p.title, p.description, p.price, p.area_sotki, p.total_score
FROM plots p
WHERE p.price BETWEEN 500000 AND 3000000
  AND p.area_sotki >= 5
ORDER BY p.total_score DESC
LIMIT 100;
```

#### Q3. Просмотр деталей одного участка (UC2)

```sql
SELECT p.*, pf.*, pd.*
FROM plots p
LEFT JOIN plot_features pf ON pf.plot_id = p.id
LEFT JOIN plot_distances pd ON pd.plot_id = p.id
WHERE p.id = 12345;
```

#### Q4. Данные для карты (UC3)

```sql
SELECT p.id, p.title, p.price, p.area_sotki,
       ST_Y(p.geo_location::geometry) AS lat,
       ST_X(p.geo_location::geometry) AS lon,
       p.total_score, p.location, p.features_text
FROM plots p
ORDER BY p.id
LIMIT 200 OFFSET 0;
```

#### Q5. Создание объявления (UC5)

```sql
-- Шаг 1: найти ближайшие объекты по каждому type в одной таблице infra_objects
WITH p AS (
  SELECT ST_SetSRID(ST_MakePoint(29.88, 59.84), 4326)::geography AS p_in
), ranked AS (
  SELECT i.type,
         i.name,
         ST_Distance(p.p_in, i.location) / 1000.0 AS km,
         ROW_NUMBER() OVER (PARTITION BY i.type ORDER BY i.location <-> p.p_in) AS rn
  FROM infra_objects i
  CROSS JOIN p
)
SELECT type, name, km
FROM ranked
WHERE rn = 1;

-- Шаг 2: вставка участка
INSERT INTO plots (avito_id, title, description, price, area_sotki, geo_location, created_at)
VALUES (7547791865, 'Новый участок', 'Описание...', 1400000, 4.0,
        ST_SetSRID(ST_MakePoint(29.88, 59.84), 4326)::geography, NOW())
RETURNING id;

-- Шаг 3: вставка производных данных
INSERT INTO plot_features (plot_id, has_gas, has_electricity, has_water)
VALUES (12345, 0.37, 0.32, 0.52);

INSERT INTO plot_distances (plot_id, nearest_metro_name, nearest_metro_km)
VALUES (12345, 'Проспект Ветеранов', 8.45);
```

#### Q6. Обновление объявления (UC6)

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

#### Q7. Удаление объявления (UC7, UC11)

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

INSERT INTO users (username, password_hash, role, created_at)
VALUES ('ivan', '...', 'user', NOW());

-- Логин
SELECT id, username, password_hash, role
FROM users
WHERE username = 'ivan';
```

#### Q9. Экспорт всех данных (UC8)

```sql
SELECT * FROM plots;
SELECT * FROM plot_features;
SELECT * FROM plot_distances;
SELECT * FROM infra_objects;
SELECT * FROM users;
```

#### Q10. Импорт объявлений (UC9)

```sql
INSERT INTO plots (avito_id, title, price, area_sotki, geo_location, created_at)
VALUES (7547791865, 'Участок', 1400000, 4.0,
        ST_SetSRID(ST_MakePoint(29.88, 59.84), 4326)::geography, NOW())
ON CONFLICT (avito_id) DO UPDATE
SET title = EXCLUDED.title,
    price = EXCLUDED.price,
    area_sotki = EXCLUDED.area_sotki,
    geo_location = EXCLUDED.geo_location,
    updated_at = NOW();
```

#### Q11. Статистика (UC10)

```sql
SELECT COUNT(*) FROM plots;
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM plot_features;
SELECT COUNT(*) FROM plot_distances;
SELECT COUNT(*) FROM infra_objects;
```

#### Q12. CRUD инфраструктуры

```sql
-- Список объектов
SELECT * FROM infra_objects WHERE type = 'metro_station';

-- Добавление
INSERT INTO infra_objects (type, subtype, name, location)
VALUES ('metro_station', NULL, 'Новая станция', ST_SetSRID(ST_MakePoint(30.35, 59.94), 4326)::geography);

-- Удаление
DELETE FROM infra_objects WHERE id = 777;

-- Полная замена данных
DELETE FROM infra_objects WHERE type = 'metro_station';
INSERT INTO infra_objects (type, subtype, name, location) VALUES
  ('metro_station', NULL, 'Станция 1', ST_SetSRID(ST_MakePoint(30.25, 59.84), 4326)::geography),
  ('metro_station', NULL, 'Станция 2', ST_SetSRID(ST_MakePoint(30.31, 59.90), 4326)::geography);
```

### Сравнение моделей

| Use Case | Описание | Реляционная модель | Нереляционная модель | Зависимость от N / I |
|----------|----------|--------------------|----------------------|----------------------|
| **UC1** Поиск и фильтрация | Каталог с поиском, фильтрами, сортировкой и пагинацией | 2 запроса, 1 таблица (`plots`) | 2 запроса, 1 коллекция (`plots`) | O(log N), худший O(N) |
| **UC2** Детали участка | Карточка объекта + расстояния | 1 запрос, 3 таблицы (`plots`, `plot_features`, `plot_distances`) | 2 запроса, 2 коллекции (`plots` + `infra_objects`) | O(1) с индексами |
| **UC3** Карта | Пакетная загрузка маркеров | 1 + ⌈N/200⌉ запросов, 1 таблица (`plots`) | 1 + ⌈N/200⌉ запросов, 1 коллекция (`plots`) | O(N) суммарно |
| **UC4** Переход на Авито | Клиентский редирект | 0 | 0 | - |
| **UC5** Создание участка | Геообогащение + сохранение | 4 запроса, 4 таблицы | 2 запроса, 2 коллекции | O(1) с индексами |
| **UC6** Редактирование своего участка | Чтение + обновление (+гео при смене координат) | 3-5 запросов, 1-4 таблицы | 3-4 запроса, 1-2 коллекции | O(1) |
| **UC7** Удаление своего участка | Проверка владельца + удаление | 2 запроса, 1 таблица (`plots`) | 2 запроса, 1 коллекция (`plots`) | O(1) |
| **UC8** Экспорт | Выгрузка всех сущностей | 5 запросов, 5 таблиц | 3 запроса, 3 коллекции | O(N + I + U) |
| **UC9** Импорт данных | Пакетный upsert/обогащение | 4 × M запросов, 4 таблицы | 2 × M запросов, 2 коллекции | O(M) |
| **UC10** Просмотр статистики | Подсчёты по сущностям | 5 запросов, 5 таблиц | 3 запроса, 3 коллекции | O(1) |
| **UC11** Удаление любого участка | Проверка прав и удаление | 2 запроса, 1 таблица (`plots`) | 2 запроса, 1 коллекция (`plots`) | O(1) |



## Вывод

По итогам сравнения обе модели рабочие и после унификации инфраструктуры дают сопоставимую сложность прикладной логики.

Сравнение формул объёма при одинаковых $I$ и $U$:
- нереляционная: $S_{total,doc}(N)=2753N+445I+139U$
- реляционная: $S_{total,rel}(N)=3243N+400I+270U$

Разность объёма (реляционная минус нереляционная):

$$\Delta S(N)=S_{total,rel}(N)-S_{total,doc}(N)=490N-45I+131U$$

При $I=87$, $U=10$:

$$\Delta S(N)=490N-2615$$

Нереляционная модель по этой укрупнённой оценке остаётся компактнее по коэффициенту при $N$, но разницу в сотни байт/запись нельзя трактовать как точный инженерный результат без фактических замеров на реальной СУБД.

Сравнение формул избыточности:
- нереляционная: $R_{doc}(N)=1.73+\frac{25.1}{N}$
- реляционная: $R_{rel}(N)=2.09+\frac{24.1}{N}$

Разность избыточности:

$$\Delta R(N)=R_{rel}(N)-R_{doc}(N)=0.36-\frac{1.0}{N}$$

Асимптотически сохраняется разница в пользу документной модели, но этот вывод относится к порядку роста, а не к точному абсолютному числу байт.

Сравнение на практических масштабах (при $I=87$, $U=10$):

| N | $S_{total,doc}(N)$ | $S_{total,rel}(N)$ | Экономия нереляционной |
|---:|---:|---:|---:|
| 1 000 | 2 793 105 байт | 3 280 500 байт | 487 395 байт |
| 2 174 | 6 027 327 байт | 7 087 782 байт | 1 060 455 байт |
| 10 000 | 27 570 105 байт | 32 467 500 байт | 4 897 395 байт |

Важно: приведённые оценки объёма являются приближёнными. На практике на итоговый объём и производительность влияют TOAST/сжатие, MVCC, WAL, fillfactor, внутренние структуры индексов, версия СУБД, конфигурация и профиль запросов. Поэтому эти формулы корректно использовать для сравнения тенденций роста, а не для точного выбора по числам в килобайтах.

Итог:
- обе СУБД позволяют реализовать сценарии проекта на сопоставимом уровне качества
- и PostgreSQL, и MongoDB поддерживают ACID-транзакции; различия для этой системы в основном в моделировании связей и прикладной реализации
- ключевой практический компромисс: в PostgreSQL нужны расширения (PostGIS) для геооператоров, в MongoDB геопоиск (`$geoNear`) встроен
- дополнительный риск для MongoDB в текущей схеме: внешняя ссылка `plots.owner_id -> users` не контролируется FK на уровне БД

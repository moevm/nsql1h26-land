"""
Моковые данные инфраструктуры (Санкт-Петербург / Ленинградская область).

Каждый объект хранится в формате GeoJSON для поддержки $geoNear / 2dsphere.
coordinates = [lng, lat]  (по спецификации GeoJSON)
"""

from config import (
    COL_METRO, COL_HOSPITALS, COL_SCHOOLS,
    COL_KINDERGARTENS, COL_STORES, COL_PICKUP_POINTS,
    COL_BUS_STOPS, COL_NEGATIVE,
)


def _pt(lng: float, lat: float) -> dict:
    return {"type": "Point", "coordinates": [lng, lat]}


MOCK_METRO = [
    {"name": "Проспект Ветеранов", "location": _pt(30.2501, 59.8418)},
    {"name": "Ленинский проспект",  "location": _pt(30.2676, 59.8507)},
    {"name": "Автово",              "location": _pt(30.2614, 59.8675)},
    {"name": "Кировский завод",     "location": _pt(30.2622, 59.8790)},
    {"name": "Московская",          "location": _pt(30.3179, 59.8497)},
    {"name": "Звёздная",            "location": _pt(30.3494, 59.8333)},
    {"name": "Купчино",             "location": _pt(30.3752, 59.8295)},
    {"name": "Девяткино",           "location": _pt(30.4428, 60.0503)},
    {"name": "Парнас",              "location": _pt(30.3339, 60.0670)},
    {"name": "Рыбацкое",            "location": _pt(30.5100, 59.8308)},
    {"name": "Ладожская",           "location": _pt(30.4391, 59.9320)},
    {"name": "Площадь Восстания",   "location": _pt(30.3601, 59.9307)},
    {"name": "Невский проспект",    "location": _pt(30.3186, 59.9352)},
    {"name": "Гостиный двор",       "location": _pt(30.3326, 59.9343)},
    {"name": "Василеостровская",    "location": _pt(30.2783, 59.9427)},
]

MOCK_HOSPITALS = [
    {"name": "Александровская больница",          "location": _pt(30.3894, 59.8663)},
    {"name": "Мариинская больница",               "location": _pt(30.3549, 59.9211)},
    {"name": "ВМА им. Кирова",                    "location": _pt(30.3497, 59.9422)},
    {"name": "Елизаветинская больница",            "location": _pt(30.3178, 59.8946)},
    {"name": "Городская больница №40 Сестрорецк",  "location": _pt(29.9620, 60.0962)},
    {"name": "Всеволожская ЦРБ",                  "location": _pt(30.6397, 60.0236)},
    {"name": "Гатчинская ЦРБ",                    "location": _pt(30.1266, 59.5680)},
    {"name": "Ломоносовская больница",             "location": _pt(29.7708, 59.9062)},
    {"name": "Тосненская ЦРБ",                    "location": _pt(30.8765, 59.5407)},
]

MOCK_SCHOOLS = [
    {"name": "Школа №1 Красное Село",    "location": _pt(30.0849, 59.7382)},
    {"name": "Школа №2 Пушкин",          "location": _pt(30.3971, 59.7140)},
    {"name": "Школа №3 Колпино",          "location": _pt(30.5877, 59.7497)},
    {"name": "Школа №4 Всеволожск",       "location": _pt(30.6523, 60.0192)},
    {"name": "Школа №5 Гатчина",          "location": _pt(30.1300, 59.5700)},
    {"name": "Школа №6 Петергоф",         "location": _pt(29.9094, 59.8763)},
    {"name": "Школа №7 Сестрорецк",       "location": _pt(29.9640, 60.0938)},
    {"name": "Школа №8 Ломоносов",        "location": _pt(29.7732, 59.9111)},
    {"name": "Школа №9 Тосно",            "location": _pt(30.8770, 59.5400)},
    {"name": "Школа №10 Кировск",         "location": _pt(30.9867, 59.8811)},
]

MOCK_KINDERGARTENS = [
    {"name": "Детский сад №10 Красное Село",  "location": _pt(30.0900, 59.7350)},
    {"name": "Детский сад №15 Пушкин",        "location": _pt(30.4000, 59.7170)},
    {"name": "Детский сад №22 Колпино",        "location": _pt(30.5850, 59.7480)},
    {"name": "Детский сад №3 Всеволожск",      "location": _pt(30.6500, 60.0180)},
    {"name": "Детский сад №7 Гатчина",         "location": _pt(30.1350, 59.5720)},
    {"name": "Детский сад №5 Петергоф",        "location": _pt(29.9100, 59.8800)},
    {"name": "Детский сад №12 Сестрорецк",     "location": _pt(29.9650, 60.0950)},
    {"name": "Детский сад №8 Ломоносов",       "location": _pt(29.7750, 59.9080)},
]

MOCK_STORES = [
    {"name": "Пятёрочка Красное Село",     "location": _pt(30.0870, 59.7390)},
    {"name": "Магнит Пушкин",              "location": _pt(30.3950, 59.7160)},
    {"name": "Лента Колпино",              "location": _pt(30.5900, 59.7510)},
    {"name": "Окей Всеволожск",            "location": _pt(30.6480, 60.0200)},
    {"name": "Пятёрочка Гатчина",          "location": _pt(30.1280, 59.5690)},
    {"name": "Дикси Петергоф",             "location": _pt(29.9050, 59.8770)},
    {"name": "Магнит Сестрорецк",          "location": _pt(29.9660, 60.0925)},
    {"name": "Перекрёсток Девяткино",       "location": _pt(30.4450, 60.0510)},
    {"name": "Лента Парнас",               "location": _pt(30.3350, 60.0680)},
    {"name": "Ашан Пулково",               "location": _pt(30.3360, 59.8200)},
]

MOCK_PICKUP_POINTS = [
    {"name": "Ozon Красное Село",          "location": _pt(30.0830, 59.7400)},
    {"name": "Wildberries Пушкин",         "location": _pt(30.3980, 59.7150)},
    {"name": "Яндекс.Маркет Колпино",      "location": _pt(30.5860, 59.7500)},
    {"name": "Ozon Всеволожск",            "location": _pt(30.6510, 60.0210)},
    {"name": "Wildberries Гатчина",        "location": _pt(30.1290, 59.5710)},
    {"name": "Ozon Петергоф",              "location": _pt(29.9120, 59.8780)},
    {"name": "Wildberries Сестрорецк",     "location": _pt(29.9660, 60.0940)},
    {"name": "Яндекс.Маркет Девяткино",    "location": _pt(30.4440, 60.0520)},
    {"name": "Ozon Парнас",                "location": _pt(30.3360, 60.0690)},
]

MOCK_BUS_STOPS = [
    {"name": "Остановка Красное Село центр",   "location": _pt(30.0850, 59.7370)},
    {"name": "Остановка Пушкин вокзал",        "location": _pt(30.3930, 59.7200)},
    {"name": "Остановка Колпино площадь",      "location": _pt(30.5880, 59.7490)},
    {"name": "Остановка Всеволожск центр",     "location": _pt(30.6530, 60.0195)},
    {"name": "Остановка Гатчина вокзал",       "location": _pt(30.1240, 59.5680)},
    {"name": "Остановка Петергоф фонтаны",     "location": _pt(29.9085, 59.8760)},
    {"name": "Остановка Сестрорецк пляж",      "location": _pt(29.9700, 60.0960)},
    {"name": "Остановка Ломоносов парк",       "location": _pt(29.7740, 59.9100)},
    {"name": "Остановка Токсово лес",          "location": _pt(30.5230, 60.1530)},
    {"name": "Остановка Зеленогорск вокзал",   "location": _pt(29.6989, 60.1956)},
    {"name": "Остановка Мга центр",            "location": _pt(31.0500, 59.7600)},
    {"name": "Остановка Кировск площадь",      "location": _pt(30.9870, 59.8800)},
]

MOCK_NEGATIVE = [
    {"name": "Полигон Новый Свет (свалка)",        "type": "landfill",      "location": _pt(30.5700, 59.7580)},
    {"name": "Полигон Новосёлки",                  "type": "landfill",      "location": _pt(30.2188, 60.0872)},
    {"name": "Полигон Красный Бор",                "type": "landfill",      "location": _pt(30.7260, 59.6744)},
    {"name": "Промзона Обухово",                   "type": "industrial",    "location": _pt(30.4573, 59.8481)},
    {"name": "Промзона Металлострой",              "type": "industrial",    "location": _pt(30.5574, 59.8044)},
    {"name": "Промзона Парнас",                    "type": "industrial",    "location": _pt(30.3340, 60.0760)},
    {"name": "КАД южный участок (шум)",            "type": "highway",       "location": _pt(30.1700, 59.7330)},
    {"name": "КАД северный участок (шум)",         "type": "highway",       "location": _pt(30.3150, 60.0670)},
    {"name": "Очистные Красное Село",              "type": "sewage_plant",  "location": _pt(30.0600, 59.7200)},
    {"name": "Промзона Кировский",                 "type": "industrial",    "location": _pt(30.2300, 59.8750)},
    {"name": "ИК-6 Обухово (колония)",             "type": "prison",        "location": _pt(30.4700, 59.8400)},
    {"name": "СИЗО-1 Кресты",                      "type": "prison",        "location": _pt(30.3720, 59.9550)},
    {"name": "Промзона Шушары",                    "type": "industrial",    "location": _pt(30.3900, 59.7800)},
    {"name": "ТЭЦ Южная",                         "type": "power_plant",   "location": _pt(30.3500, 59.8100)},
]


MOCK_DATA = {
    COL_METRO:         MOCK_METRO,
    COL_HOSPITALS:     MOCK_HOSPITALS,
    COL_SCHOOLS:       MOCK_SCHOOLS,
    COL_KINDERGARTENS: MOCK_KINDERGARTENS,
    COL_STORES:        MOCK_STORES,
    COL_PICKUP_POINTS: MOCK_PICKUP_POINTS,
    COL_BUS_STOPS:     MOCK_BUS_STOPS,
    COL_NEGATIVE:      MOCK_NEGATIVE,
}

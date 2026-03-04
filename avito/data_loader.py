"""
Загрузка и нормализация данных из JSON-файла Авито.
"""

import json
import re
from typing import Optional


def load_json(path: str) -> list[dict]:
    """Загружает сырой JSON-массив объявлений."""
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def parse_area_from_title(title: str) -> Optional[float]:
    """Извлекает площадь в сотках из заголовка: 'Участок 6 сот.' → 6.0"""
    m = re.search(r"(\d+[.,]?\d*)\s*сот", title, re.IGNORECASE)
    if m:
        return float(m.group(1).replace(",", "."))
    m = re.search(r"(\d+[.,]?\d*)\s*га", title, re.IGNORECASE)
    if m:
        return float(m.group(1).replace(",", ".")) * 100
    return None


def parse_price_per_sotka(normalized_price: Optional[str], price: float, area: Optional[float]) -> Optional[float]:
    """Извлекает цену за сотку."""
    if normalized_price:
        m = re.search(r"([\d\s]+)\s*₽\s*за\s*сотку", normalized_price)
        if m:
            return float(m.group(1).replace(" ", "").replace("\u00a0", ""))
    if price and area and area > 0:
        return price / area
    return None


def normalize_records(raw_data: list[dict]) -> list[dict]:
    """
    Преобразует сырые JSON-записи в нормализованный формат.
    Отбрасывает записи без координат.
    """
    records = []
    for item in raw_data:
        lat = item.get("lat")
        lng = item.get("lng")
        if not lat or not lng:
            continue

        title = item.get("title", "")
        description = item.get("description", "")
        price = item.get("price", 0)

        area = parse_area_from_title(title)
        if area is None:
            m = re.search(r"(\d+[.,]?\d*)\s*сот", description, re.IGNORECASE)
            if m:
                area = float(m.group(1).replace(",", "."))

        price_per_sotka = parse_price_per_sotka(
            item.get("normalizedPrice"), price, area
        )

        record = {
            "avito_id":        item["id"],
            "title":           title,
            "description":     description,
            "price":           price,
            "area_sotki":      area,
            "price_per_sotka": price_per_sotka,
            "location":        item.get("locationName", ""),
            "address":         item.get("addressFull", ""),
            "geo_ref":         item.get("geoReferences", ""),
            "lat":             lat,
            "lon":             lng,
            "url":             item.get("url", ""),
            "thumbnail":       item.get("thumbnail", ""),
            "images_count":    item.get("imagesCount", 0),
            "was_lowered":     item.get("wasLowered", False),
        }
        records.append(record)

    return records


def load_and_normalize(path: str) -> list[dict]:
    """Полный пайплайн загрузки: JSON → нормализованные записи."""
    raw = load_json(path)
    return normalize_records(raw)

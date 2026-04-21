"""
Общие утилиты бэкенда.
"""

import re
from typing import Optional

from bson import ObjectId
from datetime import datetime


def serialize_doc(doc: dict) -> dict:
    """Конвертирует MongoDB-документ в сериализуемый dict."""
    doc["_id"] = str(doc["_id"])
    return doc


def _serialize_value(value):
    """Рекурсивно приводит значение к JSON-сериализуемому виду."""
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, dict):
        return serialize_doc_deep(value)
    if isinstance(value, list):
        return [_serialize_value(item) for item in value]
    return value


def serialize_doc_deep(doc: dict) -> dict:
    """Рекурсивно конвертирует MongoDB-документ в JSON-сериализуемый dict."""
    for key, value in list(doc.items()):
        doc[key] = _serialize_value(value)
    return doc


def parse_area(title: str, description: str) -> Optional[float]:
    """Извлекает площадь в сотках из заголовка/описания."""
    for text in [title, description]:
        m = re.search(r"(\d+[.,]?\d*)\s*сот", text, re.IGNORECASE)
        if m:
            return float(m.group(1).replace(",", "."))
        m = re.search(r"(\d+[.,]?\d*)\s*га", text, re.IGNORECASE)
        if m:
            return float(m.group(1).replace(",", ".")) * 100
    return None

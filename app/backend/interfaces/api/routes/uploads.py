from __future__ import annotations

import os
import secrets
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from domain.entities import User
from interfaces.api.deps import get_current_user

router = APIRouter(prefix="/api/uploads", tags=["uploads"])

UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "/app/uploads"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
MAX_BYTES = 10 * 1024 * 1024


@router.post("/image")
async def upload_image(
    file: UploadFile = File(...),
    _: User = Depends(get_current_user),
):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(400, f"Недопустимый формат изображения: {ext or 'unknown'}")

    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(400, "Файл больше 10 MB")
    if not data:
        raise HTTPException(400, "Пустой файл")

    name = f"{secrets.token_urlsafe(16)}{ext}"
    path = UPLOAD_DIR / name
    with open(path, "wb") as f:
        f.write(data)
    return {"url": f"/uploads/{name}"}

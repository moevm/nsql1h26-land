from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse

from domain.entities import User
from domain.exceptions import ValidationError
from infrastructure.config import get_settings
from interfaces.api.deps import (
    get_clear_collection_use_case,
    get_export_all_use_case,
    get_export_collection_use_case,
    get_import_plots_use_case,
    get_stats_use_case,
    require_admin,
)

router = APIRouter(prefix="/api/data", tags=["data-io"])

settings = get_settings()


@router.get("/export")
async def export_all(user: User = Depends(require_admin)):
    use_case = get_export_all_use_case()
    result = await use_case.execute(user)
    return JSONResponse(content=jsonable_encoder(result))


@router.get("/export/{collection}")
async def export_collection(
    collection: str,
    user: User = Depends(require_admin),
):
    use_case = get_export_collection_use_case()
    try:
        result = await use_case.execute(collection, user)
    except ValidationError as e:
        raise HTTPException(400, str(e))
    return JSONResponse(content=jsonable_encoder(result))


@router.post("/import/plots")
async def import_plots(
    records: list[dict],
    user: User = Depends(require_admin),
):
    use_case = get_import_plots_use_case()
    inserted = await use_case.execute(records, user)
    return {"inserted": inserted}


@router.delete("/clear/{collection}")
async def clear_collection(
    collection: str,
    user: User = Depends(require_admin),
):
    use_case = get_clear_collection_use_case()
    try:
        deleted = await use_case.execute(collection, user)
    except ValidationError as e:
        raise HTTPException(400, str(e))
    return {"deleted": deleted, "collection": collection}


@router.get("/stats")
async def get_stats(user: User = Depends(require_admin)):
    use_case = get_stats_use_case()
    return await use_case.execute(user)

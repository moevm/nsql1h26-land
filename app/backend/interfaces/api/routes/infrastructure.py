from fastapi import APIRouter, Depends, HTTPException

from domain.entities import User
from domain.exceptions import NotFoundError
from interfaces.api.deps import (
    _get_settings,
    get_create_infra_object_use_case,
    get_delete_infra_object_use_case,
    get_list_infra_objects_use_case,
    get_list_infra_types_use_case,
    get_replace_infra_collection_use_case,
    require_admin,
)
from interfaces.api.schemas import InfraObjectCreate, InfraObjectOut

router = APIRouter(prefix="/api/infra", tags=["infrastructure"])


@router.get("/collections")
async def list_collections(
    use_case=Depends(get_list_infra_types_use_case),
):
    return {"collections": use_case.execute()}


@router.get("/{collection}", response_model=list[InfraObjectOut])
async def list_objects(
    collection: str,
    use_case=Depends(get_list_infra_objects_use_case),
):
    settings = _get_settings()
    if collection not in settings.infra_slugs:
        raise HTTPException(400, f"Unknown collection: {collection}")
    objects = await use_case.execute(collection)
    return [
        InfraObjectOut(_id=o.id, name=o.name, lat=o.lat, lon=o.lon, type=o.type)
        for o in objects
    ]


@router.post("/{collection}", response_model=InfraObjectOut, status_code=201)
async def add_object(
    collection: str,
    data: InfraObjectCreate,
    user: User = Depends(require_admin),
    use_case=Depends(get_create_infra_object_use_case),
):
    settings = _get_settings()
    if collection not in settings.infra_slugs:
        raise HTTPException(400, f"Unknown collection: {collection}")

    extra = {}
    if data.type and collection == settings.infra_slug_to_type.get("negative_objects"):
        extra["subtype"] = data.type

    obj = await use_case.execute(collection, {**data.model_dump(), **extra}, user)
    return InfraObjectOut(_id=obj.id, name=obj.name, lat=obj.lat, lon=obj.lon, type=obj.type)


@router.delete("/{collection}/{object_id}", status_code=204)
async def delete_object(
    collection: str,
    object_id: str,
    user: User = Depends(require_admin),
    use_case=Depends(get_delete_infra_object_use_case),
):
    settings = _get_settings()
    if collection not in settings.infra_slugs:
        raise HTTPException(400, f"Unknown collection: {collection}")
    try:
        await use_case.execute(collection, object_id, user)
    except NotFoundError:
        raise HTTPException(404, "Object not found")


@router.put("/{collection}")
async def replace_collection(
    collection: str,
    data: list[InfraObjectCreate],
    user: User = Depends(require_admin),
    use_case=Depends(get_replace_infra_collection_use_case),
):
    settings = _get_settings()
    if collection not in settings.infra_slugs:
        raise HTTPException(400, f"Unknown collection: {collection}")

    objects_data = []
    for item in data:
        d = {"name": item.name, "lat": item.lat, "lon": item.lon}
        if item.type and collection == settings.infra_slug_to_type.get("negative_objects"):
            d["subtype"] = item.type
        objects_data.append(d)

    count = await use_case.execute(collection, objects_data, user)
    return {"replaced": count, "collection": collection}

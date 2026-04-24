from fastapi import APIRouter, HTTPException

from config import COL_PLOTS
from database import get_db, get_user_repo
from models import SellerProfileOut

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get(
    "/{username}/profile",
    response_model=SellerProfileOut,
    responses={404: {"description": "User not found"}},
)
async def get_seller_profile(username: str):
    repo = get_user_repo()
    user = await repo.find_by_username(username)
    if not user:
        raise HTTPException(404, "User not found")

    db = get_db()
    owner_id = str(user["_id"])
    pipeline = [
        {
            "$match": {
                "$or": [
                    {"owner_id": owner_id},
                    {"owner_name": username},
                ]
            }
        },
        {
            "$group": {
                "_id": None,
                "plots_total": {"$sum": 1},
                "avg_total_score": {"$avg": "$total_score"},
                "avg_price_per_sotka": {"$avg": "$price_per_sotka"},
            }
        },
    ]

    cursor = db[COL_PLOTS].aggregate(pipeline)
    rows = await cursor.to_list(length=1)
    stats = rows[0] if rows else {}

    avg_total_score = stats.get("avg_total_score")
    avg_price_per_sotka = stats.get("avg_price_per_sotka")

    return SellerProfileOut(
        username=user["username"],
        role=user.get("role", "user"),
        member_since=user.get("created_at"),
        plots_total=int(stats.get("plots_total", 0)),
        avg_total_score=round(float(avg_total_score), 4) if avg_total_score is not None else None,
        avg_price_per_sotka=round(float(avg_price_per_sotka), 2) if avg_price_per_sotka is not None else None,
    )

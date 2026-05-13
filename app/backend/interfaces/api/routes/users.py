from fastapi import APIRouter, HTTPException

from domain.repository_interfaces import PlotRepositoryInterface
from interfaces.api.deps import get_plot_repo, get_user_repo
from interfaces.api.schemas import SellerProfileOut

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/{username}/profile", response_model=SellerProfileOut)
async def get_seller_profile(username: str):
    user_repo = get_user_repo()
    plot_repo = get_plot_repo()

    user = await user_repo.find_by_username(username)
    if not user:
        raise HTTPException(404, "User not found")

    pipeline = [
        {
            "$match": {
                "$or": [
                    {"owner_id": user.id},
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

    rows = await plot_repo.aggregate(pipeline)
    stats = rows[0] if rows else {}

    avg_total_score = stats.get("avg_total_score")
    avg_price_per_sotka = stats.get("avg_price_per_sotka")

    return SellerProfileOut(
        username=user.username,
        role=user.role,
        member_since=user.created_at,
        plots_total=int(stats.get("plots_total", 0)),
        avg_total_score=round(float(avg_total_score), 4) if avg_total_score is not None else None,
        avg_price_per_sotka=round(float(avg_price_per_sotka), 2) if avg_price_per_sotka is not None else None,
    )

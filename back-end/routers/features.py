from fastapi import APIRouter

from utils.feature_flags import marketplace_enabled


router = APIRouter()


@router.get("/api/features")
async def feature_flags():
    return {"marketplace": marketplace_enabled()}

from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.club_admin import router as club_admin_router
from app.api.v1.public import router as public_router
from app.api.v1.superadmin import router as superadmin_router

api_v1_router = APIRouter(prefix="/api/v1")
api_v1_router.include_router(auth_router)
api_v1_router.include_router(club_admin_router)
api_v1_router.include_router(superadmin_router)
api_v1_router.include_router(public_router)

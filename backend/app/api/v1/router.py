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

# v1_router with prefix "/v1" handles reverse proxies that strip the "/api" prefix (e.g. proxy_pass ...:8004/)
v1_router = APIRouter(prefix="/v1", include_in_schema=False)
v1_router.include_router(auth_router)
v1_router.include_router(club_admin_router)
v1_router.include_router(superadmin_router)
v1_router.include_router(public_router)


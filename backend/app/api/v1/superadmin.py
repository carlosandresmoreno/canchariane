from datetime import UTC, datetime, time
from typing import Annotated
from uuid import UUID

import uuid6
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_superadmin
from app.application.dto.auth import UserContext
from app.application.dto.superadmin import (
    SuperadminClubCreateRequest,
    SuperadminClubResponse,
    SuperadminClubUpdateRequest,
    SuperadminMembershipCreateRequest,
    SuperadminMembershipResponse,
    SuperadminStatsResponse,
)
from app.infrastructure.db.models import (
    BlockModel,
    BookingEventModel,
    BookingModel,
    BusinessHoursModel,
    ClubLayoutModel,
    ClubMemberModel,
    ClubModel,
    CourtModel,
    PaymentModel,
    PricingRuleModel,
    UserModel,
)
from app.infrastructure.security.password import hash_password

router = APIRouter(prefix="/superadmin", tags=["Superadmin"])


@router.get("/stats", response_model=SuperadminStatsResponse)
async def get_system_stats(
    _: Annotated[UserContext, Depends(require_superadmin)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SuperadminStatsResponse:
    """Returns platform-wide KPIs for superadministrators."""
    total_clubs = await db.scalar(select(func.count(ClubModel.id)).where(ClubModel.deleted_at.is_(None))) or 0
    active_clubs = (
        await db.scalar(
            select(func.count(ClubModel.id)).where(
                ClubModel.subscription_status == "active",
                ClubModel.deleted_at.is_(None),
            )
        )
        or 0
    )
    published_clubs = (
        await db.scalar(
            select(func.count(ClubModel.id)).where(
                ClubModel.is_published.is_(True),
                ClubModel.deleted_at.is_(None),
            )
        )
        or 0
    )
    total_courts = (
        await db.scalar(select(func.count(CourtModel.id)).where(CourtModel.deleted_at.is_(None)))
        or 0
    )
    total_users = await db.scalar(select(func.count(UserModel.id))) or 0
    total_bookings = await db.scalar(select(func.count(BookingModel.id))) or 0

    return SuperadminStatsResponse(
        total_clubs=total_clubs,
        active_clubs=active_clubs,
        published_clubs=published_clubs,
        total_courts=total_courts,
        total_users=total_users,
        total_bookings=total_bookings,
    )


@router.post(
    "/clubs",
    response_model=SuperadminClubResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_club(
    data: SuperadminClubCreateRequest,
    _: Annotated[UserContext, Depends(require_superadmin)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SuperadminClubResponse:
    """Creates a new sports club tenant globally and optionally assigns an administrator."""
    # Check slug collision
    existing = await db.scalar(select(ClubModel).where(ClubModel.slug == data.slug.lower().strip()))
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Ya existe un club con el slug '{data.slug}'",
        )

    club = ClubModel(
        id=uuid6.uuid7(),
        name=data.name.strip(),
        slug=data.slug.lower().strip(),
        timezone=data.timezone,
        address=data.address,
        phone=data.phone,
        subscription_status=data.subscription_status,
        is_published=data.is_published,
        settings={
            "currency": data.currency.upper(),
            "allowed_durations": [60],
            "default_duration": 60,
            **({"email": data.email} if data.email else {}),
        },
    )
    db.add(club)

    # Initialize standard default business hours (Monday-Sunday 06:00-23:00)
    for weekday in range(7):
        bh = BusinessHoursModel(
            id=uuid6.uuid7(),
            club_id=club.id,
            weekday=weekday,
            opens_at=time(6, 0),
            closes_at=time(23, 0),
            closes_next_day=False,
        )
        db.add(bh)

    # Optional initial administrator assignment
    members_count = 0
    if data.admin_user_email:
        clean_email = data.admin_user_email.lower().strip()
        admin_user = await db.scalar(
            select(UserModel).where(UserModel.email == clean_email)
        )
        if not admin_user:
            admin_user = UserModel(
                id=uuid6.uuid7(),
                email=clean_email,
                password_hash=hash_password(data.admin_user_password or "Admin123!"),
                full_name=data.admin_user_name or f"Administrador {club.name}",
                is_superadmin=False,
            )
            db.add(admin_user)
            await db.flush()
        elif data.admin_user_password:
            admin_user.password_hash = hash_password(data.admin_user_password)

        membership = await db.scalar(
            select(ClubMemberModel).where(
                ClubMemberModel.club_id == club.id,
                ClubMemberModel.user_id == admin_user.id,
            )
        )
        if not membership:
            membership = ClubMemberModel(
                id=uuid6.uuid7(),
                user_id=admin_user.id,
                club_id=club.id,
                role="admin",
                is_active=True,
            )
            db.add(membership)
        else:
            membership.role = "admin"
            membership.is_active = True

        members_count = 1

    await db.commit()
    await db.refresh(club)

    return SuperadminClubResponse(
        id=club.id,
        name=club.name,
        slug=club.slug,
        timezone=club.timezone,
        currency=(club.settings or {}).get("currency", "COP"),
        subscription_status=club.subscription_status,
        is_published=club.is_published,
        address=club.address,
        phone=club.phone,
        email=(club.settings or {}).get("email"),
        courts_count=0,
        members_count=members_count,
        created_at=club.created_at,
    )


@router.get("/clubs", response_model=list[SuperadminClubResponse])
async def list_clubs(
    _: Annotated[UserContext, Depends(require_superadmin)],
    db: Annotated[AsyncSession, Depends(get_db)],
    search: str | None = None,
    subscription_status: str | None = None,
    is_published: bool | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[SuperadminClubResponse]:
    """Lists all tenant clubs across the platform with filtering and counts."""
    query = (
        select(
            ClubModel,
            func.count(func.distinct(CourtModel.id)).label("courts_count"),
            func.count(func.distinct(ClubMemberModel.id)).label("members_count"),
        )
        .outerjoin(
            CourtModel,
            (CourtModel.club_id == ClubModel.id) & (CourtModel.deleted_at.is_(None)),
        )
        .outerjoin(
            ClubMemberModel,
            (ClubMemberModel.club_id == ClubModel.id) & (ClubMemberModel.is_active.is_(True)),
        )
        .where(ClubModel.deleted_at.is_(None))
        .group_by(ClubModel.id)
        .order_by(ClubModel.name)
        .limit(limit)
        .offset(offset)
    )

    if search:
        query = query.where(
            ClubModel.name.ilike(f"%{search.strip()}%")
            | ClubModel.slug.ilike(f"%{search.strip()}%")
        )
    if subscription_status:
        query = query.where(ClubModel.subscription_status == subscription_status)
    if is_published is not None:
        query = query.where(ClubModel.is_published.is_(is_published))

    result = await db.execute(query)
    rows = result.all()

    return [
        SuperadminClubResponse(
            id=c.id,
            name=c.name,
            slug=c.slug,
            timezone=c.timezone,
            currency=(c.settings or {}).get("currency", "COP"),
            subscription_status=c.subscription_status,
            is_published=c.is_published,
            address=c.address,
            phone=c.phone,
            email=(c.settings or {}).get("email"),
            courts_count=c_count,
            members_count=m_count,
            created_at=c.created_at,
        )
        for c, c_count, m_count in rows
    ]


@router.get("/clubs/{club_id}", response_model=SuperadminClubResponse)
async def get_club_by_id(
    club_id: UUID,
    _: Annotated[UserContext, Depends(require_superadmin)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SuperadminClubResponse:
    club = await db.get(ClubModel, club_id)
    if not club or club.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Club no encontrado")

    c_count = (
        await db.scalar(
            select(func.count(CourtModel.id)).where(
                CourtModel.club_id == club_id, CourtModel.deleted_at.is_(None)
            )
        )
        or 0
    )
    m_count = (
        await db.scalar(
            select(func.count(ClubMemberModel.id)).where(
                ClubMemberModel.club_id == club_id, ClubMemberModel.is_active.is_(True)
            )
        )
        or 0
    )

    return SuperadminClubResponse(
        id=club.id,
        name=club.name,
        slug=club.slug,
        timezone=club.timezone,
        currency=(club.settings or {}).get("currency", "COP"),
        subscription_status=club.subscription_status,
        is_published=club.is_published,
        address=club.address,
        phone=club.phone,
        email=(club.settings or {}).get("email"),
        courts_count=c_count,
        members_count=m_count,
        created_at=club.created_at,
    )


@router.patch("/clubs/{club_id}", response_model=SuperadminClubResponse)
async def update_club(
    club_id: UUID,
    data: SuperadminClubUpdateRequest,
    _: Annotated[UserContext, Depends(require_superadmin)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SuperadminClubResponse:
    """Updates club configuration, subscription state, or published status."""
    club = await db.get(ClubModel, club_id)
    if not club or club.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Club no encontrado")

    if data.slug is not None and data.slug.lower().strip() != club.slug:
        existing = await db.scalar(
            select(ClubModel).where(
                ClubModel.slug == data.slug.lower().strip(),
                ClubModel.id != club_id,
                ClubModel.deleted_at.is_(None),
            )
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Ya existe un club con el slug '{data.slug}'",
            )
        club.slug = data.slug.lower().strip()

    if data.name is not None:
        club.name = data.name.strip()
    if data.timezone is not None:
        club.timezone = data.timezone
    if data.subscription_status is not None:
        club.subscription_status = data.subscription_status
    if data.is_published is not None:
        club.is_published = data.is_published
    if data.address is not None:
        club.address = data.address
    if data.phone is not None:
        club.phone = data.phone
    if data.email is not None:
        updated_settings = dict(club.settings or {})
        updated_settings["email"] = data.email
        club.settings = updated_settings

    await db.commit()
    await db.refresh(club)

    c_count = (
        await db.scalar(
            select(func.count(CourtModel.id)).where(
                CourtModel.club_id == club_id, CourtModel.deleted_at.is_(None)
            )
        )
        or 0
    )
    m_count = (
        await db.scalar(
            select(func.count(ClubMemberModel.id)).where(
                ClubMemberModel.club_id == club_id, ClubMemberModel.is_active.is_(True)
            )
        )
        or 0
    )

    return SuperadminClubResponse(
        id=club.id,
        name=club.name,
        slug=club.slug,
        timezone=club.timezone,
        currency=(club.settings or {}).get("currency", "COP"),
        subscription_status=club.subscription_status,
        is_published=club.is_published,
        address=club.address,
        phone=club.phone,
        email=(club.settings or {}).get("email"),
        courts_count=c_count,
        members_count=m_count,
        created_at=club.created_at,
    )


@router.post("/clubs/{club_id}/toggle-power", response_model=SuperadminClubResponse)
async def toggle_club_power(
    club_id: UUID,
    _: Annotated[UserContext, Depends(require_superadmin)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SuperadminClubResponse:
    """Toggles club between online (active/published) and offline (suspended for non-payment)."""
    club = await db.get(ClubModel, club_id)
    if not club or club.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Club no encontrado")

    # If currently active and published -> Turn OFF (suspend)
    if club.is_published and club.subscription_status in ("active", "trial"):
        club.is_published = False
        club.subscription_status = "suspended"
    else:
        # Turn ON (activate and publish)
        club.is_published = True
        club.subscription_status = "active"

    await db.commit()
    await db.refresh(club)

    c_count = (
        await db.scalar(
            select(func.count(CourtModel.id)).where(
                CourtModel.club_id == club_id, CourtModel.deleted_at.is_(None)
            )
        )
        or 0
    )
    m_count = (
        await db.scalar(
            select(func.count(ClubMemberModel.id)).where(
                ClubMemberModel.club_id == club_id, ClubMemberModel.is_active.is_(True)
            )
        )
        or 0
    )

    return SuperadminClubResponse(
        id=club.id,
        name=club.name,
        slug=club.slug,
        timezone=club.timezone,
        currency=(club.settings or {}).get("currency", "COP"),
        subscription_status=club.subscription_status,
        is_published=club.is_published,
        address=club.address,
        phone=club.phone,
        email=(club.settings or {}).get("email"),
        courts_count=c_count,
        members_count=m_count,
        created_at=club.created_at,
    )


@router.delete("/clubs/{club_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_club(
    club_id: UUID,
    _: Annotated[UserContext, Depends(require_superadmin)],
    db: Annotated[AsyncSession, Depends(get_db)],
    hard_delete: bool = False,
) -> Response:
    """Deletes or cancels a club tenant globally from the platform with full cascading cleanup."""
    club = await db.get(ClubModel, club_id)
    if not club:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Club no encontrado")

    if hard_delete:
        # Full Hard Delete: delete all child entities in reverse foreign key order
        booking_ids_subq = select(BookingModel.id).where(BookingModel.club_id == club_id)
        # 1. Delete payments tied to bookings in this club
        await db.execute(delete(PaymentModel).where(PaymentModel.booking_id.in_(booking_ids_subq)))
        # 2. Delete audit events
        await db.execute(delete(BookingEventModel).where(BookingEventModel.booking_id.in_(booking_ids_subq)))
        # 3. Delete bookings (must be deleted before courts due to ondelete='RESTRICT')
        await db.execute(delete(BookingModel).where(BookingModel.club_id == club_id))
        # 4. Delete maintenance blocks
        await db.execute(delete(BlockModel).where(BlockModel.club_id == club_id))
        # 5. Delete pricing rules
        await db.execute(delete(PricingRuleModel).where(PricingRuleModel.club_id == club_id))
        # 6. Delete business hours
        await db.execute(delete(BusinessHoursModel).where(BusinessHoursModel.club_id == club_id))
        # 7. Delete 2D/3D layouts
        await db.execute(delete(ClubLayoutModel).where(ClubLayoutModel.club_id == club_id))
        # 8. Delete courts
        await db.execute(delete(CourtModel).where(CourtModel.club_id == club_id))
        # 9. Delete memberships
        await db.execute(delete(ClubMemberModel).where(ClubMemberModel.club_id == club_id))
        # 10. Delete the club tenant record
        await db.delete(club)
    else:
        # Soft delete: mark club as deleted, unpublish, cancel active bookings, and deactivate courts
        now = datetime.now(UTC)
        club.deleted_at = now
        club.is_published = False
        club.subscription_status = "cancelled"

        # Cancel any active/held reservations in this club
        await db.execute(
            update(BookingModel)
            .where(
                BookingModel.club_id == club_id,
                BookingModel.status.in_(["held", "confirmed"]),
            )
            .values(
                status="cancelled",
                cancellation_reason="Club dado de baja por la administración",
            )
        )

        # Deactivate all courts
        await db.execute(
            update(CourtModel)
            .where(CourtModel.club_id == club_id, CourtModel.deleted_at.is_(None))
            .values(deleted_at=now, is_active=False)
        )

        # Deactivate all staff memberships
        await db.execute(
            update(ClubMemberModel)
            .where(ClubMemberModel.club_id == club_id, ClubMemberModel.is_active.is_(True))
            .values(is_active=False)
        )

    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/clubs/{club_id}/members",
    response_model=SuperadminMembershipResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_club_member(
    club_id: UUID,
    data: SuperadminMembershipCreateRequest,
    _: Annotated[UserContext, Depends(require_superadmin)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SuperadminMembershipResponse:
    """Assigns or updates a membership role for a user in a specific club."""
    club = await db.get(ClubModel, club_id)
    if not club:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Club no encontrado")

    user = await db.scalar(
        select(UserModel).where(UserModel.email == data.user_email.lower().strip())
    )
    if not user:
        default_name = "Administrador de Club" if data.role == "admin" else "Recepcionista de Sede"
        default_pwd = "Admin123!" if data.role == "admin" else "Staff123!"
        user = UserModel(
            id=uuid6.uuid7(),
            email=data.user_email.lower().strip(),
            password_hash=hash_password(data.user_password or default_pwd),
            full_name=data.user_full_name or default_name,
            is_superadmin=False,
        )
        db.add(user)
        await db.flush()
    elif data.user_password:
        user.password_hash = hash_password(data.user_password)

    # Check if membership already exists
    membership = await db.scalar(
        select(ClubMemberModel).where(
            ClubMemberModel.club_id == club_id,
            ClubMemberModel.user_id == user.id,
        )
    )

    if membership:
        membership.role = data.role
        membership.is_active = True
    else:
        membership = ClubMemberModel(
            id=uuid6.uuid7(),
            user_id=user.id,
            club_id=club.id,
            role=data.role,
            is_active=True,
        )
        db.add(membership)

    await db.commit()
    await db.refresh(membership)

    return SuperadminMembershipResponse(
        id=membership.id,
        user_id=user.id,
        user_email=user.email,
        user_full_name=user.full_name,
        club_id=club.id,
        role=membership.role,
        is_active=membership.is_active,
        created_at=membership.created_at,
    )


@router.delete(
    "/clubs/{club_id}/members/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_club_member(
    club_id: UUID,
    user_id: UUID,
    _: Annotated[UserContext, Depends(require_superadmin)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Revokes a user's membership from a club."""
    membership = await db.scalar(
        select(ClubMemberModel).where(
            ClubMemberModel.club_id == club_id,
            ClubMemberModel.user_id == user_id,
        )
    )
    if not membership:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Membresía no encontrada")

    membership.is_active = False
    await db.commit()

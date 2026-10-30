import asyncio
import json
from datetime import UTC, date, datetime, time, timedelta
from typing import Annotated, Any
from uuid import UUID
from zoneinfo import ZoneInfo

import asyncpg
import uuid6
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy import delete, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_db, require_club_role
from app.application.dto.admin import (
    AdminBookingResponse,
    AdminCreateBookingRequest,
    AdminUpdateBookingRequest,
    BlockAdminResponse,
    BlockCreateRequest,
    BusinessHoursAdminResponse,
    BusinessHoursUpdateRequest,
    ClubLayoutResponse,
    ClubLayoutUpdateRequest,
    ClubSettingsResponse,
    ClubSettingsUpdateRequest,
    ClubStaffCreateRequest,
    ClubStaffMemberResponse,
    CourtAdminResponse,
    CourtCreateRequest,
    CourtLayoutItem,
    CourtUpdateRequest,
    DecorationItem,
    PricingRuleAdminResponse,
    PricingRuleCreateRequest,
    PricingRuleSlotDTO,
    DailyStoreSaleCreateRequest,
    DailyStoreSaleResponse,
)
from app.application.dto.auth import UserContext
from app.application.dto.reports import (
    ClubOccupancyResponse,
    ClubRevenueResponse,
    OccupancyCourtReport,
    OccupancySlotReport,
    RevenueCourtReport,
    RevenueDailyReport,
)
from app.config import settings
from app.domain.exceptions import SlotUnavailableError
from app.domain.value_objects.booking_code import BookingCode
from app.infrastructure.db.models import (
    BlockModel,
    BookingEventModel,
    BookingModel,
    BusinessHoursModel,
    ClubLayoutModel,
    ClubMemberModel,
    ClubModel,
    CourtModel,
    DailyStoreSaleModel,
    PricingRuleModel,
    UserModel,
)
from app.infrastructure.security.password import hash_password

router = APIRouter(prefix="/clubs", tags=["Club Admin"])


@router.get("/{club_id}/dashboard")
async def get_club_dashboard(
    auth_context: Annotated[tuple[UUID, UserContext], Depends(require_club_role("staff"))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, Any]:
    club_id, user_ctx = auth_context
    club = await db.get(ClubModel, club_id)
    if not club:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Club no encontrado")
    return {
        "club_id": str(club_id),
        "club_name": club.name,
        "slug": club.slug,
        "is_published": club.is_published,
        "phone": club.phone,
        "address": club.address,
        "latitude": (club.settings or {}).get("latitude"),
        "longitude": (club.settings or {}).get("longitude"),
        "city": (club.settings or {}).get("city", "Pereira"),
        "role": user_ctx.memberships.get(str(club_id), "staff"),
        "timezone": club.timezone,
    }


# ---------------------------------------------------------
# CLUB SETTINGS (RENTAL DURATIONS, STEP & GEOLOCATION)
# ---------------------------------------------------------
@router.get("/{club_id}/settings", response_model=ClubSettingsResponse)
async def get_club_settings(
    auth_context: Annotated[tuple[UUID, UserContext], Depends(require_club_role("staff"))],
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> ClubSettingsResponse:
    club_id, _ = auth_context
    club = await db.get(ClubModel, club_id)
    if not club:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Club no encontrado")
    s = club.settings or {}
    allowed = s.get("allowed_durations") or [60]
    default_dur = s.get("default_duration") or (allowed[0] if allowed else 60)
    return ClubSettingsResponse(
        allowed_durations=allowed,
        default_duration=default_dur,
        slot_step_minutes=s.get("slot_step_minutes"),
        court_selection_mode=s.get("court_selection_mode", "manual"),
        currency=s.get("currency", "COP"),
        latitude=s.get("latitude"),
        longitude=s.get("longitude"),
        city=s.get("city", "Pereira"),
        address=club.address,
        phone=club.phone,
        announcement=s.get("announcement"),
    )


@router.patch("/{club_id}/settings", response_model=ClubSettingsResponse)
async def update_club_settings(
    data: ClubSettingsUpdateRequest,
    auth_context: Annotated[tuple[UUID, UserContext], Depends(require_club_role("admin"))],
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> ClubSettingsResponse:
    club_id, _ = auth_context
    club = await db.get(ClubModel, club_id)
    if not club:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Club no encontrado")

    s = dict(club.settings or {})
    if data.allowed_durations is not None:
        if not data.allowed_durations:
            raise HTTPException(status_code=400, detail="Debe existir al menos una duración habilitada")
        for d in data.allowed_durations:
            if d < 15 or d > 360:
                raise HTTPException(status_code=400, detail="Las duraciones deben ser entre 15 y 360 minutos")
        s["allowed_durations"] = sorted(list(set(data.allowed_durations)))
        if s.get("default_duration") not in s["allowed_durations"]:
            s["default_duration"] = s["allowed_durations"][0]

    if data.default_duration is not None:
        curr_allowed = s.get("allowed_durations") or [60]
        if data.default_duration not in curr_allowed:
            raise HTTPException(
                status_code=400,
                detail="La duración predeterminada debe estar entre las duraciones permitidas"
            )
        s["default_duration"] = data.default_duration

    if data.slot_step_minutes is not None:
        s["slot_step_minutes"] = data.slot_step_minutes

    if data.court_selection_mode is not None:
        if data.court_selection_mode not in ["manual", "by_category"]:
            raise HTTPException(status_code=400, detail="Modo de selección inválido. Valores permitidos: manual, by_category")
        s["court_selection_mode"] = data.court_selection_mode

    if data.latitude is not None:
        s["latitude"] = data.latitude
    if data.longitude is not None:
        s["longitude"] = data.longitude
    if data.city is not None:
        s["city"] = data.city
    if data.address is not None:
        club.address = data.address
    if data.phone is not None:
        club.phone = data.phone
    if data.announcement is not None:
        s["announcement"] = data.announcement.model_dump()

    club.settings = s
    await db.commit()

    allowed = s.get("allowed_durations") or [60]
    default_dur = s.get("default_duration") or (allowed[0] if allowed else 60)
    return ClubSettingsResponse(
        allowed_durations=allowed,
        default_duration=default_dur,
        slot_step_minutes=s.get("slot_step_minutes"),
        court_selection_mode=s.get("court_selection_mode", "manual"),
        currency=s.get("currency", "COP"),
        latitude=s.get("latitude"),
        longitude=s.get("longitude"),
        city=s.get("city", "Pereira"),
        address=club.address,
        phone=club.phone,
        announcement=s.get("announcement"),
    )


# ---------------------------------------------------------
# COURTS CRUD
# ---------------------------------------------------------
@router.get("/{club_id}/courts", response_model=list[CourtAdminResponse])
async def list_courts(
    auth_context: Annotated[tuple[UUID, UserContext], Depends(require_club_role("staff"))],
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> list[CourtAdminResponse]:
    club_id, _ = auth_context
    query = (
        select(CourtModel)
        .where(CourtModel.club_id == club_id, CourtModel.deleted_at.is_(None))
        .options(selectinload(CourtModel.pricing_rules))
        .order_by(CourtModel.position, CourtModel.name)
    )
    result = await db.scalars(query)
    courts = result.all()

    # Default pricing rule if court has no direct rule
    default_price_query = select(PricingRuleModel.price_cents).where(
        PricingRuleModel.club_id == club_id,
        PricingRuleModel.court_id.is_(None),
    )
    default_club_price = await db.scalar(default_price_query)

    responses = []
    for c in courts:
        court_rules = [pr for pr in c.pricing_rules if pr.court_id == c.id]
        court_rule = court_rules[0] if court_rules else None
        court_price = court_rule.price_cents if court_rule else (default_club_price or 6000000)
        rules_dto = [
            PricingRuleSlotDTO(
                id=pr.id,
                start_time=pr.start_time.strftime("%H:%M"),
                end_time=pr.end_time.strftime("%H:%M"),
                price_cents=pr.price_cents,
                weekday_mask=pr.weekday_mask,
            )
            for pr in sorted(court_rules, key=lambda x: x.start_time)
        ]
        responses.append(
            CourtAdminResponse(
                id=c.id,
                club_id=c.club_id,
                name=c.name,
                sport=c.sport,
                surface=c.surface,
                player_format=c.player_format,
                is_covered=c.is_covered,
                has_lighting=c.has_lighting,
                is_active=c.is_active,
                position=c.position,
                shape=c.shape,
                price_per_hour_cents=court_price,
                pricing_rules=rules_dto,
                created_at=c.created_at,
            )
        )
    return responses


@router.post(
    "/{club_id}/courts",
    response_model=CourtAdminResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_court(
    data: CourtCreateRequest,
    auth_context: Annotated[tuple[UUID, UserContext], Depends(require_club_role("admin"))],
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> CourtAdminResponse:
    club_id, _ = auth_context
    court_id = uuid6.uuid7()
    court = CourtModel(
        id=court_id,
        club_id=club_id,
        name=data.name.strip(),
        sport=data.sport.strip(),
        surface=data.surface,
        player_format=data.player_format,
        is_covered=data.is_covered,
        has_lighting=data.has_lighting,
        is_active=True,
        position=data.position,
        shape=data.shape.model_dump() if data.shape else None,
    )
    db.add(court)

    rules_dto: list[PricingRuleSlotDTO] = []
    if data.pricing_rules and len(data.pricing_rules) > 0:
        for pr_in in data.pricing_rules:
            st_parts = [int(p) for p in pr_in.start_time.split(":")]
            st = time(st_parts[0], st_parts[1])
            if pr_in.end_time in ("24:00", "23:59"):
                et = time(23, 59, 59)
            else:
                et_parts = [int(p) for p in pr_in.end_time.split(":")]
                et = time(et_parts[0], et_parts[1])
            rule = PricingRuleModel(
                id=uuid6.uuid7(),
                club_id=club_id,
                court_id=court_id,
                weekday_mask=pr_in.weekday_mask,
                start_time=st,
                end_time=et,
                price_cents=pr_in.price_cents,
                currency="COP",
            )
            db.add(rule)
            rules_dto.append(
                PricingRuleSlotDTO(
                    id=rule.id,
                    start_time=rule.start_time.strftime("%H:%M"),
                    end_time=rule.end_time.strftime("%H:%M"),
                    price_cents=rule.price_cents,
                    weekday_mask=rule.weekday_mask,
                )
            )
        base_price_cents = rules_dto[0].price_cents if rules_dto else 6000000
    else:
        price_cents = data.price_per_hour_cents if data.price_per_hour_cents is not None else 6000000
        rule = PricingRuleModel(
            id=uuid6.uuid7(),
            club_id=club_id,
            court_id=court_id,
            weekday_mask=127,
            start_time=time(0, 0),
            end_time=time(23, 59, 59),
            price_cents=price_cents,
            currency="COP",
        )
        db.add(rule)
        base_price_cents = price_cents
        rules_dto.append(
            PricingRuleSlotDTO(
                id=rule.id,
                start_time="00:00",
                end_time="23:59",
                price_cents=price_cents,
                weekday_mask=127,
            )
        )

    await db.commit()
    await db.refresh(court)

    return CourtAdminResponse(
        id=court.id,
        club_id=court.club_id,
        name=court.name,
        sport=court.sport,
        surface=court.surface,
        player_format=court.player_format,
        is_covered=court.is_covered,
        has_lighting=court.has_lighting,
        is_active=court.is_active,
        position=court.position,
        shape=court.shape,
        price_per_hour_cents=base_price_cents,
        pricing_rules=rules_dto,
        created_at=court.created_at,
    )


@router.patch("/{club_id}/courts/{court_id}", response_model=CourtAdminResponse)
async def update_court(
    court_id: UUID,
    data: CourtUpdateRequest,
    auth_context: Annotated[tuple[UUID, UserContext], Depends(require_club_role("admin"))],
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> CourtAdminResponse:
    club_id, _ = auth_context
    court = await db.get(CourtModel, court_id)
    if not court or court.club_id != club_id or court.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Cancha no encontrada")

    update_dict = data.model_dump(exclude_unset=True)
    price_to_update = update_dict.pop("price_per_hour_cents", None)
    pricing_rules_to_update = update_dict.pop("pricing_rules", None)

    if "shape" in update_dict and update_dict["shape"] is not None:
        update_dict["shape"] = data.shape.model_dump() if data.shape else None

    for key, value in update_dict.items():
        setattr(court, key, value)

    rules_dto: list[PricingRuleSlotDTO] = []
    if pricing_rules_to_update is not None:
        # Recreate pricing rules for this court
        await db.execute(
            delete(PricingRuleModel).where(
                PricingRuleModel.club_id == club_id,
                PricingRuleModel.court_id == court_id,
            )
        )
        if len(pricing_rules_to_update) > 0:
            for pr_in in pricing_rules_to_update:
                st_parts = [int(p) for p in pr_in["start_time"].split(":")]
                st = time(st_parts[0], st_parts[1])
                if pr_in["end_time"] in ("24:00", "23:59"):
                    et = time(23, 59, 59)
                else:
                    et_parts = [int(p) for p in pr_in["end_time"].split(":")]
                    et = time(et_parts[0], et_parts[1])
                rule = PricingRuleModel(
                    id=uuid6.uuid7(),
                    club_id=club_id,
                    court_id=court_id,
                    weekday_mask=pr_in.get("weekday_mask", 127),
                    start_time=st,
                    end_time=et,
                    price_cents=pr_in["price_cents"],
                    currency="COP",
                )
                db.add(rule)
                rules_dto.append(
                    PricingRuleSlotDTO(
                        id=rule.id,
                        start_time=rule.start_time.strftime("%H:%M"),
                        end_time=rule.end_time.strftime("%H:%M"),
                        price_cents=rule.price_cents,
                        weekday_mask=rule.weekday_mask,
                    )
                )
        else:
            base_p = price_to_update or 6000000
            rule = PricingRuleModel(
                id=uuid6.uuid7(),
                club_id=club_id,
                court_id=court_id,
                weekday_mask=127,
                start_time=time(0, 0),
                end_time=time(23, 59, 59),
                price_cents=base_p,
                currency="COP",
            )
            db.add(rule)
            rules_dto.append(
                PricingRuleSlotDTO(
                    id=rule.id,
                    start_time="00:00",
                    end_time="23:59",
                    price_cents=base_p,
                    weekday_mask=127,
                )
            )
    elif price_to_update is not None:
        rule_query = select(PricingRuleModel).where(
            PricingRuleModel.club_id == club_id,
            PricingRuleModel.court_id == court_id,
        )
        existing_rule = await db.scalar(rule_query)
        if existing_rule:
            existing_rule.price_cents = price_to_update
        else:
            new_rule = PricingRuleModel(
                id=uuid6.uuid7(),
                club_id=club_id,
                court_id=court_id,
                weekday_mask=127,
                start_time=time(0, 0),
                end_time=time(23, 59, 59),
                price_cents=price_to_update,
                currency="COP",
            )
            db.add(new_rule)

    await db.commit()
    await db.refresh(court)

    # Fetch fresh rules if not already assembled
    if not rules_dto:
        fresh_rules_q = select(PricingRuleModel).where(
            PricingRuleModel.club_id == club_id,
            PricingRuleModel.court_id == court_id,
        ).order_by(PricingRuleModel.start_time)
        fresh_rules = (await db.scalars(fresh_rules_q)).all()
        rules_dto = [
            PricingRuleSlotDTO(
                id=r.id,
                start_time=r.start_time.strftime("%H:%M"),
                end_time=r.end_time.strftime("%H:%M"),
                price_cents=r.price_cents,
                weekday_mask=r.weekday_mask,
            )
            for r in fresh_rules
        ]

    effective_price = rules_dto[0].price_cents if rules_dto else (price_to_update or 6000000)

    return CourtAdminResponse(
        id=court.id,
        club_id=court.club_id,
        name=court.name,
        sport=court.sport,
        surface=court.surface,
        player_format=court.player_format,
        is_covered=court.is_covered,
        has_lighting=court.has_lighting,
        is_active=court.is_active,
        position=court.position,
        shape=court.shape,
        price_per_hour_cents=effective_price,
        pricing_rules=rules_dto,
        created_at=court.created_at,
    )


@router.delete("/{club_id}/courts/{court_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_court(
    court_id: UUID,
    auth_context: Annotated[tuple[UUID, UserContext], Depends(require_club_role("admin"))],
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> None:
    club_id, _ = auth_context
    court = await db.get(CourtModel, court_id)
    if not court or court.club_id != club_id or court.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Cancha no encontrada")

    court.deleted_at = datetime.now(UTC)
    court.is_active = False
    await db.commit()


# ---------------------------------------------------------
# BUSINESS HOURS
# ---------------------------------------------------------
@router.get("/{club_id}/business-hours", response_model=list[BusinessHoursAdminResponse])
async def get_business_hours(
    auth_context: Annotated[tuple[UUID, UserContext], Depends(require_club_role("staff"))],
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> list[BusinessHoursAdminResponse]:
    club_id, _ = auth_context
    query = (
        select(BusinessHoursModel)
        .where(BusinessHoursModel.club_id == club_id)
        .order_by(BusinessHoursModel.weekday)
    )
    records = (await db.scalars(query)).all()
    return [
        BusinessHoursAdminResponse(
            id=r.id,
            weekday=r.weekday,
            opens_at=r.opens_at.strftime("%H:%M"),
            closes_at=r.closes_at.strftime("%H:%M"),
            closes_next_day=r.closes_next_day,
        )
        for r in records
    ]


@router.put("/{club_id}/business-hours", response_model=list[BusinessHoursAdminResponse])
async def replace_business_hours(
    data: BusinessHoursUpdateRequest,
    auth_context: Annotated[tuple[UUID, UserContext], Depends(require_club_role("admin"))],
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> list[BusinessHoursAdminResponse]:
    club_id, _ = auth_context

    # 1. Atomic delete of old business hours
    await db.execute(delete(BusinessHoursModel).where(BusinessHoursModel.club_id == club_id))

    # 2. Insert new hours
    new_records = [
        BusinessHoursModel(
            id=uuid6.uuid7(),
            club_id=club_id,
            weekday=item.weekday,
            opens_at=item.opens_at,
            closes_at=item.closes_at,
            closes_next_day=item.closes_next_day,
        )
        for item in data.hours
    ]
    db.add_all(new_records)
    await db.commit()

    return [
        BusinessHoursAdminResponse(
            id=r.id,
            weekday=r.weekday,
            opens_at=r.opens_at.strftime("%H:%M"),
            closes_at=r.closes_at.strftime("%H:%M"),
            closes_next_day=r.closes_next_day,
        )
        for r in sorted(new_records, key=lambda x: x.weekday)
    ]


# ---------------------------------------------------------
# BLOCKS CRUD
# ---------------------------------------------------------
@router.get("/{club_id}/blocks", response_model=list[BlockAdminResponse])
async def list_blocks(
    auth_context: Annotated[tuple[UUID, UserContext], Depends(require_club_role("staff"))],
    court_id: UUID | None = None,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> list[BlockAdminResponse]:
    club_id, _ = auth_context
    query = select(BlockModel).where(BlockModel.club_id == club_id)
    if court_id:
        query = query.where(BlockModel.court_id == court_id)
    query = query.order_by(BlockModel.period)
    records = (await db.scalars(query)).all()
    return [
        BlockAdminResponse(
            id=r.id,
            club_id=r.club_id,
            court_id=r.court_id,
            period_start=r.period.lower,
            period_end=r.period.upper,
            kind=r.kind,
            reason=r.reason,
            created_at=r.created_at,
        )
        for r in records
    ]


@router.post(
    "/{club_id}/blocks",
    response_model=BlockAdminResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_block(
    data: BlockCreateRequest,
    auth_context: Annotated[tuple[UUID, UserContext], Depends(require_club_role("staff"))],
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> BlockAdminResponse:
    club_id, user = auth_context

    club = await db.get(ClubModel, club_id)
    club_tz = ZoneInfo(club.timezone if (club and club.timezone) else "America/Bogota")

    start_dt = data.period_start
    if start_dt.tzinfo is None:
        start_dt = start_dt.replace(tzinfo=club_tz).astimezone(UTC)
    else:
        start_dt = start_dt.astimezone(UTC)

    end_dt = data.period_end
    if end_dt.tzinfo is None:
        end_dt = end_dt.replace(tzinfo=club_tz).astimezone(UTC)
    else:
        end_dt = end_dt.astimezone(UTC)

    if start_dt >= end_dt:
        raise HTTPException(
            status_code=400, detail="Fecha de inicio debe ser anterior a fecha de fin"
        )

    period_range = asyncpg.Range(
        start_dt,
        end_dt,
        lower_inc=True,
        upper_inc=False,
    )

    block = BlockModel(
        id=uuid6.uuid7(),
        club_id=club_id,
        court_id=data.court_id,
        period=period_range,
        kind=data.kind,
        reason=data.reason,
        created_by=user.id,
    )
    db.add(block)
    await db.commit()
    await db.refresh(block)

    return BlockAdminResponse(
        id=block.id,
        club_id=block.club_id,
        court_id=block.court_id,
        period_start=block.period.lower,
        period_end=block.period.upper,
        kind=block.kind,
        reason=block.reason,
        created_at=block.created_at,
    )


@router.delete("/{club_id}/blocks/{block_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_block(
    block_id: UUID,
    auth_context: Annotated[tuple[UUID, UserContext], Depends(require_club_role("staff"))],
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> None:
    club_id, _ = auth_context
    block = await db.get(BlockModel, block_id)
    if not block or block.club_id != club_id:
        raise HTTPException(status_code=404, detail="Bloqueo no encontrado")
    await db.delete(block)
    await db.commit()


# ---------------------------------------------------------
# PRICING RULES CRUD
# ---------------------------------------------------------
@router.get("/{club_id}/pricing-rules", response_model=list[PricingRuleAdminResponse])
async def list_pricing_rules(
    auth_context: Annotated[tuple[UUID, UserContext], Depends(require_club_role("staff"))],
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> list[PricingRuleAdminResponse]:
    club_id, _ = auth_context
    query = (
        select(PricingRuleModel)
        .where(PricingRuleModel.club_id == club_id)
        .order_by(PricingRuleModel.court_id.nulls_first(), PricingRuleModel.start_time)
    )
    records = (await db.scalars(query)).all()
    return [
        PricingRuleAdminResponse(
            id=r.id,
            club_id=r.club_id,
            court_id=r.court_id,
            weekday_mask=r.weekday_mask,
            start_time=r.start_time.strftime("%H:%M"),
            end_time=r.end_time.strftime("%H:%M"),
            price_cents=r.price_cents,
            currency=r.currency,
            valid_from=r.valid_from,
            valid_to=r.valid_to,
        )
        for r in records
    ]


@router.post(
    "/{club_id}/pricing-rules",
    response_model=PricingRuleAdminResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_pricing_rule(
    data: PricingRuleCreateRequest,
    auth_context: Annotated[tuple[UUID, UserContext], Depends(require_club_role("admin"))],
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> PricingRuleAdminResponse:
    club_id, _ = auth_context
    rule = PricingRuleModel(
        id=uuid6.uuid7(),
        club_id=club_id,
        court_id=data.court_id,
        weekday_mask=data.weekday_mask,
        start_time=data.start_time,
        end_time=data.end_time,
        price_cents=data.price_cents,
        currency=data.currency,
        valid_from=data.valid_from,
        valid_to=data.valid_to,
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)

    return PricingRuleAdminResponse(
        id=rule.id,
        club_id=rule.club_id,
        court_id=rule.court_id,
        weekday_mask=rule.weekday_mask,
        start_time=rule.start_time.strftime("%H:%M"),
        end_time=rule.end_time.strftime("%H:%M"),
        price_cents=rule.price_cents,
        currency=rule.currency,
        valid_from=rule.valid_from,
        valid_to=rule.valid_to,
    )


@router.delete("/{club_id}/pricing-rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pricing_rule(
    rule_id: UUID,
    auth_context: Annotated[tuple[UUID, UserContext], Depends(require_club_role("admin"))],
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> None:
    club_id, _ = auth_context
    rule = await db.get(PricingRuleModel, rule_id)
    if not rule or rule.club_id != club_id:
        raise HTTPException(status_code=404, detail="Regla de tarifa no encontrada")
    await db.delete(rule)
    await db.commit()


# ---------------------------------------------------------
# ADMIN BOOKINGS & MANUAL BOOKING (COUNTER / PHONE)
# ---------------------------------------------------------
@router.get("/{club_id}/bookings", response_model=list[AdminBookingResponse])
async def list_admin_bookings(
    auth_context: Annotated[tuple[UUID, UserContext], Depends(require_club_role("staff"))],
    from_date: Annotated[datetime | None, Query(alias="from")] = None,
    to_date: Annotated[datetime | None, Query(alias="to")] = None,
    start_date: Annotated[str | None, Query()] = None,
    end_date: Annotated[str | None, Query()] = None,
    court_id: UUID | None = None,
    booking_status: Annotated[str | None, Query(alias="status")] = None,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> list[AdminBookingResponse]:
    club_id, _ = auth_context
    club = await db.get(ClubModel, club_id)
    club_tz = ZoneInfo(club.timezone if (club and club.timezone) else "America/Bogota")

    query = (
        select(BookingModel)
        .where(BookingModel.club_id == club_id)
        .options(selectinload(BookingModel.court))
        .order_by(BookingModel.created_at.desc())
    )

    if court_id:
        query = query.where(BookingModel.court_id == court_id)
    if booking_status:
        query = query.where(BookingModel.status == booking_status)

    if start_date:
        try:
            s_d = date.fromisoformat(start_date)
            e_d = date.fromisoformat(end_date) if end_date else s_d
            s_utc = datetime.combine(s_d, datetime.min.time(), tzinfo=club_tz).astimezone(UTC)
            e_utc = datetime.combine(e_d + timedelta(days=1), datetime.min.time(), tzinfo=club_tz).astimezone(UTC)
            search_range = asyncpg.Range(s_utc, e_utc, lower_inc=True, upper_inc=False)
            query = query.where(BookingModel.period.op("&&")(search_range))
        except ValueError:
            pass
    elif from_date and to_date:
        search_range = asyncpg.Range(
            from_date.astimezone(UTC),
            to_date.astimezone(UTC),
            lower_inc=True,
            upper_inc=False,
        )
        query = query.where(BookingModel.period.op("&&")(search_range))

    records = (await db.scalars(query)).all()
    return [
        AdminBookingResponse(
            id=b.id,
            code=b.code,
            club_id=b.club_id,
            court_id=b.court_id,
            court_name=b.court.name if b.court else "Cancha",
            period_start=b.period.lower,
            period_end=b.period.upper,
            status=b.status,
            customer_name=b.customer_name,
            customer_phone=b.customer_phone,
            customer_email=b.customer_email,
            price_cents=b.price_cents,
            currency=b.currency,
            payment_status=b.payment_status,
            cancellation_reason=b.cancellation_reason,
            created_at=b.created_at,
        )
        for b in records
    ]


@router.post(
    "/{club_id}/bookings",
    response_model=AdminBookingResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_manual_booking(
    data: AdminCreateBookingRequest,
    auth_context: Annotated[tuple[UUID, UserContext], Depends(require_club_role("staff"))],
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> AdminBookingResponse:
    """Manual booking created over phone/counter by staff. Inserted directly as 'confirmed'."""
    club_id, current_user = auth_context

    court = await db.get(CourtModel, data.court_id)
    if not court or court.club_id != club_id or not court.is_active:
        raise HTTPException(status_code=404, detail="Cancha no encontrada o inactiva")

    club = await db.get(ClubModel, club_id)
    club_tz = ZoneInfo(club.timezone if (club and club.timezone) else "America/Bogota")

    start_dt = data.period_start
    if start_dt.tzinfo is None:
        period_start = start_dt.replace(tzinfo=club_tz).astimezone(UTC)
    else:
        period_start = start_dt.astimezone(UTC)

    period_end = period_start + timedelta(minutes=data.duration_minutes)
    period_range = asyncpg.Range(period_start, period_end, lower_inc=True, upper_inc=False)

    # Check if court is blocked by maintenance, tournament, etc.
    block_conflict = await db.scalar(
        select(BlockModel).where(
            BlockModel.club_id == club_id,
            or_(BlockModel.court_id == court.id, BlockModel.court_id.is_(None)),
            BlockModel.period.op("&&")(period_range),
        )
    )
    if block_conflict:
        reason_str = f": {block_conflict.reason}" if block_conflict.reason else ""
        raise HTTPException(
            status_code=409,
            detail=f"La cancha está bloqueada en este horario por {block_conflict.kind}{reason_str}.",
        )

    booking_id = uuid6.uuid7()
    code = BookingCode.generate().value

    booking = BookingModel(
        id=booking_id,
        code=code,
        club_id=club_id,
        court_id=court.id,
        period=period_range,
        status="confirmed",
        customer_name=data.customer_name.strip(),
        customer_phone=data.customer_phone.strip(),
        customer_email=data.customer_email.lower().strip() if data.customer_email else "",
        price_cents=data.price_cents or 5000000,
        currency="COP",
        payment_status=data.payment_status,
    )
    db.add(booking)

    event = BookingEventModel(
        id=uuid6.uuid7(),
        booking_id=booking_id,
        event_type="confirmed",
        actor_id=current_user.id,
        actor_type="staff",
        payload={"notes": data.notes, "manual_booking": True},
    )
    db.add(event)

    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        err_msg = str(exc.orig).lower() if hasattr(exc, "orig") else str(exc).lower()
        if "bookings_no_overlap" in err_msg or "exclusion" in err_msg:
            raise SlotUnavailableError(
                f"{period_start.isoformat()} - {period_end.isoformat()}"
            ) from exc
        raise

    return AdminBookingResponse(
        id=booking.id,
        code=booking.code,
        club_id=booking.club_id,
        court_id=booking.court_id,
        court_name=court.name,
        period_start=period_start,
        period_end=period_end,
        status="confirmed",
        customer_name=booking.customer_name,
        customer_phone=booking.customer_phone,
        customer_email=booking.customer_email,
        price_cents=booking.price_cents,
        currency=booking.currency,
        payment_status=booking.payment_status,
        cancellation_reason=None,
        created_at=booking.created_at,
    )


@router.patch("/{club_id}/bookings/{booking_id}", response_model=AdminBookingResponse)
async def update_booking_status(
    booking_id: UUID,
    data: AdminUpdateBookingRequest,
    auth_context: Annotated[tuple[UUID, UserContext], Depends(require_club_role("staff"))],
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> AdminBookingResponse:
    club_id, current_user = auth_context
    query = (
        select(BookingModel)
        .where(BookingModel.id == booking_id, BookingModel.club_id == club_id)
        .options(selectinload(BookingModel.court))
    )
    booking = await db.scalar(query)
    if not booking:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")

    if data.status:
        booking.status = data.status
    if data.payment_status:
        booking.payment_status = data.payment_status
    if data.cancellation_reason:
        booking.cancellation_reason = data.cancellation_reason
    if data.customer_name is not None and data.customer_name.strip():
        booking.customer_name = data.customer_name.strip()
    if data.customer_phone is not None and data.customer_phone.strip():
        booking.customer_phone = data.customer_phone.strip()
    if data.customer_email is not None and data.customer_email.strip():
        booking.customer_email = data.customer_email.strip()
    if data.price_cents is not None:
        booking.price_cents = data.price_cents

    event = BookingEventModel(
        id=uuid6.uuid7(),
        booking_id=booking.id,
        event_type="modified",
        actor_id=current_user.id,
        actor_type="staff",
        payload=data.model_dump(exclude_unset=True),
    )
    db.add(event)
    await db.commit()

    return AdminBookingResponse(
        id=booking.id,
        code=booking.code,
        club_id=booking.club_id,
        court_id=booking.court_id,
        court_name=booking.court.name if booking.court else "Cancha",
        period_start=booking.period.lower,
        period_end=booking.period.upper,
        status=booking.status,
        customer_name=booking.customer_name,
        customer_phone=booking.customer_phone,
        customer_email=booking.customer_email,
        price_cents=booking.price_cents,
        currency=booking.currency,
        payment_status=booking.payment_status,
        cancellation_reason=booking.cancellation_reason,
        created_at=booking.created_at,
    )


@router.delete("/{club_id}/bookings/{booking_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_booking(
    booking_id: UUID,
    auth_context: Annotated[tuple[UUID, UserContext], Depends(require_club_role("staff"))],
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> None:
    """Permanently delete a booking (e.g. created by mistake). Allowed for staff and admins."""
    club_id, current_user = auth_context
    query = select(BookingModel).where(BookingModel.id == booking_id, BookingModel.club_id == club_id)
    booking = await db.scalar(query)
    if not booking:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")

    await db.delete(booking)
    await db.commit()


# ---------------------------------------------------------
# LAYOUT & INTERACTIVE COURT MAP
# ---------------------------------------------------------
@router.get("/{club_id:uuid}/layout", response_model=ClubLayoutResponse)
async def get_club_layout(
    club_id: UUID,
    response: Response,
    auth_context: Annotated[tuple[UUID, UserContext], Depends(require_club_role("staff"))],
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> ClubLayoutResponse:
    query = select(ClubLayoutModel).where(
        ClubLayoutModel.club_id == club_id, ClubLayoutModel.is_default.is_(True)
    )
    layout = await db.scalar(query)

    # If no custom layout created yet, create default layout on the fly
    if not layout:
        layout = ClubLayoutModel(
            id=uuid6.uuid7(),
            club_id=club_id,
            name="Planta Principal",
            view_box_w=1000,
            view_box_h=1000,
            decorations=[],
            is_default=True,
        )
        db.add(layout)
        await db.commit()
        await db.refresh(layout)

    # Fetch courts with shapes
    courts_query = select(CourtModel).where(
        CourtModel.club_id == club_id,
        CourtModel.deleted_at.is_(None),
    )
    courts = (await db.scalars(courts_query)).all()

    court_items = [
        CourtLayoutItem(court_id=c.id, shape=c.shape)  # type: ignore[arg-type]
        for c in courts
        if c.shape
    ]
    decorations = [DecorationItem(**d) for d in layout.decorations]

    response.headers["Cache-Control"] = "public, max-age=300"
    return ClubLayoutResponse(
        id=layout.id,
        club_id=club_id,
        name=layout.name,
        view_box_w=layout.view_box_w,
        view_box_h=layout.view_box_h,
        courts=court_items,
        decorations=decorations,
    )


@router.put("/{club_id:uuid}/layout", response_model=ClubLayoutResponse)
async def update_club_layout(
    data: ClubLayoutUpdateRequest,
    auth_context: Annotated[tuple[UUID, UserContext], Depends(require_club_role("admin"))],
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> ClubLayoutResponse:
    club_id, _ = auth_context

    # 1. Update or create default layout
    query = select(ClubLayoutModel).where(
        ClubLayoutModel.club_id == club_id, ClubLayoutModel.is_default.is_(True)
    )
    layout = await db.scalar(query)
    if not layout:
        layout = ClubLayoutModel(
            id=uuid6.uuid7(),
            club_id=club_id,
            is_default=True,
        )
        db.add(layout)

    layout.name = data.name
    layout.view_box_w = data.view_box_w
    layout.view_box_h = data.view_box_h
    layout.decorations = [d.model_dump() for d in data.decorations]

    # 2. Update shapes on each court atomically
    for court_item in data.courts:
        court = await db.get(CourtModel, court_item.court_id)
        if court and court.club_id == club_id:
            court.shape = court_item.shape.model_dump()
            court.layout_id = layout.id

    await db.commit()

    return ClubLayoutResponse(
        id=layout.id,
        club_id=club_id,
        name=layout.name,
        view_box_w=layout.view_box_w,
        view_box_h=layout.view_box_h,
        courts=data.courts,
        decorations=data.decorations,
    )


# ---------------------------------------------------------
# SERVER-SENT EVENTS (SSE) FOR LIVE CALENDAR
# ---------------------------------------------------------
@router.get("/{club_id}/events")
async def calendar_events_sse(
    club_id: UUID,
    auth_context: Annotated[tuple[UUID, UserContext], Depends(require_club_role("staff"))],
) -> StreamingResponse:
    """Streams live Server-Sent Events to connected administrative calendars."""

    async def sse_stream():
        # Initial connection packet
        yield f"event: connected\ndata: {json.dumps({'status': 'connected', 'club_id': str(club_id)})}\n\n"
        # Periodic keep-alive ping
        try:
            sleep_time = 0.01 if settings.ENVIRONMENT == "development" else 15
            for _ in range(2 if settings.ENVIRONMENT == "development" else 100):
                await asyncio.sleep(sleep_time)
                yield f"event: ping\ndata: {json.dumps({'time': datetime.now(UTC).isoformat()})}\n\n"
        except asyncio.CancelledError:
            pass

    return StreamingResponse(
        sse_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )


# ---------------------------------------------------------
# ANALYTICS & REPORTS
# ---------------------------------------------------------
@router.get("/{club_id}/reports/occupancy", response_model=ClubOccupancyResponse)
async def get_club_occupancy_report(
    club_id: UUID,
    auth_context: Annotated[tuple[UUID, UserContext], Depends(require_club_role("admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    start_date: Annotated[date, Query()],
    end_date: Annotated[date, Query()],
) -> ClubOccupancyResponse:
    """Calculates occupancy percentage broken down by time of day and court."""
    if end_date < start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La fecha de fin no puede ser anterior a la fecha de inicio",
        )
    if (end_date - start_date).days > 90:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El rango máximo de reporte es de 90 días",
        )

    club = await db.get(ClubModel, club_id)
    if not club:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Club no encontrado")

    local_tz = ZoneInfo(club.timezone)
    courts = (
        await db.scalars(
            select(CourtModel).where(CourtModel.club_id == club_id, CourtModel.deleted_at.is_(None))
        )
    ).all()
    court_map = {c.id: c.name for c in courts}
    active_court_count = len(courts)

    b_hours = (
        await db.scalars(select(BusinessHoursModel).where(BusinessHoursModel.club_id == club_id))
    ).all()
    hours_by_dow = {bh.weekday: bh for bh in b_hours}

    # Range in UTC
    range_start_dt = datetime.combine(start_date, time.min, tzinfo=local_tz)
    range_end_dt = datetime.combine(end_date, time.max, tzinfo=local_tz)
    range_start_utc = range_start_dt.astimezone(UTC)
    range_end_utc = range_end_dt.astimezone(UTC)

    # Calculate available minutes per time bucket and total
    morning_avail = 0
    afternoon_avail = 0
    night_avail = 0

    curr_d = start_date
    while curr_d <= end_date:
        dow = curr_d.weekday()
        bh = hours_by_dow.get(dow)
        if bh:
            open_m = bh.opens_at.hour * 60 + bh.opens_at.minute
            close_m = bh.closes_at.hour * 60 + bh.closes_at.minute
            if bh.closes_next_day or close_m <= open_m:
                close_m += 1440  # next day wrap

            def overlap_minutes(s1: int, e1: int, s2: int, e2: int) -> int:
                return max(0, min(e1, e2) - max(s1, s2))

            m_min = overlap_minutes(open_m, close_m, 6 * 60, 12 * 60)
            a_min = overlap_minutes(open_m, close_m, 12 * 60, 18 * 60)
            n_min = overlap_minutes(open_m, close_m, 18 * 60, 24 * 60)

            morning_avail += m_min * active_court_count
            afternoon_avail += a_min * active_court_count
            night_avail += n_min * active_court_count

        curr_d += timedelta(days=1)

    total_avail = morning_avail + afternoon_avail + night_avail
    total_avail_per_court = total_avail // active_court_count if active_court_count > 0 else 0

    # Fetch confirmed/completed bookings
    bookings = (
        await db.scalars(
            select(BookingModel).where(
                BookingModel.club_id == club_id,
                BookingModel.status.in_(["confirmed", "completed"]),
                func.tstzrange(range_start_utc, range_end_utc, "[]").op("&&")(BookingModel.period),
            )
        )
    ).all()

    morning_booked = 0
    afternoon_booked = 0
    night_booked = 0
    court_booked_map = {c.id: 0 for c in courts}

    for b in bookings:
        b_start = b.period.lower.astimezone(local_tz)
        b_end = b.period.upper.astimezone(local_tz)
        duration_min = int((b_end - b_start).total_seconds() // 60)

        if b.court_id in court_booked_map:
            court_booked_map[b.court_id] += duration_min

        # Bucket distribution based on start hour
        h = b_start.hour
        if 6 <= h < 12:
            morning_booked += duration_min
        elif 12 <= h < 18:
            afternoon_booked += duration_min
        else:
            night_booked += duration_min

    total_booked = sum(court_booked_map.values())
    overall_pct = round((total_booked / total_avail * 100), 2) if total_avail > 0 else 0.0

    by_tod = [
        OccupancySlotReport(
            time_bucket="Mañana (06:00 - 12:00)",
            available_minutes=morning_avail,
            booked_minutes=morning_booked,
            occupancy_percentage=round((morning_booked / morning_avail * 100), 2)
            if morning_avail > 0
            else 0.0,
        ),
        OccupancySlotReport(
            time_bucket="Tarde (12:00 - 18:00)",
            available_minutes=afternoon_avail,
            booked_minutes=afternoon_booked,
            occupancy_percentage=round((afternoon_booked / afternoon_avail * 100), 2)
            if afternoon_avail > 0
            else 0.0,
        ),
        OccupancySlotReport(
            time_bucket="Noche (18:00 - 00:00)",
            available_minutes=night_avail,
            booked_minutes=night_booked,
            occupancy_percentage=round((night_booked / night_avail * 100), 2)
            if night_avail > 0
            else 0.0,
        ),
    ]

    by_court = [
        OccupancyCourtReport(
            court_id=c_id,
            court_name=court_name,
            available_minutes=total_avail_per_court,
            booked_minutes=court_booked_map.get(c_id, 0),
            occupancy_percentage=round(
                (court_booked_map.get(c_id, 0) / total_avail_per_court * 100), 2
            )
            if total_avail_per_court > 0
            else 0.0,
        )
        for c_id, court_name in court_map.items()
    ]

    return ClubOccupancyResponse(
        club_id=club_id,
        start_date=start_date,
        end_date=end_date,
        total_available_minutes=total_avail,
        total_booked_minutes=total_booked,
        overall_occupancy_percentage=overall_pct,
        by_time_of_day=by_tod,
        by_court=by_court,
    )


@router.get("/{club_id}/reports/revenue", response_model=ClubRevenueResponse)
async def get_club_revenue_report(
    club_id: UUID,
    auth_context: Annotated[tuple[UUID, UserContext], Depends(require_club_role("admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    start_date: Annotated[date, Query()],
    end_date: Annotated[date, Query()],
) -> ClubRevenueResponse:
    """Calculates accumulated revenue aggregated by day and court."""
    if end_date < start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La fecha de fin no puede ser anterior a la fecha de inicio",
        )
    if (end_date - start_date).days > 366:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El rango máximo de reporte de ingresos es de 366 días",
        )

    club = await db.get(ClubModel, club_id)
    if not club:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Club no encontrado")

    local_tz = ZoneInfo(club.timezone)
    courts = (
        await db.scalars(
            select(CourtModel).where(CourtModel.club_id == club_id, CourtModel.deleted_at.is_(None))
        )
    ).all()
    court_map = {c.id: c.name for c in courts}

    range_start_dt = datetime.combine(start_date, time.min, tzinfo=local_tz)
    range_end_dt = datetime.combine(end_date, time.max, tzinfo=local_tz)
    range_start_utc = range_start_dt.astimezone(UTC)
    range_end_utc = range_end_dt.astimezone(UTC)

    bookings = (
        await db.scalars(
            select(BookingModel).where(
                BookingModel.club_id == club_id,
                BookingModel.status.in_(["confirmed", "completed"]),
                func.tstzrange(range_start_utc, range_end_utc, "[]").op("&&")(BookingModel.period),
            )
        )
    ).all()

    total_rev = 0
    total_count = len(bookings)
    daily_map: dict[date, dict[str, int]] = {}
    court_rev_map: dict[UUID, dict[str, int]] = {c.id: {"count": 0, "rev": 0} for c in courts}

    for b in bookings:
        b_date = b.period.lower.astimezone(local_tz).date()
        price = b.price_cents
        total_rev += price

        if b_date not in daily_map:
            daily_map[b_date] = {"count": 0, "rev": 0}
        daily_map[b_date]["count"] += 1
        daily_map[b_date]["rev"] += price

        if b.court_id in court_rev_map:
            court_rev_map[b.court_id]["count"] += 1
            court_rev_map[b.court_id]["rev"] += price

    daily_reports = [
        RevenueDailyReport(
            date=d,
            booking_count=vals["count"],
            total_revenue_cents=vals["rev"],
            average_ticket_cents=vals["rev"] // vals["count"] if vals["count"] > 0 else 0,
        )
        for d, vals in sorted(daily_map.items())
    ]

    by_court_reports = [
        RevenueCourtReport(
            court_id=c_id,
            court_name=court_map.get(c_id, "Cancha"),
            booking_count=vals["count"],
            total_revenue_cents=vals["rev"],
        )
        for c_id, vals in court_rev_map.items()
    ]

    avg_ticket = total_rev // total_count if total_count > 0 else 0

    return ClubRevenueResponse(
        club_id=club_id,
        start_date=start_date,
        end_date=end_date,
        currency=(club.settings or {}).get("currency", "COP"),
        total_revenue_cents=total_rev,
        total_bookings=total_count,
        average_ticket_cents=avg_ticket,
        daily=daily_reports,
        by_court=by_court_reports,
    )


# ---------------------------------------------------------
# STAFF / RECEPCIONISTAS CRUD
# ---------------------------------------------------------
@router.get("/{club_id}/staff", response_model=list[ClubStaffMemberResponse])
async def list_club_staff(
    auth_context: Annotated[tuple[UUID, UserContext], Depends(require_club_role("staff"))],
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> list[ClubStaffMemberResponse]:
    """Lists receptionists and administrators of this club."""
    club_id, _ = auth_context
    query = (
        select(ClubMemberModel)
        .options(selectinload(ClubMemberModel.user))
        .where(ClubMemberModel.club_id == club_id)
        .order_by(ClubMemberModel.created_at.desc())
    )
    res = await db.scalars(query)
    members = res.all()
    return [
        ClubStaffMemberResponse(
            id=m.id,
            user_id=m.user_id,
            club_id=m.club_id,
            role=m.role,
            is_active=m.is_active,
            user_email=m.user.email if m.user else "",
            user_full_name=m.user.full_name if m.user else "Usuario",
            user_phone=m.user.phone if m.user else None,
            created_at=m.created_at,
        )
        for m in members
        if m.user
    ]


@router.post(
    "/{club_id}/staff",
    response_model=ClubStaffMemberResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_club_staff(
    data: ClubStaffCreateRequest,
    auth_context: Annotated[tuple[UUID, UserContext], Depends(require_club_role("admin"))],
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> ClubStaffMemberResponse:
    """Allows a club admin/owner to register or assign a receptionist/admin to their club."""
    club_id, _ = auth_context
    clean_email = data.email.lower().strip()

    user = await db.scalar(select(UserModel).where(UserModel.email == clean_email))
    if not user:
        user = UserModel(
            id=uuid6.uuid7(),
            email=clean_email,
            password_hash=hash_password(data.password),
            full_name=data.full_name.strip(),
            phone=data.phone.strip() if data.phone else None,
            is_superadmin=False,
        )
        db.add(user)
        await db.flush()

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
            club_id=club_id,
            role=data.role,
            is_active=True,
        )
        db.add(membership)

    await db.commit()
    await db.refresh(membership)
    await db.refresh(user)

    return ClubStaffMemberResponse(
        id=membership.id,
        user_id=user.id,
        club_id=club_id,
        role=membership.role,
        is_active=membership.is_active,
        user_email=user.email,
        user_full_name=user.full_name,
        user_phone=user.phone,
        created_at=membership.created_at,
    )


@router.delete(
    "/{club_id}/staff/{member_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_club_staff(
    member_id: UUID,
    auth_context: Annotated[tuple[UUID, UserContext], Depends(require_club_role("admin"))],
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> Response:
    """Removes a receptionist/staff member from this club."""
    club_id, user_ctx = auth_context
    membership = await db.get(ClubMemberModel, member_id)
    if not membership or membership.club_id != club_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Miembro no encontrado")

    if membership.user_id == user_ctx.user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No puedes remover tu propia membresía de administrador",
        )

    await db.delete(membership)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------
# DAILY STORE SALES (TIENDA / CAFETERIA)
# ---------------------------------------------------------
@router.get("/{club_id}/store-sales", response_model=list[DailyStoreSaleResponse])
async def list_daily_store_sales(
    auth_context: Annotated[tuple[UUID, UserContext], Depends(require_club_role("staff"))],
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> list[DailyStoreSaleResponse]:
    club_id, _ = auth_context
    query = (
        select(DailyStoreSaleModel)
        .where(DailyStoreSaleModel.club_id == club_id)
        .order_by(DailyStoreSaleModel.sale_date.desc())
        .limit(60)
    )
    records = (await db.scalars(query)).all()
    return [
        DailyStoreSaleResponse(
            id=r.id,
            club_id=r.club_id,
            sale_date=r.sale_date.isoformat(),
            amount_cents=r.amount_cents,
            notes=r.notes,
            created_at=r.created_at,
        )
        for r in records
    ]


@router.post(
    "/{club_id}/store-sales",
    response_model=DailyStoreSaleResponse,
    status_code=status.HTTP_200_OK,
)
async def record_daily_store_sale(
    data: DailyStoreSaleCreateRequest,
    auth_context: Annotated[tuple[UUID, UserContext], Depends(require_club_role("staff"))],
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> DailyStoreSaleResponse:
    club_id, _ = auth_context
    query = select(DailyStoreSaleModel).where(
        DailyStoreSaleModel.club_id == club_id,
        DailyStoreSaleModel.sale_date == data.sale_date,
    )
    existing = await db.scalar(query)
    if existing:
        existing.amount_cents = data.amount_cents
        existing.notes = data.notes
        await db.commit()
        await db.refresh(existing)
        record = existing
    else:
        record = DailyStoreSaleModel(
            id=uuid6.uuid7(),
            club_id=club_id,
            sale_date=data.sale_date,
            amount_cents=data.amount_cents,
            notes=data.notes,
        )
        db.add(record)
        await db.commit()
        await db.refresh(record)

    return DailyStoreSaleResponse(
        id=record.id,
        club_id=record.club_id,
        sale_date=record.sale_date.isoformat(),
        amount_cents=record.amount_cents,
        notes=record.notes,
        created_at=record.created_at,
    )


@router.delete(
    "/{club_id}/store-sales/{sale_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_daily_store_sale(
    sale_id: UUID,
    auth_context: Annotated[tuple[UUID, UserContext], Depends(require_club_role("admin"))],
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> Response:
    club_id, _ = auth_context
    record = await db.get(DailyStoreSaleModel, sale_id)
    if not record or record.club_id != club_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Registro de venta no encontrado")
    await db.delete(record)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)



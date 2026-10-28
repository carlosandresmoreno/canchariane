import hashlib
import json
from datetime import UTC, date, datetime, timedelta
from typing import Annotated, Any
from zoneinfo import ZoneInfo

import asyncpg
import uuid6
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response, status
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_db
from app.application.dto.public import (
    BookingPublicDTO,
    BusinessHoursPublicDTO,
    CancelBookingRequest,
    ClubPublicDetail,
    ClubPublicSummary,
    ConfirmBookingRequest,
    CourtGroupPublicDTO,
    CourtPublicDTO,
    CreateHoldRequest,
    HoldResponse,
    SlotPublicDTO,
)
from app.config import settings
from app.domain.entities.business_hours import BusinessHours
from app.domain.entities.court import Court
from app.domain.entities.pricing_rule import PricingRule
from app.domain.entities.time_block import TimeBlock
from app.domain.exceptions import (
    EntityNotFoundError,
    HoldExpiredError,
    InvalidBookingStatusTransitionError,
    SlotUnavailableError,
)
from app.domain.services.availability import compute_slots
from app.domain.value_objects.booking_code import BookingCode
from app.domain.value_objects.money import Money
from app.domain.value_objects.slot import CourtInterval
from app.domain.value_objects.time_slot import TimeSlot
from app.infrastructure.db.models import (
    BlockModel,
    BookingEventModel,
    BookingModel,
    ClubLayoutModel,
    ClubModel,
    CourtModel,
    IdempotencyKeyModel,
)

router = APIRouter(tags=["Public Booking"])


@router.get("/clubs", response_model=list[ClubPublicSummary])
async def list_published_clubs(
    city: str | None = None,
    sport: str | None = None,
    search: str | None = None,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> list[ClubPublicSummary]:
    query = (
        select(ClubModel)
        .where(
            ClubModel.is_published.is_(True),
            ClubModel.deleted_at.is_(None),
            ClubModel.subscription_status.in_(["active", "trial"]),
        )
        .options(selectinload(ClubModel.courts))
    )

    if search:
        query = query.where(ClubModel.name.ilike(f"%{search.strip()}%"))
    if city:
        query = query.where(ClubModel.address.ilike(f"%{city.strip()}%"))

    result = await db.scalars(query)
    clubs = result.all()

    if sport:
        clubs = [
            c for c in clubs if any(court.sport == sport and court.is_active for court in c.courts)
        ]

    return [
        ClubPublicSummary(
            id=c.id,
            slug=c.slug,
            name=c.name,
            timezone=c.timezone,
            address=c.address,
            phone=c.phone,
            logo_url=c.logo_url,
            latitude=(c.settings or {}).get("latitude"),
            longitude=(c.settings or {}).get("longitude"),
            city=(c.settings or {}).get("city", "Pereira"),
            sports=sorted(list(set(court.sport for court in c.courts if court.is_active))),
        )
        for c in clubs
    ]


@router.get("/clubs/{slug}", response_model=ClubPublicDetail)
async def get_club_by_slug(
    slug: str,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> ClubPublicDetail:
    query = (
        select(ClubModel)
        .where(
            ClubModel.slug == slug,
            ClubModel.is_published.is_(True),
            ClubModel.deleted_at.is_(None),
            ClubModel.subscription_status.in_(["active", "trial"]),
        )
        .options(
            selectinload(ClubModel.courts),
            selectinload(ClubModel.business_hours),
            selectinload(ClubModel.pricing_rules),
        )
    )
    club = await db.scalar(query)
    if not club:
        raise HTTPException(status_code=404, detail="Club no encontrado")

    active_courts = []
    for c in club.courts:
        if c.is_active and c.deleted_at is None:
            court_price = None
            for pr in (club.pricing_rules or []):
                if pr.court_id == c.id:
                    court_price = pr.price_cents
                    break
            if court_price is None:
                for pr in (club.pricing_rules or []):
                    if pr.court_id is None:
                        court_price = pr.price_cents
                        break
            active_courts.append(
                CourtPublicDTO(
                    id=c.id,
                    name=c.name,
                    sport=c.sport,
                    surface=c.surface,
                    player_format=c.player_format,
                    is_covered=c.is_covered,
                    has_lighting=c.has_lighting,
                    price_per_hour_cents=court_price or 6000000,
                )
            )

    hours = [
        BusinessHoursPublicDTO(
            weekday=h.weekday,
            opens_at=h.opens_at.strftime("%H:%M"),
            closes_at=h.closes_at.strftime("%H:%M"),
            closes_next_day=h.closes_next_day,
        )
        for h in sorted(club.business_hours, key=lambda x: x.weekday)
    ]

    s = club.settings or {}
    allowed_durations = s.get("allowed_durations") or [60]
    default_duration = s.get("default_duration") or (allowed_durations[0] if allowed_durations else 60)
    slot_step_minutes = s.get("slot_step_minutes")
    court_selection_mode = s.get("court_selection_mode", "manual")

    # Build Court Categories / Groups
    groups_map: dict[str, dict[str, Any]] = {}
    for c in active_courts:
        fmt_clean = c.player_format.lower().replace(" ", "")
        key = f"{c.sport}-{fmt_clean}".lower()
        format_label = c.player_format.upper() if "x" in c.player_format else c.player_format.capitalize()
        sport_label = c.sport.capitalize()
        group_name = f"{sport_label} ({format_label})"
        if key not in groups_map:
            groups_map[key] = {
                "id": key,
                "name": group_name,
                "sport": c.sport,
                "player_format": c.player_format,
                "surface": c.surface,
                "is_covered": c.is_covered,
                "price_per_hour_cents": c.price_per_hour_cents or 6000000,
                "court_ids": [],
                "court_count": 0,
                "selection_mode": "auto" if court_selection_mode == "by_category" else "manual",
            }
        groups_map[key]["court_ids"].append(c.id)
        groups_map[key]["court_count"] += 1
        if c.price_per_hour_cents and c.price_per_hour_cents < groups_map[key]["price_per_hour_cents"]:
            groups_map[key]["price_per_hour_cents"] = c.price_per_hour_cents

    court_groups = [CourtGroupPublicDTO(**g) for g in groups_map.values()]

    return ClubPublicDetail(
        id=club.id,
        slug=club.slug,
        name=club.name,
        timezone=club.timezone,
        address=club.address,
        phone=club.phone,
        logo_url=club.logo_url,
        latitude=s.get("latitude"),
        longitude=s.get("longitude"),
        city=s.get("city", "Pereira"),
        courts=active_courts,
        business_hours=hours,
        allowed_durations=allowed_durations,
        default_duration=default_duration,
        slot_step_minutes=slot_step_minutes,
        court_selection_mode=court_selection_mode,
        court_groups=court_groups,
        announcement=s.get("announcement"),
    )


@router.get("/clubs/{slug}/layout")
async def get_public_club_layout(
    slug: str,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> dict[str, Any]:
    """Returns normalized SVG layout geometry for the interactive court map with ETag caching."""
    club = await db.scalar(
        select(ClubModel)
        .where(
            ClubModel.slug == slug,
            ClubModel.is_published.is_(True),
            ClubModel.deleted_at.is_(None),
            ClubModel.subscription_status.in_(["active", "trial"]),
        )
        .options(selectinload(ClubModel.courts))
    )
    if not club:
        raise HTTPException(status_code=404, detail="Club no encontrado")

    layout = await db.scalar(select(ClubLayoutModel).where(ClubLayoutModel.club_id == club.id))
    active_courts = [c for c in club.courts if c.is_active and c.deleted_at is None]

    if layout:
        view_box_w = layout.view_box_w or 1000
        view_box_h = layout.view_box_h or 1000
        decorations = layout.decorations or []
        courts = [
            {
                "court_id": str(c.id),
                "label": c.name,
                "shape": c.shape,
            }
            for c in active_courts
            if c.shape
        ]
        # If courts don't have custom shapes yet, fallback to grid
        if not courts:
            n = max(1, len(active_courts))
            cols = 2 if n <= 4 else 3
            rows = (n + cols - 1) // cols
            c_w = (view_box_w - (cols + 1) * 40) // cols
            c_h = 220
            for idx, court in enumerate(active_courts):
                r = idx // cols
                col = idx % cols
                x = 40 + col * (c_w + 40)
                y = 40 + r * (c_h + 40)
                courts.append(
                    {
                        "court_id": str(court.id),
                        "label": court.name,
                        "shape": {
                            "kind": "rect",
                            "x": x,
                            "y": y,
                            "w": c_w,
                            "h": c_h,
                            "rotation": 0,
                        },
                    }
                )
    else:
        # Default responsive grid layout for active courts
        n = max(1, len(active_courts))
        cols = 2 if n <= 4 else 3
        rows = (n + cols - 1) // cols
        view_box_w = 1000
        view_box_h = max(600, rows * 260 + 80)
        c_w = (view_box_w - (cols + 1) * 40) // cols
        c_h = 220
        decorations = []
        courts = []
        for idx, court in enumerate(active_courts):
            r = idx // cols
            col = idx % cols
            x = 40 + col * (c_w + 40)
            y = 40 + r * (c_h + 40)
            courts.append(
                {
                    "court_id": str(court.id),
                    "label": court.name,
                    "shape": {
                        "kind": "rect",
                        "x": x,
                        "y": y,
                        "w": c_w,
                        "h": c_h,
                        "rotation": 0,
                    },
                }
            )
        decorations = []

    result = {
        "club_id": str(club.id),
        "name": club.name,
        "view_box_w": view_box_w,
        "view_box_h": view_box_h,
        "courts": courts,
        "decorations": decorations,
    }

    etag = hashlib.md5(json.dumps(result, sort_keys=True).encode()).hexdigest()
    response.headers["ETag"] = f'"{etag}"'
    response.headers["Cache-Control"] = "public, max-age=300"
    return result


@router.get("/clubs/{slug}/availability", response_model=list[SlotPublicDTO])
async def get_club_availability(
    slug: str,
    target_date: Annotated[date, Query(alias="date")],
    sport: str | None = None,
    duration: Annotated[int, Query(ge=30, le=240)] = 60,
    step: Annotated[int | None, Query(ge=15, le=240)] = None,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> list[SlotPublicDTO]:
    # 1. Fetch club
    club_query = (
        select(ClubModel)
        .where(
            ClubModel.slug == slug,
            ClubModel.is_published.is_(True),
            ClubModel.deleted_at.is_(None),
            ClubModel.subscription_status.in_(["active", "trial"]),
        )
        .options(
            selectinload(ClubModel.courts),
            selectinload(ClubModel.business_hours),
            selectinload(ClubModel.pricing_rules),
        )
    )
    club = await db.scalar(club_query)
    if not club:
        raise HTTPException(status_code=404, detail="Club no encontrado")

    club_tz = ZoneInfo(club.timezone)

    # 2. Get business hours for that weekday
    weekday = target_date.weekday()
    hours_model = next((h for h in club.business_hours if h.weekday == weekday), None)
    domain_hours = (
        BusinessHours(
            weekday=hours_model.weekday,
            opens_at=hours_model.opens_at,
            closes_at=hours_model.closes_at,
            closes_next_day=hours_model.closes_next_day,
        )
        if hours_model
        else None
    )

    # 3. Active courts
    active_courts_models = [
        c
        for c in club.courts
        if c.is_active and c.deleted_at is None and (not sport or c.sport == sport)
    ]
    domain_courts = [
        Court(
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
        )
        for c in active_courts_models
    ]

    # 4. Domain pricing rules
    domain_pricing = [
        PricingRule(
            id=r.id,
            club_id=r.club_id,
            court_id=r.court_id,
            weekday_mask=r.weekday_mask,
            start_time=r.start_time,
            end_time=r.end_time,
            price=Money(cents=r.price_cents, currency=r.currency),
            valid_from=r.valid_from,
            valid_to=r.valid_to,
        )
        for r in club.pricing_rules
    ]

    # 5. Overlapping occupied bookings and blocks
    day_start_utc = datetime.combine(target_date, datetime.min.time(), tzinfo=club_tz).astimezone(
        UTC
    )
    day_end_utc = datetime.combine(
        target_date + timedelta(days=2), datetime.min.time(), tzinfo=club_tz
    ).astimezone(UTC)
    search_range = asyncpg.Range(day_start_utc, day_end_utc, lower_inc=True, upper_inc=False)

    # Active bookings (held or confirmed)
    bookings_query = select(BookingModel).where(
        BookingModel.club_id == club.id,
        BookingModel.status.in_(["held", "confirmed"]),
        BookingModel.period.op("&&")(search_range),
    )
    occupied_records = (await db.scalars(bookings_query)).all()
    domain_occupied = [
        CourtInterval(
            court_id=b.court_id,
            period=TimeSlot(start=b.period.lower, end=b.period.upper),
        )
        for b in occupied_records
    ]

    # Blocks
    blocks_query = select(BlockModel).where(
        BlockModel.club_id == club.id,
        BlockModel.period.op("&&")(search_range),
    )
    block_records = (await db.scalars(blocks_query)).all()
    domain_blocks = [
        TimeBlock(
            id=b.id,
            club_id=b.club_id,
            court_id=b.court_id,
            period=TimeSlot(start=b.period.lower, end=b.period.upper),
            kind=b.kind,
            reason=b.reason,
        )
        for b in block_records
    ]

    # 6. Execute pure domain compute_slots
    club_settings = club.settings or {}
    allowed_durations = club_settings.get("allowed_durations") or [60]
    if duration not in allowed_durations:
        if duration == 60 and 60 not in allowed_durations:
            duration = club_settings.get("default_duration") or allowed_durations[0]
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Este club no permite turnos de {duration} minutos. Opciones disponibles: {allowed_durations}",
            )

    step_minutes = step
    if step_minutes is None:
        step_minutes = club_settings.get("slot_step_minutes")
        if not step_minutes:
            step_minutes = duration

    slots = compute_slots(
        day=target_date,
        tz=club_tz,
        business_hours=domain_hours,
        courts=domain_courts,
        occupied=domain_occupied,
        blocks=domain_blocks,
        pricing_rules=domain_pricing,
        duration=timedelta(minutes=duration),
        step=timedelta(minutes=step_minutes),
        now=datetime.now(UTC),
        min_lead_time=timedelta(minutes=settings.MIN_LEAD_TIME_MINUTES),
        default_price=Money(cents=5000000, currency="COP"),
    )

    return [
        SlotPublicDTO(
            court_id=s.court_id,
            court_name=s.court_name,
            period_start_utc=s.period.start,
            period_end_utc=s.period.end,
            local_start=s.local_start.strftime("%H:%M"),
            local_end=s.local_end.strftime("%H:%M"),
            price_cents=s.price.cents,
            hourly_rate_cents=s.hourly_rate.cents if s.hourly_rate else None,
            currency=s.price.currency,
        )
        for s in slots
    ]


@router.post("/bookings/holds", response_model=HoldResponse, status_code=status.HTTP_201_CREATED)
async def create_hold(
    data: CreateHoldRequest,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> HoldResponse:
    # 1. Fetch club and court
    club_query = (
        select(ClubModel)
        .where(
            ClubModel.slug == data.club_slug,
            ClubModel.is_published.is_(True),
            ClubModel.deleted_at.is_(None),
            ClubModel.subscription_status.in_(["active", "trial"]),
        )
        .options(
            selectinload(ClubModel.courts),
            selectinload(ClubModel.pricing_rules),
            selectinload(ClubModel.business_hours),
        )
    )
    club = await db.scalar(club_query)
    if not club:
        raise HTTPException(status_code=404, detail="Club no encontrado")

    # 2. Time periods and Operating Hours Validation
    period_start = data.start_time.astimezone(UTC)
    period_end = period_start + timedelta(minutes=data.duration_minutes)
    period_range = asyncpg.Range(period_start, period_end, lower_inc=True, upper_inc=False)

    club_tz = ZoneInfo(club.timezone)
    local_start = period_start.astimezone(club_tz)
    local_end = period_end.astimezone(club_tz)

    weekday = local_start.weekday()
    hours_model = next((h for h in (club.business_hours or []) if h.weekday == weekday), None)
    if not hours_model:
        raise HTTPException(
            status_code=400,
            detail="El club se encuentra cerrado en el día seleccionado.",
        )

    opening_dt = datetime.combine(local_start.date(), hours_model.opens_at, tzinfo=club_tz)
    closing_day = local_start.date() + timedelta(days=1) if hours_model.closes_next_day else local_start.date()
    closing_dt = datetime.combine(closing_day, hours_model.closes_at, tzinfo=club_tz)

    if local_start < opening_dt or local_end > closing_dt:
        raise HTTPException(
            status_code=400,
            detail=f"El horario seleccionado ({local_start.strftime('%H:%M')} - {local_end.strftime('%H:%M')}) está fuera del horario de atención del club.",
        )

    # 3. Resolve Court (Explicit selection or Automatic Allocation)
    court = None
    if data.court_id:
        court = next((c for c in club.courts if c.id == data.court_id and c.is_active and c.deleted_at is None), None)
        if not court:
            court = await db.get(CourtModel, data.court_id)
            if not court or court.club_id != club.id or not court.is_active or court.deleted_at is not None:
                raise HTTPException(status_code=404, detail="Cancha no encontrada o inactiva")
    else:
        # Automatic allocation: find eligible active courts
        candidate_courts = [c for c in club.courts if c.is_active and c.deleted_at is None]
        if data.group_id:
            candidate_courts = [
                c for c in candidate_courts
                if f"{c.sport}-{c.player_format.replace(' ', '')}".lower() == data.group_id.lower()
            ]
        if not candidate_courts:
            raise HTTPException(status_code=404, detail="No hay canchas disponibles para esta modalidad.")

        candidate_ids = [c.id for c in candidate_courts]
        # Query busy bookings
        busy_bookings_query = select(BookingModel.court_id).where(
            BookingModel.club_id == club.id,
            BookingModel.court_id.in_(candidate_ids),
            BookingModel.status.in_(["held", "confirmed"]),
            BookingModel.period.op("&&")(period_range),
        )
        busy_court_ids = set((await db.scalars(busy_bookings_query)).all())

        # Query busy blocks
        busy_blocks_query = select(BlockModel.court_id).where(
            BlockModel.club_id == club.id,
            or_(BlockModel.court_id.in_(candidate_ids), BlockModel.court_id.is_(None)),
            BlockModel.period.op("&&")(period_range),
        )
        for b_court_id in (await db.scalars(busy_blocks_query)).all():
            if b_court_id is None:
                busy_court_ids.update(candidate_ids)
            else:
                busy_court_ids.add(b_court_id)

        free_courts = [c for c in candidate_courts if c.id not in busy_court_ids]
        if not free_courts:
            raise HTTPException(
                status_code=409,
                detail="Todas las canchas de esta modalidad se encuentran ocupadas en este horario.",
            )
        court = free_courts[0]

    # 3. Resolve price
    price_cents = 5000000  # Default $50.000 COP
    currency = "COP"

    for rule in club.pricing_rules:
        weekday = local_start.weekday()
        if (
            (rule.weekday_mask & (1 << weekday))
            and (rule.start_time <= local_start.time() < rule.end_time)
            and (rule.court_id is None or rule.court_id == court.id)
        ):
            price_cents = rule.price_cents
            currency = rule.currency
            if rule.court_id == court.id:
                break

    # 3.4 Check allowed durations
    club_settings = club.settings or {}
    allowed_durations = club_settings.get("allowed_durations") or [60]
    if data.duration_minutes not in allowed_durations:
        raise HTTPException(
            status_code=400,
            detail=f"Este club no permite turnos de {data.duration_minutes} minutos. Opciones disponibles: {allowed_durations}",
        )

    # Scale price proportionally with duration relative to 60-min standard rate
    if data.duration_minutes != 60 and price_cents > 0:
        price_cents = int(round(price_cents * (data.duration_minutes / 60.0)))

    # 3.5 Check if court is blocked for maintenance, tournament, etc.
    block_conflict_query = select(BlockModel).where(
        BlockModel.club_id == club.id,
        or_(BlockModel.court_id == court.id, BlockModel.court_id.is_(None)),
        BlockModel.period.op("&&")(period_range),
    )
    block_conflict = await db.scalar(block_conflict_query)
    if block_conflict:
        reason_str = f": {block_conflict.reason}" if block_conflict.reason else ""
        raise HTTPException(
            status_code=409,
            detail=f"La cancha no está disponible en este horario por mantenimiento o evento{reason_str}.",
        )

    # 4. Attempt atomic hold insert directly guarded by GiST constraint
    hold_id = uuid6.uuid7()
    code = BookingCode.generate().value
    expires_at = datetime.now(UTC) + timedelta(minutes=settings.HOLD_EXPIRATION_MINUTES)

    booking = BookingModel(
        id=hold_id,
        code=code,
        club_id=club.id,
        court_id=court.id,
        period=period_range,
        status="held",
        customer_name="Invitado (Hold)",
        customer_phone="",
        customer_email="",
        price_cents=price_cents,
        currency=currency,
        payment_status="not_required",
        expires_at=expires_at,
    )
    db.add(booking)

    # Audit event
    event = BookingEventModel(
        id=uuid6.uuid7(),
        booking_id=hold_id,
        event_type="held",
        actor_type="guest",
        payload={"duration_minutes": data.duration_minutes, "expires_at": expires_at.isoformat()},
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

    return HoldResponse(
        hold_id=hold_id,
        code=code,
        club_id=club.id,
        court_id=court.id,
        court_name=court.name,
        period_start=period_start,
        period_end=period_end,
        price_cents=price_cents,
        currency=currency,
        expires_at=expires_at,
    )


@router.post("/bookings", response_model=BookingPublicDTO)
async def confirm_booking(
    data: ConfirmBookingRequest,
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> BookingPublicDTO:
    if not idempotency_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Header 'Idempotency-Key' es obligatorio para confirmar reservas",
        )

    # 1. Idempotency check: Return cached response if key was already processed
    idemp_query = select(IdempotencyKeyModel).where(IdempotencyKeyModel.key == idempotency_key)
    idemp_record = await db.scalar(idemp_query)
    if idemp_record:
        return BookingPublicDTO(**idemp_record.response_body)

    # 2. Query booking hold
    booking = await db.get(BookingModel, data.hold_id)
    if not booking:
        raise EntityNotFoundError(entity="Reserva", identifier=str(data.hold_id))

    if booking.status != "held":
        raise InvalidBookingStatusTransitionError(booking.status, "confirmed")

    # 3. Verify expiration
    now = datetime.now(UTC)
    if booking.expires_at and now > booking.expires_at:
        booking.status = "expired"
        await db.commit()
        raise HoldExpiredError(str(booking.id))

    # 4. Confirm booking
    booking.status = "confirmed"
    booking.customer_name = data.customer_name.strip()
    booking.customer_phone = data.customer_phone.strip()
    booking.customer_email = data.customer_email.lower().strip()
    booking.expires_at = None

    # Audit event
    event = BookingEventModel(
        id=uuid6.uuid7(),
        booking_id=booking.id,
        event_type="confirmed",
        actor_type="guest",
        payload={
            "customer_name": booking.customer_name,
            "customer_phone": booking.customer_phone,
            "customer_email": booking.customer_email,
        },
    )
    db.add(event)

    result_dto = BookingPublicDTO(
        id=booking.id,
        code=booking.code,
        club_id=booking.club_id,
        court_id=booking.court_id,
        period_start=booking.period.lower,
        period_end=booking.period.upper,
        status="confirmed",
        customer_name=booking.customer_name,
        customer_phone=booking.customer_phone,
        customer_email=booking.customer_email,
        price_cents=booking.price_cents,
        currency=booking.currency,
        payment_status=booking.payment_status,
        expires_at=None,
        created_at=booking.created_at,
    )

    # Save idempotency cache
    idemp = IdempotencyKeyModel(
        id=uuid6.uuid7(),
        key=idempotency_key,
        target_type="booking_confirmation",
        response_code=200,
        response_body=result_dto.model_dump(mode="json"),
    )
    db.add(idemp)

    await db.commit()
    return result_dto


@router.get("/bookings/by-code/{code}", response_model=BookingPublicDTO)
async def get_booking_by_code(
    code: str,
    phone: str | None = None,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> BookingPublicDTO:
    query = select(BookingModel).where(BookingModel.code == code.upper().strip())
    booking = await db.scalar(query)
    if not booking:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")

    if phone and not booking.customer_phone.endswith(phone.strip()[-4:]):
        raise HTTPException(status_code=404, detail="Número de teléfono no coincide con la reserva")

    return BookingPublicDTO(
        id=booking.id,
        code=booking.code,
        club_id=booking.club_id,
        court_id=booking.court_id,
        period_start=booking.period.lower,
        period_end=booking.period.upper,
        status=booking.status,
        customer_name=booking.customer_name,
        customer_phone=booking.customer_phone,
        customer_email=booking.customer_email,
        price_cents=booking.price_cents,
        currency=booking.currency,
        payment_status=booking.payment_status,
        expires_at=booking.expires_at,
        created_at=booking.created_at,
    )


@router.post("/bookings/by-code/{code}/cancel", response_model=BookingPublicDTO)
async def cancel_booking_by_code(
    code: str,
    data: CancelBookingRequest,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> BookingPublicDTO:
    query = select(BookingModel).where(BookingModel.code == code.upper().strip())
    booking = await db.scalar(query)
    if not booking:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")

    if data.phone and not booking.customer_phone.endswith(data.phone.strip()[-4:]):
        raise HTTPException(status_code=400, detail="El teléfono no coincide con la reserva")

    if booking.status in ["cancelled", "expired", "completed"]:
        raise InvalidBookingStatusTransitionError(booking.status, "cancelled")

    booking.status = "cancelled"
    booking.cancellation_reason = data.reason or "Cancelado por el cliente"

    event = BookingEventModel(
        id=uuid6.uuid7(),
        booking_id=booking.id,
        event_type="cancelled",
        actor_type="guest",
        payload={"reason": booking.cancellation_reason},
    )
    db.add(event)
    await db.commit()

    return BookingPublicDTO(
        id=booking.id,
        code=booking.code,
        club_id=booking.club_id,
        court_id=booking.court_id,
        period_start=booking.period.lower,
        period_end=booking.period.upper,
        status="cancelled",
        customer_name=booking.customer_name,
        customer_phone=booking.customer_phone,
        customer_email=booking.customer_email,
        price_cents=booking.price_cents,
        currency=booking.currency,
        payment_status=booking.payment_status,
        expires_at=None,
        created_at=booking.created_at,
    )

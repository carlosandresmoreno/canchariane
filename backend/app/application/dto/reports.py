from datetime import date
from uuid import UUID

from pydantic import BaseModel, Field


class OccupancySlotReport(BaseModel):
    time_bucket: str  # "morning (06:00-12:00)", "afternoon (12:00-18:00)", "night (18:00-00:00)"
    available_minutes: int = Field(ge=0)
    booked_minutes: int = Field(ge=0)
    occupancy_percentage: float = Field(ge=0.0, le=100.0)


class OccupancyCourtReport(BaseModel):
    court_id: UUID
    court_name: str
    available_minutes: int = Field(ge=0)
    booked_minutes: int = Field(ge=0)
    occupancy_percentage: float = Field(ge=0.0, le=100.0)


class ClubOccupancyResponse(BaseModel):
    club_id: UUID
    start_date: date
    end_date: date
    total_available_minutes: int
    total_booked_minutes: int
    overall_occupancy_percentage: float
    by_time_of_day: list[OccupancySlotReport]
    by_court: list[OccupancyCourtReport]


class RevenueDailyReport(BaseModel):
    date: date
    booking_count: int
    total_revenue_cents: int
    average_ticket_cents: int


class RevenueCourtReport(BaseModel):
    court_id: UUID
    court_name: str
    booking_count: int
    total_revenue_cents: int


class ClubRevenueResponse(BaseModel):
    club_id: UUID
    start_date: date
    end_date: date
    currency: str
    total_revenue_cents: int
    total_bookings: int
    average_ticket_cents: int
    daily: list[RevenueDailyReport]
    by_court: list[RevenueCourtReport]

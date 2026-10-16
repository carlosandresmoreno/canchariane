from typing import Any


class DomainError(Exception):
    """Base domain exception with a stable machine-readable code."""

    def __init__(
        self, message: str, code: str = "DOMAIN_ERROR", details: dict[str, Any] | None = None
    ) -> None:
        super().__init__(message)
        self.message = message
        self.code = code
        self.details = details or {}


class SlotUnavailableError(DomainError):
    def __init__(self, period: str | None = None) -> None:
        super().__init__(
            message="El horario seleccionado ya no se encuentra disponible",
            code="SLOT_UNAVAILABLE",
            details={"period": str(period)} if period else {},
        )


class HoldExpiredError(DomainError):
    def __init__(self, hold_id: str) -> None:
        super().__init__(
            message="La reserva temporal ha expirado",
            code="HOLD_EXPIRED",
            details={"hold_id": hold_id},
        )


class ClubSuspendedError(DomainError):
    def __init__(self, club_id: str) -> None:
        super().__init__(
            message="El club no se encuentra activo o ha sido suspendido",
            code="CLUB_SUSPENDED",
            details={"club_id": club_id},
        )


class OutsideBusinessHoursError(DomainError):
    def __init__(self, period: str | None = None) -> None:
        super().__init__(
            message="El horario seleccionado está fuera del horario operativo del club",
            code="OUTSIDE_BUSINESS_HOURS",
            details={"period": period} if period else {},
        )


class BookingTooLateError(DomainError):
    def __init__(self) -> None:
        super().__init__(
            message="La reserva debe realizarse con el tiempo de antelación mínimo requerido",
            code="BOOKING_TOO_LATE",
        )


class InvalidBookingStatusTransitionError(DomainError):
    def __init__(self, current_status: str, new_status: str) -> None:
        super().__init__(
            message=f"No se permite la transición de estado de '{current_status}' a '{new_status}'",
            code="INVALID_STATUS_TRANSITION",
            details={"current_status": current_status, "new_status": new_status},
        )


class CourtInactiveError(DomainError):
    def __init__(self, court_id: str) -> None:
        super().__init__(
            message="La cancha solicitada no está activa",
            code="COURT_INACTIVE",
            details={"court_id": court_id},
        )


class EntityNotFoundError(DomainError):
    def __init__(self, entity: str, identifier: str) -> None:
        super().__init__(
            message=f"{entity} con identificador {identifier} no fue encontrado",
            code="NOT_FOUND",
            details={"entity": entity, "identifier": identifier},
        )

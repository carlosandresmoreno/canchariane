from typing import Any

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.domain.exceptions import (
    ClubSuspendedError,
    CourtInactiveError,
    DomainError,
    EntityNotFoundError,
    HoldExpiredError,
    InvalidBookingStatusTransitionError,
    OutsideBusinessHoursError,
    SlotUnavailableError,
)

STATUS_MAP: dict[type[DomainError], int] = {
    SlotUnavailableError: 409,
    HoldExpiredError: 410,
    ClubSuspendedError: 403,
    CourtInactiveError: 400,
    OutsideBusinessHoursError: 400,
    InvalidBookingStatusTransitionError: 409,
    EntityNotFoundError: 404,
}


def create_problem_response(
    status: int,
    title: str,
    detail: str,
    code: str,
    extra: dict[str, Any] | None = None,
) -> JSONResponse:
    content: dict[str, Any] = {
        "type": "about:blank",
        "title": title,
        "status": status,
        "detail": detail,
        "code": code,
    }
    if extra:
        content.update(extra)

    return JSONResponse(
        status_code=status,
        content=content,
        headers={"Content-Type": "application/problem+json"},
    )


def register_error_handlers(app: FastAPI) -> None:
    from fastapi.exceptions import RequestValidationError

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
        errors = exc.errors()
        messages = []
        for err in errors:
            loc_parts = [str(l) for l in err.get("loc", []) if l != "body"]
            loc = " -> ".join(loc_parts)
            msg = err.get("msg", "Valor inválido")
            messages.append(f"Campo '{loc}': {msg}" if loc else msg)
        summary = "; ".join(messages) or "Error de validación en los datos enviados"
        return JSONResponse(
            status_code=422,
            content={"detail": summary, "errors": errors, "code": "VALIDATION_ERROR"},
        )

    @app.exception_handler(DomainError)
    async def domain_error_handler(_: Request, exc: DomainError) -> JSONResponse:
        status = STATUS_MAP.get(type(exc), 400)
        return create_problem_response(
            status=status,
            title=type(exc).__name__,
            detail=exc.message,
            code=exc.code,
            extra={"details": exc.details} if exc.details else None,
        )


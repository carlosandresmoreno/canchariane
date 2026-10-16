from abc import ABC, abstractmethod
from typing import Any
from uuid import UUID

from app.domain.entities.booking import PaymentStatus
from app.domain.value_objects.money import Money


class PaymentGateway(ABC):
    """Port for future payment processor integrations."""

    @abstractmethod
    async def create_payment_intent(
        self,
        booking_id: UUID,
        amount: Money,
        customer_email: str,
        customer_phone: str,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]: ...

    @abstractmethod
    async def get_status(self, provider_reference: str) -> PaymentStatus: ...

    @abstractmethod
    async def refund(self, provider_reference: str, amount: Money) -> bool: ...

from abc import ABC, abstractmethod

from app.domain.entities.booking import Booking


class Notifier(ABC):
    @abstractmethod
    async def send_booking_confirmation(self, booking: Booking) -> None: ...

    @abstractmethod
    async def send_cancellation_notice(self, booking: Booking) -> None: ...

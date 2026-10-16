from abc import ABC, abstractmethod
from collections.abc import Sequence
from uuid import UUID

from app.domain.entities.booking import Booking
from app.domain.entities.club import Club
from app.domain.entities.court import Court
from app.domain.entities.time_block import TimeBlock
from app.domain.value_objects.time_slot import TimeSlot


class ClubRepository(ABC):
    @abstractmethod
    async def get_by_id(self, club_id: UUID) -> Club | None:
        """Retrieves club by id."""
        ...

    @abstractmethod
    async def get_by_slug(self, slug: str) -> Club | None:
        """Retrieves published club by slug."""
        ...

    @abstractmethod
    async def get_bookable(self, club_id: UUID) -> Club:
        """Retrieves club ensuring it is active and bookable, otherwise raises ClubSuspendedError."""
        ...


class CourtRepository(ABC):
    @abstractmethod
    async def list_by_club(self, club_id: UUID, sport: str | None = None) -> Sequence[Court]:
        """Lists courts strictly filtered by club_id."""
        ...

    @abstractmethod
    async def get_by_id(self, club_id: UUID, court_id: UUID) -> Court | None:
        """Gets court ensuring it belongs to club_id."""
        ...


class BookingRepository(ABC):
    @abstractmethod
    async def get_by_id(self, club_id: UUID, booking_id: UUID) -> Booking | None:
        """Retrieves booking scoped to club_id."""
        ...

    @abstractmethod
    async def get_by_code(self, code: str, phone: str | None = None) -> Booking | None:
        """Public guest lookup by short code CAN-XXXXXX."""
        ...

    @abstractmethod
    async def list_active_in_range(
        self,
        club_id: UUID,
        court_ids: Sequence[UUID],
        range_slot: TimeSlot,
    ) -> Sequence[Booking]:
        """Returns held and confirmed bookings overlapping the range for the given courts."""
        ...

    @abstractmethod
    async def insert_hold(self, booking: Booking) -> Booking:
        """Inserts a new booking in 'held' status. Raises SlotUnavailableError on GiST exclusion conflict."""
        ...

    @abstractmethod
    async def save(self, booking: Booking) -> Booking:
        """Updates an existing booking within its tenant scope."""
        ...


class BlockRepository(ABC):
    @abstractmethod
    async def list_overlapping(
        self,
        club_id: UUID,
        range_slot: TimeSlot,
        court_id: UUID | None = None,
    ) -> Sequence[TimeBlock]:
        """Returns blocks overlapping the range for the club or specific court."""
        ...

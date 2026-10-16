from dataclasses import dataclass
from uuid import UUID


@dataclass
class Court:
    """Court domain entity."""

    id: UUID
    club_id: UUID
    name: str
    sport: str  # padel, football_5, football_7, tennis
    surface: str  # synthetic_grass, concrete, clay
    player_format: str  # doubles, singles, 5v5
    is_covered: bool = False
    has_lighting: bool = True
    is_active: bool = True
    position: int = 0

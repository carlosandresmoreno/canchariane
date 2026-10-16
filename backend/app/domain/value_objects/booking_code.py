import secrets
from dataclasses import dataclass

# Unambiguous alphabet (excluding 0, O, 1, I, L)
ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"


@dataclass(frozen=True)
class BookingCode:
    """Human-readable booking code for phone support and lookup (e.g., CAN-7K4M2P)."""

    value: str

    def __post_init__(self) -> None:
        if not self.value or len(self.value) < 6:
            raise ValueError("Invalid booking code format")

    @classmethod
    def generate(cls, prefix: str = "CAN", length: int = 6) -> "BookingCode":
        code = "".join(secrets.choice(ALPHABET) for _ in range(length))
        return cls(value=f"{prefix}-{code}")

    def __str__(self) -> str:
        return self.value

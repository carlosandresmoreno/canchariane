from dataclasses import dataclass


@dataclass(frozen=True)
class Money:
    """Represents monetary amounts in cents to eliminate floating-point errors."""

    cents: int
    currency: str = "COP"

    def __post_init__(self) -> None:
        if self.cents < 0:
            raise ValueError("Money amount cannot be negative")

    def add(self, other: "Money") -> "Money":
        if self.currency != other.currency:
            raise ValueError(
                f"Cannot add different currencies: {self.currency} and {other.currency}"
            )
        return Money(cents=self.cents + other.cents, currency=self.currency)

    def subtract(self, other: "Money") -> "Money":
        if self.currency != other.currency:
            raise ValueError(
                f"Cannot subtract different currencies: {self.currency} and {other.currency}"
            )
        if self.cents < other.cents:
            raise ValueError("Resulting money cannot be negative")
        return Money(cents=self.cents - other.cents, currency=self.currency)

    def multiply(self, factor: int) -> "Money":
        if factor < 0:
            raise ValueError("Factor cannot be negative")
        return Money(cents=self.cents * factor, currency=self.currency)

    @property
    def formatted(self) -> str:
        """Standard formatted representation in COP (e.g. $ 50.000)."""
        amount = self.cents // 100
        return f"${amount:,.0f} {self.currency}".replace(",", ".")

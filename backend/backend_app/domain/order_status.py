from __future__ import annotations

from dataclasses import dataclass


class OrderStatus:
    PLACED = "placed"
    PAID = "paid"
    CANCELLED = "cancelled"
    SHIPPED = "shipped"
    DELIVERED = "delivered"

    CHOICES = (
        (PLACED, "Placed"),
        (PAID, "Paid"),
        (CANCELLED, "Cancelled"),
        (SHIPPED, "Shipped"),
        (DELIVERED, "Delivered"),
    )

    ALL = {PLACED, PAID, CANCELLED, SHIPPED, DELIVERED}


@dataclass(frozen=True)
class Transition:
    from_status: str
    to_status: str


ALLOWED_TRANSITIONS: set[Transition] = {
    Transition(OrderStatus.PLACED, OrderStatus.PAID),
    Transition(OrderStatus.PLACED, OrderStatus.CANCELLED),
    Transition(OrderStatus.PAID, OrderStatus.SHIPPED),
    Transition(OrderStatus.PAID, OrderStatus.CANCELLED),
    Transition(OrderStatus.SHIPPED, OrderStatus.DELIVERED),
}


def can_transition(*, from_status: str, to_status: str) -> bool:
    if from_status == to_status:
        return True
    return Transition(from_status, to_status) in ALLOWED_TRANSITIONS


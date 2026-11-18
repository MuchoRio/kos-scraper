"""Abstract source adapter contract and adapter factory."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from ..http_client import PoliteHttpClient
from ..models import KosListing


class SourceAdapter(ABC):
    """Contract implemented by every kos listing source adapter."""

    name: str
    base_url: str

    def __init__(self, client: PoliteHttpClient | None = None) -> None:
        self.client = client or PoliteHttpClient()

    @abstractmethod
    def list_page(
        self,
        area: str = "jakarta-selatan",
        max_price: int | None = None,
        page: int = 1,
        sort: str = "price",
        order: str = "asc",
        html: str | None = None,
    ) -> tuple[list[dict[str, Any]], bool, str]:
        """Return (list_cards, has_next, resolved_url) for a search listing page."""

    @abstractmethod
    def parse_detail(
        self,
        url: str,
        html: str | None = None,
        listing_hint: dict[str, Any] | None = None,
    ) -> KosListing:
        """Fetch (unless html provided) and normalize a single listing detail page."""


def list_adapters() -> list[str]:
    return [
        "sewakost",
        "rukita",
        "mamikos",
        "infokost",
        "cove",
        "djuragankamar",
        "rumah123",
        "kostjakarta",
    ]


def get_adapter(name: str, client: PoliteHttpClient | None = None) -> SourceAdapter:
    from .cove import CoveAdapter
    from .djuragankamar import DjuraganKamarAdapter
    from .infokost import InfokostAdapter
    from .kostjakarta import KostJakartaAdapter
    from .mamikos import MamikosAdapter
    from .rukita import RukitaAdapter
    from .rumah123 import Rumah123Adapter
    from .sewakost import SewakostAdapter

    registry: dict[str, type[SourceAdapter]] = {
        "sewakost": SewakostAdapter,
        "rukita": RukitaAdapter,
        "mamikos": MamikosAdapter,
        "infokost": InfokostAdapter,
        "cove": CoveAdapter,
        "djuragankamar": DjuraganKamarAdapter,
        "rumah123": Rumah123Adapter,
        "kostjakarta": KostJakartaAdapter,
    }
    key = name.strip().lower()
    if key not in registry:
        raise ValueError(f"Unknown source adapter '{name}'. Available: {', '.join(registry)}")
    return registry[key](client=client)

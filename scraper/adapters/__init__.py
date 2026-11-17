"""Source adapters registry for kos-scraper."""

from .base import SourceAdapter, get_adapter, list_adapters
from .cove import CoveAdapter
from .infokost import InfokostAdapter
from .mamikos import MamikosAdapter
from .rukita import RukitaAdapter
from .sewakost import SewakostAdapter

__all__ = [
    "CoveAdapter",
    "InfokostAdapter",
    "MamikosAdapter",
    "RukitaAdapter",
    "SewakostAdapter",
    "SourceAdapter",
    "get_adapter",
    "list_adapters",
]

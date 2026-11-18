"""Source adapters registry for kos-scraper."""

from .base import SourceAdapter, get_adapter, list_adapters
from .cove import CoveAdapter
from .djuragankamar import DjuraganKamarAdapter
from .infokost import InfokostAdapter
from .kostjakarta import KostJakartaAdapter
from .mamikos import MamikosAdapter
from .rukita import RukitaAdapter
from .rumah123 import Rumah123Adapter
from .sewakost import SewakostAdapter

__all__ = [
    "CoveAdapter",
    "DjuraganKamarAdapter",
    "InfokostAdapter",
    "KostJakartaAdapter",
    "MamikosAdapter",
    "RukitaAdapter",
    "Rumah123Adapter",
    "SewakostAdapter",
    "SourceAdapter",
    "get_adapter",
    "list_adapters",
]

"""Haversine distance calculation and cached OSM Nominatim geocoder."""

from __future__ import annotations

import json
import math
import re
import threading
import urllib.parse
from pathlib import Path
from typing import Any

from .http_client import PoliteHttpClient

DEFAULT_CACHE_PATH = Path(__file__).resolve().parent / ".cache" / "geo_cache.json"
NOMINATIM_UA = "kos-scraper/2.0 (personal-research; +https://github.com/nurhikam/kos-scraper)"


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate great-circle distance between two coordinates in kilometers."""
    r = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = (
        math.sin(dphi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * (math.sin(dlambda / 2.0) ** 2)
    )
    return round(2.0 * r * math.atan2(math.sqrt(a), math.sqrt(1.0 - a)), 2)


def build_geocode_query(item: dict[str, Any]) -> str | None:
    """Build normalized Indonesian area query for Nominatim lookup."""
    parts = [
        str(item.get("kelurahan") or "").strip(),
        str(item.get("kecamatan") or "").strip(),
    ]
    clean_parts = [p for p in parts if p]
    if not clean_parts:
        addr = str(item.get("alamat") or "").strip()
        if not addr:
            return None
        # Strip noisy RT/RW/No house numbers so Nominatim resolves street/subdistrict
        addr_norm = re.sub(r"\b(?:rt|rw|no)\.?\s*[\d/a-z-]+\b", "", addr, flags=re.I)
        addr_norm = re.sub(r"\s+", " ", addr_norm).strip(" ,.-")
        if len(addr_norm) < 5:
            return None
        clean_parts = [addr_norm[:80]]
    clean_parts.append("Indonesia")
    return ", ".join(clean_parts)


class Geocoder:
    """Persistent-cached Nominatim geocoder honoring 1.1 req/s rate limit."""

    def __init__(
        self,
        cache_path: Path | None = None,
        client: PoliteHttpClient | None = None,
    ) -> None:
        self.cache_path = cache_path or DEFAULT_CACHE_PATH
        self.client = client or PoliteHttpClient(
            min_delay=1.1, max_retries=2, timeout=10.0, user_agent=NOMINATIM_UA
        )
        self._lock = threading.Lock()
        self._cache: dict[str, dict[str, float] | None] = self._load_cache()

    def _load_cache(self) -> dict[str, dict[str, float] | None]:
        if not self.cache_path.exists():
            return {}
        try:
            data = json.loads(self.cache_path.read_text(encoding="utf-8"))
            return data if isinstance(data, dict) else {}
        except (OSError, json.JSONDecodeError):
            return {}

    def _save_cache(self) -> None:
        self.cache_path.parent.mkdir(parents=True, exist_ok=True)
        self.cache_path.write_text(
            json.dumps(self._cache, ensure_ascii=False, indent=1),
            encoding="utf-8",
        )

    def lookup(self, query: str) -> tuple[float, float] | None:
        """Resolve a query string via local cache first, then OSM Nominatim."""
        key = re.sub(r"\s+", " ", query.strip().lower())
        if not key:
            return None
        with self._lock:
            if key in self._cache:
                hit = self._cache[key]
                return (hit["lat"], hit["lon"]) if hit else None

        url = (
            "https://nominatim.openstreetmap.org/search?"
            + urllib.parse.urlencode({"q": query, "format": "jsonv2", "limit": "1"})
        )
        try:
            body = self.client.get(url, headers={"Accept": "application/json"})
            payload = json.loads(body)
            coords: tuple[float, float] | None = None
            if isinstance(payload, list) and payload:
                coords = (float(payload[0]["lat"]), float(payload[0]["lon"]))
            with self._lock:
                self._cache[key] = {"lat": coords[0], "lon": coords[1]} if coords else None
                self._save_cache()
            return coords
        except Exception:
            # Soft-fail geocoding so listing extraction never breaks offline/rate-limited
            return None

    def enrich_distance(
        self,
        item: dict[str, Any],
        ref_lat: float | None,
        ref_lon: float | None,
        allow_remote: bool = True,
    ) -> None:
        """Attach lat/lon (when needed) and distance_km relative to reference point."""
        lat, lon = item.get("lat"), item.get("lon")
        if (lat is None or lon is None) and allow_remote:
            query = build_geocode_query(item)
            if query:
                coords = self.lookup(query)
                if coords:
                    lat, lon = coords
                    item["lat"], item["lon"] = lat, lon
        if lat is not None and lon is not None and ref_lat is not None and ref_lon is not None:
            item["distance_km"] = haversine_km(float(lat), float(lon), float(ref_lat), float(ref_lon))


"""Public transit & nearby POI proximity enrichment using shared Jabodetabek hub SSOT."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from .geo import haversine_km

HUBS_PATH = Path(__file__).resolve().parent.parent / "shared" / "transum_hubs.json"
TRANSIT_CATEGORIES = ("busway", "mrt", "krl", "lrt")


@lru_cache(maxsize=1)
def load_transum_hubs() -> dict[str, list[dict[str, Any]]]:
    if not HUBS_PATH.exists():
        return {}
    try:
        data = json.loads(HUBS_PATH.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def compute_nearby_transit(
    lat: float | None,
    lon: float | None,
    limit_per_cat: int = 4,
    max_km: float = 10.0,
) -> dict[str, Any] | None:
    """Return nearest stops per category and overall closest public transit hub."""
    if lat is None or lon is None:
        return None
    hubs = load_transum_hubs()
    if not hubs:
        return None

    categories: dict[str, list[dict[str, Any]]] = {}
    closest_transit: dict[str, Any] | None = None

    for cat, entries in hubs.items():
        ranked: list[dict[str, Any]] = []
        for entry in entries:
            dist = haversine_km(lat, lon, float(entry["lat"]), float(entry["lon"]))
            if dist <= max_km:
                item = {"name": entry["name"], "distance_km": dist}
                ranked.append(item)
        ranked.sort(key=lambda r: r["distance_km"])
        top = ranked[:limit_per_cat]
        categories[cat] = top
        if cat in TRANSIT_CATEGORIES and top:
            cand = {"category": cat, **top[0]}
            if closest_transit is None or cand["distance_km"] < closest_transit["distance_km"]:
                closest_transit = cand

    return {"nearest": closest_transit, "categories": categories}


"""Google Maps Places API (New) + local headless Chrome fallback enricher."""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

from .geo import haversine_km
from .gmaps_analyzer import analyze_reviews
from .models import dedup_image_urls

DEFAULT_GMAPS_CACHE = Path(__file__).resolve().parent / ".cache" / "gmaps_cache.json"
ROOT_DIR = Path(__file__).resolve().parent.parent
PLACES_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"
PLACES_FIELD_MASK = ",".join([
    "places.id",
    "places.displayName",
    "places.formattedAddress",
    "places.location",
    "places.rating",
    "places.userRatingCount",
    "places.googleMapsUri",
    "places.photos",
    "places.reviews",
])


def build_gmaps_query(item: dict[str, Any]) -> str:
    """Build clean search query from kost name and neighborhood/city without duplicating words."""
    name = str(item.get("nama_kost") or item.get("title") or item.get("slug") or "").strip()
    area_parts = [
        str(item.get("kelurahan") or "").strip(),
        str(item.get("kecamatan") or "").strip(),
    ]
    area = ", ".join(p for p in area_parts if p and p.lower() not in name.lower())
    if not area and item.get("alamat"):
        addr = str(item["alamat"])[:60].strip()
        if addr.lower() not in name.lower():
            area = addr
    parts = [p for p in (name, area, "Jakarta" if "jakarta" not in (area + " " + name).lower() else "") if p]
    return " ".join(parts).strip()


def resolve_places_photo_uri(
    photo_name: str, api_key: str, max_width: int = 960, timeout: float = 10.0
) -> str | None:
    """Resolve a clean CDN photoUri from Places API (New) media endpoint without leaking api_key."""
    clean_name = (photo_name or "").strip().lstrip("/")
    if not clean_name or not api_key:
        return None
    media_url = f"https://places.googleapis.com/v1/{clean_name}/media?maxWidthPx={max_width}&skipHttpRedirect=true"
    req = urllib.request.Request(media_url, method="GET", headers={"X-Goog-Api-Key": api_key})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8", errors="replace"))
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError):
        return None
    uri = str(data.get("photoUri") or "").strip()
    if not uri.startswith(("http://", "https://")) or api_key in uri or "key=" in uri.lower():
        return None
    return uri


def fetch_places_api(query: str, api_key: str, timeout: float = 15.0) -> dict[str, Any]:
    """Query official Google Places API (New) for rating, coordinates, reviews, and photos."""
    payload = json.dumps({"textQuery": query, "languageCode": "id", "maxResultCount": 1}).encode("utf-8")
    req = urllib.request.Request(
        PLACES_SEARCH_URL,
        data=payload,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "X-Goog-Api-Key": api_key,
            "X-Goog-FieldMask": PLACES_FIELD_MASK,
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        data = json.loads(resp.read().decode("utf-8", errors="replace"))

    places = data.get("places") or []
    if not places:
        return {"status": "not_found", "engine": "places_api", "reviews": [], "photos": []}

    place = places[0]
    loc = place.get("location") or {}
    reviews: list[dict[str, Any]] = []
    for rev in place.get("reviews") or []:
        text_obj = rev.get("text") or rev.get("originalText") or {}
        author_obj = rev.get("authorAttribution") or {}
        reviews.append({
            "author": author_obj.get("displayName") or "Pengulas Google",
            "rating": rev.get("rating"),
            "relative_time": rev.get("relativePublishTimeDescription") or "",
            "text": text_obj.get("text") or "",
        })
    resolved_photos: list[str] = []
    for photo_obj in (place.get("photos") or [])[:5]:
        name = (photo_obj or {}).get("name") if isinstance(photo_obj, dict) else None
        uri = resolve_places_photo_uri(str(name or ""), api_key, timeout=min(timeout, 10.0))
        if uri:
            resolved_photos.append(uri)

    return {
        "status": "ok",
        "engine": "places_api",
        "place_name": (place.get("displayName") or {}).get("text"),
        "rating": place.get("rating"),
        "review_count": place.get("userRatingCount"),
        "limited_view": False,
        "maps_url": place.get("googleMapsUri"),
        "lat": loc.get("latitude"),
        "lon": loc.get("longitude"),
        "photos": dedup_image_urls(resolved_photos, limit=8),
        "reviews": reviews,
    }


def fetch_browser_gmaps(query: str, timeout_s: int = 25, direct_url: str | None = None) -> dict[str, Any]:
    """Invoke local Chrome via scripts/gmaps_browser.mjs when no API key is configured."""
    node_bin = shutil.which("node")
    script = ROOT_DIR / "scripts" / "gmaps_browser.mjs"
    if not node_bin or not script.exists():
        return {"status": "unavailable", "reason": "Node.js atau gmaps_browser.mjs tidak tersedia", "reviews": []}

    cmd = [node_bin, str(script), "--timeout", str(timeout_s * 1000)]
    if direct_url and direct_url.startswith("https://www.google.com/maps"):
        cmd.extend(["--url", direct_url])
    else:
        cmd.extend(["--query", query])

    res = subprocess.run(
        cmd,
        cwd=str(ROOT_DIR),
        capture_output=True,
        text=True,
        timeout=timeout_s + 10,
        check=False,
    )
    raw = (res.stdout or "").strip().splitlines()
    if not raw:
        return {"status": "error", "reason": res.stderr.strip() or "Empty browser output", "reviews": []}
    try:
        return json.loads(raw[-1])
    except json.JSONDecodeError:
        return {"status": "error", "reason": "Invalid JSON from gmaps_browser.mjs", "reviews": []}


class GoogleMapsEnricher:
    """Cached Google Maps enricher supporting Places API (New) and local Chrome fallback."""

    def __init__(
        self,
        api_key: str | None = None,
        cache_path: Path | None = None,
        min_delay: float = 1.2,
    ) -> None:
        self.api_key = (api_key or os.environ.get("GOOGLE_MAPS_API_KEY") or "").strip() or None
        self.cache_path = cache_path or DEFAULT_GMAPS_CACHE
        self.min_delay = max(0.0, float(min_delay))
        self._lock = threading.Lock()
        self._browser_sem = threading.Semaphore(2)
        self._last_hit = 0.0
        self._cache: dict[str, dict[str, Any]] = self._load_cache()

    def _load_cache(self) -> dict[str, dict[str, Any]]:
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

    def lookup(self, query: str, direct_url: str | None = None) -> dict[str, Any]:
        effective_direct = direct_url.strip() if (direct_url and not self.api_key) else None
        cache_basis = effective_direct.lower() if effective_direct else query.strip().lower()
        norm_q = re.sub(r"\s+", " ", cache_basis)
        key = f"{'api' if self.api_key else 'web'}:{norm_q}"
        with self._lock:
            cached = self._cache.get(key)
            if isinstance(cached, dict) and "photos" in cached:
                return cached
            elapsed = time.monotonic() - self._last_hit
            if self._last_hit > 0 and elapsed < self.min_delay:
                time.sleep(self.min_delay - elapsed)
            self._last_hit = time.monotonic()

        try:
            if self.api_key:
                raw = fetch_places_api(query, self.api_key)
            else:
                with self._browser_sem:
                    raw = fetch_browser_gmaps(query, direct_url=effective_direct)
        except urllib.error.HTTPError as exc:
            raw = {"status": "error", "reason": f"Places API HTTP {exc.code}", "reviews": []}
        except Exception as exc:
            raw = {"status": "error", "reason": str(exc), "reviews": []}

        analysis = analyze_reviews(raw.get("reviews") or [])
        photos = dedup_image_urls(raw.get("photos") or [], limit=8)
        result = {
            "status": raw.get("status", "error"),
            "engine": raw.get("engine") or ("places_api" if self.api_key else "chrome_browser"),
            "query": query,
            "place_name": raw.get("place_name"),
            "rating": raw.get("rating"),
            "review_count": raw.get("review_count"),
            "limited_view": bool(raw.get("limited_view", False)),
            "maps_url": raw.get("maps_url") or effective_direct,
            "lat": raw.get("lat"),
            "lon": raw.get("lon"),
            "photos": photos,
            "reason": raw.get("reason"),
            **analysis,
        }
        if raw.get("status") == "ok":
            with self._lock:
                self._cache[key] = result
                self._save_cache()
        return result

    def enrich_item(
        self,
        record: dict[str, Any],
        ref_lat: float | None = None,
        ref_lon: float | None = None,
        direct_url: str | None = None,
    ) -> dict[str, Any]:
        query = build_gmaps_query(record)
        if not query and not direct_url:
            return record
        gmaps = self.lookup(query or "Kos Jakarta", direct_url=direct_url)
        record["gmaps"] = gmaps
        if (record.get("lat") is None or record.get("lon") is None) and gmaps.get("lat") is not None:
            record["lat"] = gmaps["lat"]
            record["lon"] = gmaps["lon"]
            if ref_lat is not None and ref_lon is not None:
                record["distance_km"] = haversine_km(
                    float(gmaps["lat"]), float(gmaps["lon"]), float(ref_lat), float(ref_lon)
                )
        gmaps_photos = dedup_image_urls(gmaps.get("photos") or [], limit=8)
        if gmaps_photos:
            existing_photos = dedup_image_urls(
                [*(record.get("image_urls") or []), record.get("image_url")],
                limit=12,
            )
            if existing_photos:
                record["image_urls"] = dedup_image_urls([*existing_photos, *gmaps_photos], limit=12)
                record["image_url"] = existing_photos[0]
                record.setdefault("image_source", "listing")
            else:
                record["image_urls"] = gmaps_photos
                record["image_url"] = gmaps_photos[0]
                record["image_source"] = "google_maps"
        if gmaps.get("review_price_estimate"):
            record["price_estimate_from_reviews"] = gmaps["review_price_estimate"]
            record["price_estimate_text"] = gmaps["review_price_estimate_text"]
        return record

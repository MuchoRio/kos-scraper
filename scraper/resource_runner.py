"""Separated runner for enriching Google Sheet & Doc directory resources."""

from __future__ import annotations

import ssl
import threading
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path
from typing import Any, Callable

from .adapters import get_adapter
from .attributes import extract_kos_attributes
from .exporters import write_csv, write_json
from .fraud_detector import assess_scam_risk
from .geo import Geocoder, haversine_km
from .gmaps import GoogleMapsEnricher
from .http_client import PoliteHttpClient
from .resource_parser import (
    compute_resource_stats,
    extract_coords_from_maps_url,
    filter_and_rank_rows,
    load_google_resource,
)
from .transit import compute_nearby_transit


def resolve_maps_shortlink(url: str | None) -> tuple[float | None, float | None, str | None]:
    """Follow maps.app.goo.gl redirect once without a browser to extract coordinates."""
    if not url or not url.startswith("http"):
        return None, None, None
    lat, lon = extract_coords_from_maps_url(url)
    if lat is not None and lon is not None:
        return lat, lon, url
    if "goo.gl" not in url.lower():
        return None, None, url
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=8, context=ssl.create_default_context()) as resp:
            final_url = resp.geturl()
            lat2, lon2 = extract_coords_from_maps_url(final_url)
            return lat2, lon2, final_url
    except Exception:
        return None, None, url


def inspect_resource(
    url: str,
    area: str = "jakarta-selatan",
    max_price: int | None = None,
    keywords: list[str] | None = None,
    only_available: bool = True,
    deduplicate: bool = True,
    include_unpriced: bool | None = None,
    price_category: str = "all",
    availability: str | None = None,
    quality: str = "all",
    gender: str = "all",
    pet: str = "all",
) -> dict[str, Any]:
    """Quick (<2s) inspection of a Google Sheet/Doc returning stats + filtered count + sample."""
    loaded = load_google_resource(url, area=area, keywords=keywords)
    stats = compute_resource_stats(loaded)
    filtered, dups = filter_and_rank_rows(
        loaded["rows"],
        area=area,
        max_price=max_price,
        keywords=keywords,
        only_available=only_available,
        deduplicate=deduplicate,
        include_unpriced=max_price is None if include_unpriced is None else include_unpriced,
        price_category=price_category,
        availability=availability,
        quality=quality,
        gender=gender,
        pet=pet,
    )
    stats["filtered_count"] = len(filtered)
    stats["duplicates_removed_in_filter"] = dups
    return {"success": True, "stats": stats, "samples": filtered[:8]}


def _enrich_single_row(
    row: dict[str, Any],
    http: PoliteHttpClient,
    gm: GoogleMapsEnricher | None,
    geo: Geocoder | None,
    ref_lat: float | None,
    ref_lon: float | None,
    max_price: int | None,
) -> dict[str, Any]:
    rec = dict(row)
    platform_url = rec.pop("platform_url", None)
    gmaps_hint = rec.pop("gmaps_url_hint", None)

    if platform_url:
        try:
            scraped = get_adapter(rec["source"], client=http).parse_detail(platform_url).to_dict()
            for key in ("title", "nama_kost", "price", "price_text", "price_options", "price_source", "jenis", "kecamatan", "kelurahan", "alamat", "deskripsi", "fasilitas", "fasilitas_list", "peraturan", "image_url", "image_urls", "lat", "lon", "nama_pemilik"):
                if scraped.get(key):
                    rec[key] = scraped[key]
            rec["price_suspect"] = bool(scraped.get("price_suspect"))
        except Exception as exc:
            rec["platform_note"] = f"Link platform gagal dibuka ({exc})"

    direct_maps_url: str | None = gmaps_hint
    if gmaps_hint:
        if rec.get("lat") is None or rec.get("lon") is None:
            slat, slon, resolved_u = resolve_maps_shortlink(gmaps_hint)
            if slat is not None and slon is not None:
                rec["lat"], rec["lon"] = slat, slon
            if resolved_u:
                direct_maps_url = resolved_u
        rec.setdefault("gmaps", {})["maps_url"] = direct_maps_url

    if gm is not None:
        gm.enrich_item(rec, ref_lat=ref_lat, ref_lon=ref_lon, direct_url=direct_maps_url)
    if geo is not None:
        geo.enrich_distance(rec, ref_lat, ref_lon, allow_remote=True)
    elif rec.get("lat") is not None and rec.get("lon") is not None and ref_lat is not None and ref_lon is not None:
        rec["distance_km"] = haversine_km(float(rec["lat"]), float(rec["lon"]), float(ref_lat), float(ref_lon))

    rec["nearby_transit"] = compute_nearby_transit(rec.get("lat"), rec.get("lon"))
    rec["scam_risk"] = assess_scam_risk(rec)
    attrs = extract_kos_attributes(rec)
    nearest = (rec.get("nearby_transit") or {}).get("nearest")
    if nearest and nearest.get("distance_km", 99) <= 2.5:
        attrs["transum"] = True
    rec["attributes"] = attrs
    rec["over_budget"] = bool(max_price and not rec.get("price_suspect") and rec.get("price") and rec["price"] > max_price)
    return rec


def run_resource_analysis(
    url: str,
    area: str = "jakarta-selatan",
    max_price: int | None = 1_500_000,
    keywords: list[str] | None = None,
    details_limit: int = 25,
    only_available: bool = True,
    deduplicate: bool = True,
    include_unpriced: bool = False,
    price_category: str = "all",
    availability: str | None = None,
    quality: str = "all",
    gender: str = "all",
    pet: str = "all",
    geocode: bool = True,
    gmaps: bool = True,
    concurrency: int = 4,
    ref_lat: float | None = None,
    ref_lon: float | None = None,
    out_dir: Path | None = None,
    mask_contact: bool = False,
    keep_history: bool = False,
    progress_cb: Callable[[dict[str, Any]], None] | None = None,
) -> dict[str, Any]:
    """Analyze & enrich curated Google Sheet / Doc rows cleanly isolated from web scrapes."""
    emit_lock = threading.Lock()
    def emit(ev: dict[str, Any]) -> None:
        if progress_cb:
            with emit_lock:
                progress_cb(ev)

    emit({"type": "phase", "phase": "load", "message": "Membaca & memfilter resource Google Sheet/Doc..."})
    loaded = load_google_resource(url, area=area, keywords=keywords)
    stats = compute_resource_stats(loaded)
    filtered, dups = filter_and_rank_rows(
        loaded["rows"],
        area=area,
        max_price=max_price,
        keywords=keywords,
        only_available=only_available,
        deduplicate=deduplicate,
        include_unpriced=include_unpriced,
        price_category=price_category,
        availability=availability,
        quality=quality,
        gender=gender,
        pet=pet,
    )
    targets = filtered[: max(1, details_limit)]
    total = len(targets)

    http = PoliteHttpClient()
    geo = Geocoder() if geocode else None
    gm = GoogleMapsEnricher() if gmaps else None

    results: list[dict[str, Any] | None] = [None] * total
    done = 0
    cnt_lock = threading.Lock()

    def work(idx: int, row: dict[str, Any]) -> None:
        nonlocal done
        rec = _enrich_single_row(row, http, gm, geo, ref_lat, ref_lon, max_price)
        results[idx] = rec
        with cnt_lock:
            done += 1
            cur = done
        emit({"type": "phase", "phase": "detail", "current": cur, "total": total, "message": f"[resource] Selesai ({cur}/{total}): {rec.get('title')}"})
        emit({"type": "item", "current": cur, "total": total, "item": rec})

    if total > 0:
        workers = max(1, min(int(concurrency), 6, total))
        with ThreadPoolExecutor(max_workers=workers) as pool:
            futs = [pool.submit(work, i, r) for i, r in enumerate(targets)]
            for f in as_completed(futs):
                f.result()

    enriched = [r for r in results if r is not None]
    root_out = (out_dir or (Path(__file__).resolve().parent.parent / "hasil")) / "resources"
    root_out.mkdir(parents=True, exist_ok=True)
    if keep_history:
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        detail_name, csv_name = f"resource_detail_{area}_{stamp}.json", f"resource_hasil_{stamp}.csv"
    else:
        detail_name, csv_name = "resource_detail_latest.json", "resource_hasil_latest.csv"
    detail_path = write_json(enriched, root_out / detail_name)
    csv_path = write_csv(enriched, root_out / csv_name, mask_contact=mask_contact)

    summary = {
        "kind": "resource",
        "area": area,
        "total_rows": stats["total_rows"],
        "filtered_count": len(filtered),
        "duplicates_removed": dups,
        "detail_count": len(enriched),
        "stats": stats,
        "files": {"detail_json": detail_path.name, "csv": csv_path.name},
        "items": enriched,
    }
    emit({"type": "done", "summary": {k: v for k, v in summary.items() if k != "items"}})
    return summary

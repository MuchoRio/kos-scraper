"""Concurrent multi-source workflow orchestration for kos scraping."""

from __future__ import annotations

import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path
from typing import Any, Callable

from .adapters import get_adapter
from .attributes import extract_kos_attributes
from .exporters import upsert_items_with_existing, write_csv, write_json
from .fraud_detector import assess_scam_risk
from .geo import Geocoder
from .gmaps import GoogleMapsEnricher
from .http_client import PoliteHttpClient
from .models import match_keywords
from .pipeline_workers import infer_source_from_url, interleave_by_source, scrape_single_source
from .transit import compute_nearby_transit

__all__ = ["enrich_details", "interleave_by_source", "run_hunt", "scrape_listings"]


def _make_thread_safe_emitter(
    progress_cb: Callable[[dict[str, Any]], None] | None,
) -> Callable[[dict[str, Any]], None]:
    emit_lock = threading.Lock()

    def safe_emit(ev: dict[str, Any]) -> None:
        if progress_cb:
            with emit_lock:
                progress_cb(ev)

    return safe_emit


def scrape_listings(
    sources: list[str],
    area: str = "jakarta-selatan",
    max_price: int | None = None,
    max_pages: int = 4,
    keywords: list[str] | None = None,
    sort: str = "default",
    order: str = "desc",
    strict: bool = False,
    client: PoliteHttpClient | None = None,
    progress_cb: Callable[[dict[str, Any]], None] | None = None,
) -> list[dict[str, Any]]:
    """Concurrently scrape listing summaries across independent source hosts."""
    http = client or PoliteHttpClient()
    kws = [k.strip() for k in (keywords or []) if k.strip()]
    safe_emit = _make_thread_safe_emitter(progress_cb)

    by_source: dict[str, list[dict[str, Any]]] = {s: [] for s in sources}
    workers = max(1, min(len(sources), 5))
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futs = {
            pool.submit(
                scrape_single_source,
                src,
                area,
                max_price,
                max_pages,
                kws,
                sort,
                order,
                strict,
                http,
                safe_emit,
            ): src
            for src in sources
        }
        for fut in as_completed(futs):
            src = futs[fut]
            by_source[src] = fut.result()

    combined: list[dict[str, Any]] = []
    seen: set[str] = set()
    for src in sources:
        for item in by_source[src]:
            if item["url"] not in seen:
                seen.add(item["url"])
                combined.append(item)
    return interleave_by_source(combined)


def enrich_details(
    candidates: list[dict[str, Any]],
    details_limit: int = 20,
    keywords: list[str] | None = None,
    max_price: int | None = None,
    geocode: bool = False,
    gmaps: bool = False,
    ref_lat: float | None = None,
    ref_lon: float | None = None,
    concurrency: int = 4,
    client: PoliteHttpClient | None = None,
    geocoder: Geocoder | None = None,
    gmaps_enricher: GoogleMapsEnricher | None = None,
    progress_cb: Callable[[dict[str, Any]], None] | None = None,
) -> list[dict[str, Any]]:
    """Concurrently enrich candidate listings while respecting per-host polite delays."""
    http = client or PoliteHttpClient()
    geo = geocoder
    if geo is None and (geocode or (ref_lat is not None and ref_lon is not None)):
        geo = Geocoder()
    gm = gmaps_enricher or (GoogleMapsEnricher() if gmaps else None)

    kws = [k.strip() for k in (keywords or []) if k.strip()]
    targets = candidates[: max(0, details_limit)]
    total = len(targets)
    if total == 0:
        return []

    safe_emit = _make_thread_safe_emitter(progress_cb)
    counter_lock = threading.Lock()
    done_count = 0
    results: list[dict[str, Any] | None] = [None] * total
    stream_items = total <= 200
    emit_step = 1 if total <= 200 else max(1, total // 50)

    def process_one(idx: int, cand: dict[str, Any]) -> None:
        nonlocal done_count
        src = cand.get("source") or infer_source_from_url(cand["url"])
        adapter = get_adapter(src, client=http)
        try:
            record = adapter.parse_detail(cand["url"], listing_hint=cand).to_dict()
            record["area_match"] = sorted(
                set(cand.get("area_match") or []) | set(match_keywords(record, kws))
            )
            record["over_budget"] = bool(
                max_price
                and not record["price_suspect"]
                and record["price"]
                and record["price"] > max_price
            )
            if gm is not None:
                gm.enrich_item(record, ref_lat=ref_lat, ref_lon=ref_lon)
            if geo is not None:
                geo.enrich_distance(record, ref_lat, ref_lon, allow_remote=geocode)
            record["nearby_transit"] = compute_nearby_transit(record.get("lat"), record.get("lon"))
            record["scam_risk"] = assess_scam_risk(record)
            attrs = extract_kos_attributes(record)
            nearest = (record.get("nearby_transit") or {}).get("nearest")
            if nearest and nearest.get("distance_km", 99) <= 2.5:
                attrs["transum"] = True
            record["attributes"] = attrs
            results[idx] = record
            with counter_lock:
                done_count += 1
                cur = done_count
            if cur == 1 or cur == total or cur % emit_step == 0:
                safe_emit({
                    "type": "phase",
                    "phase": "detail",
                    "current": cur,
                    "total": total,
                    "source": src,
                    "message": f"[{src}] Selesai ({cur}/{total}): {record.get('title') or cand['url']}",
                })
            if stream_items:
                safe_emit({"type": "item", "current": cur, "total": total, "item": record})
        except Exception as exc:
            err_rec = dict(cand)
            err_rec["error"] = str(exc)
            results[idx] = err_rec
            with counter_lock:
                done_count += 1
            safe_emit({"type": "error", "phase": "detail", "url": cand["url"], "error": str(exc)})

    workers = max(1, min(int(concurrency), 8, total))
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futs = [pool.submit(process_one, i, cand) for i, cand in enumerate(targets)]
        for fut in as_completed(futs):
            fut.result()

    return [r for r in results if r is not None]


def run_hunt(
    sources: list[str],
    area: str = "jakarta-selatan",
    max_price: int | None = 1_500_000,
    max_pages: int = 5,
    keywords: list[str] | None = None,
    details_limit: int = 25,
    sort: str = "default",
    order: str = "desc",
    geocode: bool = False,
    gmaps: bool = False,
    concurrency: int = 4,
    ref_lat: float | None = None,
    ref_lon: float | None = None,
    out_dir: Path | None = None,
    mask_contact: bool = False,
    keep_history: bool = False,
    storage_mode: str = "replace",
    progress_cb: Callable[[dict[str, Any]], None] | None = None,
) -> dict[str, Any]:
    """Full concurrent pipeline: list -> filter -> interleave -> detail -> JSON & CSV."""
    kws = [k.strip() for k in (keywords or []) if k.strip()]
    http = PoliteHttpClient()
    raw_items = scrape_listings(
        sources=sources,
        area=area,
        max_price=max_price,
        max_pages=max_pages,
        keywords=kws,
        sort=sort,
        order=order,
        strict=False,
        client=http,
        progress_cb=progress_cb,
    )

    matched = [it for it in raw_items if it.get("area_match")] if kws else list(raw_items)
    matched = interleave_by_source(matched)
    details = enrich_details(
        candidates=matched,
        details_limit=details_limit,
        keywords=kws,
        max_price=max_price,
        geocode=geocode,
        gmaps=gmaps,
        concurrency=concurrency,
        ref_lat=ref_lat,
        ref_lon=ref_lon,
        client=http,
        progress_cb=progress_cb,
    )

    output_root = out_dir or (Path(__file__).resolve().parent.parent / "hasil")
    mode = "archive" if keep_history else (storage_mode if storage_mode in {"replace", "merge", "archive"} else "replace")
    if mode == "archive":
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        list_name, detail_name, csv_name = (
            f"list_{area}_{stamp}.json",
            f"detail_{area}_{stamp}.json",
            f"hasil_kos_{stamp}.csv",
        )
    else:
        list_name, detail_name, csv_name = "list_latest.json", "detail_latest.json", "hasil_kos_latest.csv"

    raw_to_save = upsert_items_with_existing(output_root / list_name, raw_items) if mode == "merge" else raw_items
    details_to_save = upsert_items_with_existing(output_root / detail_name, details) if mode == "merge" else details

    list_path = write_json(
        {"sources": sources, "area": area, "count": len(raw_to_save), "items": raw_to_save},
        output_root / list_name,
    )
    detail_path = write_json(details_to_save, output_root / detail_name)
    csv_path = write_csv(details_to_save, output_root / csv_name, mask_contact=mask_contact)

    summary = {
        "sources": sources,
        "area": area,
        "storage_mode": mode,
        "list_count": len(raw_items),
        "matched_count": len(matched),
        "detail_count": len(details_to_save),
        "files": {
            "list_json": list_path.name,
            "detail_json": detail_path.name,
            "csv": csv_path.name,
        },
        "items": details_to_save,
    }
    if progress_cb:
        progress_cb({"type": "done", "summary": {k: v for k, v in summary.items() if k != "items"}})
    return summary

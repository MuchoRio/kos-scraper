"""Worker helpers for multi-source list scraping and fair slot allocation."""

from __future__ import annotations

import inspect
from typing import Any, Callable

from .adapters import get_adapter
from .http_client import PoliteHttpClient
from .models import match_keywords


def interleave_by_source(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Round-robin interleave items by source so details_limit shares slots fairly."""
    buckets: dict[str, list[dict[str, Any]]] = {}
    for item in items:
        buckets.setdefault(str(item.get("source") or "other"), []).append(item)

    ordered: list[dict[str, Any]] = []
    keys = list(buckets.keys())
    idx = 0
    while True:
        progressed = False
        for key in keys:
            lst = buckets[key]
            if idx < len(lst):
                ordered.append(lst[idx])
                progressed = True
        if not progressed:
            break
        idx += 1
    return ordered


def infer_source_from_url(url: str) -> str:
    """Infer adapter key from a listing URL."""
    low = url.lower()
    for name, domain in (
        ("rukita", "rukita.co"),
        ("mamikos", "mamikos.com"),
        ("infokost", "infokost.id"),
        ("cove", "cove.id"),
        ("djuragankamar", "djuragankamar.com"),
        ("rumah123", "rumah123.com"),
        ("kostjakarta", "kostjakarta.com"),
    ):
        if domain in low:
            return name
    return "sewakost"


def scrape_single_source(
    src_name: str,
    area: str,
    max_price: int | None,
    max_pages: int,
    kws: list[str],
    sort: str,
    order: str,
    strict: bool,
    http: PoliteHttpClient,
    emit: Callable[[dict[str, Any]], None],
) -> list[dict[str, Any]]:
    """Fetch paginated listings for one source host within one thread worker."""
    adapter = get_adapter(src_name, client=http)
    accepts_kw = "keywords" in inspect.signature(adapter.list_page).parameters
    src_items: list[dict[str, Any]] = []
    seen_urls: set[str] = set()
    kw_count = 0

    for page in range(1, max_pages + 1):
        emit({
            "type": "phase",
            "phase": "list",
            "source": src_name,
            "page": page,
            "maxPages": max_pages,
            "message": f"[{src_name}] Mengambil halaman {page}/{max_pages}...",
        })
        try:
            kwargs: dict[str, Any] = {
                "area": area,
                "max_price": max_price,
                "page": page,
                "sort": sort,
                "order": order,
            }
            if accepts_kw:
                kwargs["keywords"] = kws
            items, has_next, _ = adapter.list_page(**kwargs)
        except Exception as exc:
            emit({"type": "error", "phase": "list", "source": src_name, "page": page, "error": str(exc)})
            break

        for item in items:
            url = item["url"]
            if url in seen_urls:
                continue
            item["area_match"] = match_keywords(item, kws) if kws else []
            if item["area_match"]:
                kw_count += 1
            if kws and strict and not item["area_match"]:
                continue
            seen_urls.add(url)
            src_items.append(item)

        if not has_next:
            break

    budget_note = f"<= Rp {max_price:,}".replace(",", ".") if max_price else "semua harga"
    msg = (
        f"[{src_name}] Ringkas list: {len(src_items)} lolos budget ({budget_note})"
        + (f", {kw_count} cocok keyword." if kws else ".")
    )
    emit({"type": "phase", "phase": "list_summary", "source": src_name, "message": msg})
    return src_items


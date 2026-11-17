"""Scoped Next.js RSC payload extractor for infokost.id detail pages."""

from __future__ import annotations

import json
import re
from typing import Any

_COORD_SUFFIX_RE = re.compile(r",\s*\[\s*-?\d+\.\d+\s*,\s*-?\d+\.\d+\s*\]\s*$")


def _decode_json_at(text: str, marker: str, start_from: int = 0) -> Any:
    idx = text.find(marker, start_from)
    if idx == -1:
        return None
    val_start = idx + len(marker) - 1
    try:
        parsed, _ = json.JSONDecoder().raw_decode(text, val_start)
        return parsed
    except json.JSONDecodeError:
        return None


def _collect_media_urls(entries: Any) -> list[str]:
    urls: list[str] = []
    if not isinstance(entries, list):
        return urls
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        mtype = str(entry.get("type") or "").upper()
        url = entry.get("url")
        thumb = entry.get("thumbnailUrl")
        if mtype == "IMAGE" and isinstance(url, str) and url.strip():
            urls.append(url.strip())
        elif isinstance(thumb, str) and thumb.strip():
            urls.append(thumb.strip())
    return urls


def extract_infokost_rsc_meta(raw_html: str) -> dict[str, Any]:
    """Extract listing-scoped address, coordinates, media URLs, and placeholder status."""
    norm = raw_html.replace('\\"', '"')
    meta: dict[str, Any] = {
        "media_urls": [],
        "address": None,
        "lat": None,
        "lon": None,
        "unphotographed": False,
    }

    asset_idx = norm.find('"assetDisplay":{')
    head_slice = norm[max(0, asset_idx - 550) : asset_idx] if asset_idx != -1 else norm

    addr_m = re.search(r'"address"\s*:\s*"([^"]+)"', head_slice)
    if addr_m:
        cleaned_addr = _COORD_SUFFIX_RE.sub("", addr_m.group(1)).strip()
        meta["address"] = cleaned_addr or None

    coord_m = re.search(
        r'"coordinate"\s*:\s*\{\s*"latitude"\s*:\s*"(-?\d+\.\d+)"\s*,\s*"longitude"\s*:\s*"(-?\d+\.\d+)"',
        head_slice,
    )
    if coord_m:
        meta["lat"] = float(coord_m.group(1))
        meta["lon"] = float(coord_m.group(2))

    status_m = re.search(r'"status"\s*:\s*"([^"]+)"', head_slice)
    comm_m = re.search(r'"commercialType"\s*:\s*"([^"]+)"', head_slice)
    status = status_m.group(1) if status_m else ""
    commercial = comm_m.group(1) if comm_m else ""

    variant_disp = _decode_json_at(norm, '"variantDisplay":{')
    variant_medias = _collect_media_urls(
        variant_disp.get("medias") if isinstance(variant_disp, dict) else []
    )
    asset_medias = _collect_media_urls(
        _decode_json_at(norm, '"assetMedias":[', max(0, asset_idx))
    )
    combined = variant_medias + asset_medias
    meta["media_urls"] = combined

    has_real_building_photo = any("/buildings/" in u for u in combined)
    if status == "5_PROPOSED" and commercial == "NONE" and not has_real_building_photo:
        meta["unphotographed"] = True
        meta["media_urls"] = []

    return meta

"""Parser, deduplicator, statistics & pre-filter for public Google Sheets and Docs."""

from __future__ import annotations

import csv
import io
import re
from collections import Counter
from typing import Any

from .models import format_idr, parse_price
from .pipeline_workers import infer_source_from_url
from .resource_doc import (
    AREA_MATCHERS,
    clean_cell as _clean_cell,
    clean_photo_urls as _clean_photo_urls,
    extract_coords_from_maps_url,
    extract_phone_and_link as _extract_phone_and_link,
    fetch_google_text as _fetch_text,
    load_google_doc,
    matches_meta_filters,
    parse_google_resource_url,
    strip_leading_emoji as _strip_leading_emoji,
)


_KNOWN_PLATFORM_DOMAINS = (
    "rukita.co", "mamikos.com", "infokost.id", "cove.id",
    "sewakost.com", "djuragankamar.com", "rumah123.com", "kostjakarta.com",
)


def _normalize_row(row_num: int, raw_map: dict[str, str], source_url: str, kid: str | None = None) -> dict[str, Any] | None:
    nama = _clean_cell(raw_map.get("nama"))
    if not nama:
        return None
    wa, wa_link, contact_url = _extract_phone_and_link(raw_map.get("kontak"))
    if not contact_url:
        extra_link = _clean_cell(raw_map.get("link"))
        if extra_link and extra_link.startswith("http"):
            contact_url = extra_link

    maps_url = _clean_cell(raw_map.get("maps"))
    if contact_url and any(m in contact_url.lower() for m in ("google.com/maps", "maps.app.goo.gl", "goo.gl/maps")):
        maps_url = maps_url or contact_url
        contact_url = None

    is_known_platform = bool(contact_url and any(dom in contact_url.lower() for dom in _KNOWN_PLATFORM_DOMAINS))
    platform_url = contact_url if is_known_platform else None

    price = parse_price(_clean_cell(raw_map.get("harga")))
    if price and (price < 100_000 or price > 100_000_000):
        price = None

    lat, lon = extract_coords_from_maps_url(maps_url)
    image_urls = _clean_photo_urls(raw_map.get("foto"))
    fac_raw = _clean_cell(raw_map.get("fasilitas")) or ""
    fasilitas_list = [f.strip() for f in re.split(r"[,;\n]+", fac_raw) if 2 <= len(f.strip()) <= 50]

    peraturan: list[str] = []
    pet = _strip_leading_emoji(_clean_cell(raw_map.get("pet")))
    if pet:
        peraturan.append(pet)
    avail = _strip_leading_emoji(_clean_cell(raw_map.get("avail")))
    if avail:
        peraturan.append(f"Status: {avail}")
    qual = _strip_leading_emoji(_clean_cell(raw_map.get("kualitas")))
    if qual:
        peraturan.append(f"Kurasi: {qual}")
    price_cat = _strip_leading_emoji(_clean_cell(raw_map.get("kategori_harga")))

    unique_url = contact_url or (f"{source_url.split('#')[0]}#row={kid or row_num}")
    return {
        "row_num": row_num,
        "id_kost": kid or f"ROW-{row_num}",
        "source": infer_source_from_url(platform_url) if platform_url else "resource",
        "platform_url": platform_url,
        "url": unique_url,
        "slug": (kid or f"row-{row_num}").lower(),
        "title": nama,
        "nama_kost": nama,
        "price": price,
        "price_text": format_idr(price) if price is not None else "Hubungi",
        "price_options": [price] if price else [],
        "price_suspect": price is None or price < 100_000,
        "price_source": "resource_sheet" if price else "unavailable",
        "kategori_harga": price_cat,
        "kualitas": qual,
        "status_ketersediaan": avail,
        "pet_status": pet,
        "jenis": _strip_leading_emoji(_clean_cell(raw_map.get("gender"))),
        "kecamatan": _clean_cell(raw_map.get("kecamatan")),
        "kelurahan": _clean_cell(raw_map.get("kelurahan")),
        "kota": _strip_leading_emoji(_clean_cell(raw_map.get("kota"))),
        "alamat": _clean_cell(raw_map.get("alamat")),
        "deskripsi": _clean_cell(raw_map.get("deskripsi")),
        "fasilitas": ", ".join(fasilitas_list)[:400] or None,
        "fasilitas_list": fasilitas_list,
        "peraturan": peraturan,
        "image_url": image_urls[0] if image_urls else None,
        "image_urls": image_urls,
        "lat": lat,
        "lon": lon,
        "wa": wa,
        "wa_link": wa_link,
        "kontak": [wa] if wa else [],
        "gmaps_url_hint": maps_url,
        "is_available": not bool(avail and re.search(r"penuh|tidak\s+aktif|habis", avail, re.I)),
    }


def _col_index_map(headers: list[str]) -> dict[str, int]:
    lows = [h.strip().lower() for h in headers]
    def find(*needles: str) -> int | None:
        for n in needles:
            for i, h in enumerate(lows):
                if n in h:
                    return i
        return None
    mapping = {
        "id": find("id kost"),
        "nama": find("nama kost", "nama kos", "nama"),
        "harga": find("harga/bulan", "harga"),
        "kategori_harga": find("kategori harga"),
        "kontak": find("nomor kontak", "wa kontak", "whatsapp", "kontak", "hp", "telp"),
        "kualitas": find("kualitas"),
        "avail": find("ketersediaan", "status"),
        "gender": find("gender", "jenis"),
        "pet": find("pet"),
        "alamat": find("alamat", "lokasi"),
        "kelurahan": find("kelurahan"),
        "kecamatan": find("kecamatan"),
        "kota": find("kota"),
        "fasilitas": find("fasilitas"),
        "deskripsi": find("deskripsi", "keunggulan"),
        "maps": find("g - maps", "google maps", "maps"),
        "foto": find("foto", "video"),
    }
    reserved = {v for v in (mapping.get("maps"), mapping.get("foto")) if v is not None}
    for i, h in enumerate(lows):
        if i not in reserved and any(n in h for n in ("link", "url", "sumber", "website")):
            mapping["link"] = i
            break
    return {k: v for k, v in mapping.items() if v is not None}


def load_google_resource(url: str, area: str = "jakarta-selatan", keywords: list[str] | None = None) -> dict[str, Any]:
    """Load public Google Sheet or Google Doc (including Kostpedia sub-docs) into normalized rows."""
    info = parse_google_resource_url(url)
    if info["kind"] == "sheet":
        csv_raw = _fetch_text(f"https://docs.google.com/spreadsheets/d/{info['id']}/export?format=csv&gid={info['gid']}")
        table = list(csv.reader(io.StringIO(csv_raw)))
        if len(table) < 2:
            raise ValueError("Spreadsheet kosong atau tidak terbaca.")
        headers = table[0]
        cmap = _col_index_map(headers)
        rows: list[dict[str, Any]] = []
        for idx, r in enumerate(table[1:], start=1):
            raw_map = {k: (r[pos] if pos < len(r) else "") for k, pos in cmap.items()}
            kid = _clean_cell(raw_map.get("id"))
            norm = _normalize_row(idx, raw_map, url, kid=kid)
            if norm:
                rows.append(norm)
        schema = "kostpedia_19col" if "ID Kost" in headers else "directory_sheet"
        return {"kind": "sheet", "schema": schema, "headers": headers, "rows": rows, "sub_docs": []}

    return load_google_doc(info["id"], url, area, keywords, _normalize_row, fetch_fn=lambda u: _fetch_text(u))


def compute_resource_stats(loaded: dict[str, Any]) -> dict[str, Any]:
    rows: list[dict[str, Any]] = loaded["rows"]
    prices = sorted(r["price"] for r in rows if r["price"])
    seen_keys: Counter[tuple[str, str]] = Counter()
    cities, kecs = Counter(), Counter()
    with_phone = with_maps = with_photo = avail_cnt = full_cnt = empty_wa = 0
    for r in rows:
        seen_keys[(r["title"].lower(), (r["kecamatan"] or r["wa"] or "").lower())] += 1
        if r["kota"]: cities[r["kota"]] += 1
        if r["kecamatan"]: kecs[r["kecamatan"]] += 1
        if r["wa"] or r["platform_url"]: with_phone += 1
        else: empty_wa += 1
        if r["gmaps_url_hint"] or (r["lat"] and r["lon"]): with_maps += 1
        if r["image_urls"]: with_photo += 1
        if r["is_available"]: avail_cnt += 1
        else: full_cnt += 1
    dup_count = sum(c - 1 for c in seen_keys.values() if c > 1)
    return {
        "kind": loaded["kind"],
        "schema": loaded["schema"],
        "total_rows": len(rows),
        "duplicate_rows": dup_count,
        "empty_contact_count": empty_wa,
        "with_contact_count": with_phone,
        "with_price_count": len(prices),
        "under_1_5m_count": sum(1 for p in prices if p <= 1_500_000),
        "under_1m_count": sum(1 for p in prices if p <= 1_000_000),
        "min_price": prices[0] if prices else None,
        "median_price": prices[len(prices) // 2] if prices else None,
        "max_price": prices[-1] if prices else None,
        "with_maps_count": with_maps,
        "with_photo_count": with_photo,
        "available_count": avail_cnt,
        "full_count": full_cnt,
        "sub_docs_count": len(loaded.get("sub_docs") or []),
        "top_cities": cities.most_common(8),
        "top_kecamatan": kecs.most_common(12),
    }


def filter_and_rank_rows(
    rows: list[dict[str, Any]],
    area: str = "jakarta-selatan",
    max_price: int | None = None,
    keywords: list[str] | None = None,
    only_available: bool = True,
    deduplicate: bool = True,
    include_unpriced: bool = False,
    price_category: str = "all",
    availability: str | None = None,
    quality: str = "all",
    gender: str = "all",
    pet: str = "all",
) -> tuple[list[dict[str, Any]], int]:
    """Filter thousands of sheet rows locally and rank richest candidates first."""
    area_needles = AREA_MATCHERS.get(area, ()) if area and area != "all" else ()
    kws = [k.strip().lower() for k in (keywords or []) if k.strip()]
    avail_mode = availability or ("available_or_unknown" if only_available else "all")
    seen: set[tuple[str, str]] = set()
    dups_skipped = 0
    matched: list[tuple[int, dict[str, Any]]] = []

    for r in rows:
        if not matches_meta_filters(r, price_category, avail_mode, quality, gender, pet):
            continue
        if deduplicate:
            dk = (r["title"].lower(), (r.get("kecamatan") or r.get("wa") or "").lower())
            if dk in seen:
                dups_skipped += 1
                continue
            seen.add(dk)

        blob = " ".join(str(r.get(k) or "") for k in ("title", "alamat", "kecamatan", "kelurahan", "kota", "fasilitas")).lower()
        if area_needles and not any(n in blob for n in area_needles):
            continue
        if kws and not any(kw in blob for kw in kws):
            continue
        p = r.get("price")
        if max_price:
            if p is None and not include_unpriced:
                continue
            if p is not None and p > max_price:
                continue

        score = (3 if p else 0) + (2 if r.get("wa") or r.get("platform_url") else 0) + (2 if r.get("gmaps_url_hint") else 0) + (1 if r.get("image_urls") else 0)
        matched.append((score, r))

    matched.sort(key=lambda pair: (-pair[0], pair[1].get("price") or 99_999_999))
    return [pair[1] for pair in matched], dups_skipped

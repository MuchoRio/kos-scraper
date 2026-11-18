"""Safe JSON and CSV exporters with Excel formula-injection neutralization."""

from __future__ import annotations

import csv
import json
from pathlib import Path
from typing import Any

from .models import mask_phone

CSV_FIELDNAMES = [
    "sumber",
    "nama",
    "harga_min",
    "estimasi_harga_ulasan",
    "harga_mencurigakan",
    "risiko_penipuan",
    "sinyal_penipuan",
    "rating_gmaps",
    "jumlah_ulasan",
    "evaluasi_positif",
    "evaluasi_negatif",
    "tipe",
    "kecamatan",
    "kelurahan",
    "alamat",
    "jarak_km",
    "fasilitas",
    "pemilik",
    "telp",
    "hp",
    "wa",
    "wa_link",
    "gmaps_url",
    "link",
]

_FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def sanitize_csv_cell(value: Any) -> str:
    """Neutralize leading spreadsheet formula triggers before writing CSV cells."""
    if value is None:
        return ""
    text = str(value)
    if text and text[0] in _FORMULA_PREFIXES:
        return "'" + text
    return text


def listing_to_csv_row(item: dict[str, Any], mask_contact: bool = False) -> dict[str, str]:
    """Map canonical listing dictionary to a flat CSV row."""
    telp = item.get("telp") or ""
    hp = item.get("hp") or ""
    wa = item.get("wa") or ""
    wa_link = item.get("wa_link") or ""
    if mask_contact:
        telp = mask_phone(telp) if telp else ""
        hp = mask_phone(hp) if hp else ""
        wa = mask_phone(wa) if wa else ""
        wa_link = ""

    gmaps = item.get("gmaps") if isinstance(item.get("gmaps"), dict) else {}
    scam = item.get("scam_risk") if isinstance(item.get("scam_risk"), dict) else {}
    pros = "; ".join(f"{t['tag']} ({t['count']})" for t in gmaps.get("pros_summary") or [])
    cons = "; ".join(f"{t['tag']} ({t['count']})" for t in gmaps.get("cons_summary") or [])

    return {
        "sumber": sanitize_csv_cell(item.get("source") or ""),
        "nama": sanitize_csv_cell(item.get("title") or item.get("nama_kost") or ""),
        "harga_min": sanitize_csv_cell(item.get("price") if item.get("price") is not None else ""),
        "estimasi_harga_ulasan": sanitize_csv_cell(
            item.get("price_estimate_from_reviews")
            if item.get("price_estimate_from_reviews") is not None
            else ""
        ),
        "harga_mencurigakan": sanitize_csv_cell("Ya" if item.get("price_suspect") else "Tidak"),
        "risiko_penipuan": sanitize_csv_cell(scam.get("level") or "low"),
        "sinyal_penipuan": sanitize_csv_cell("; ".join(scam.get("signals") or [])),
        "rating_gmaps": sanitize_csv_cell(gmaps.get("rating") if gmaps.get("rating") is not None else ""),
        "jumlah_ulasan": sanitize_csv_cell(
            gmaps.get("review_count") if gmaps.get("review_count") is not None else ""
        ),
        "evaluasi_positif": sanitize_csv_cell(pros),
        "evaluasi_negatif": sanitize_csv_cell(cons),
        "tipe": sanitize_csv_cell(item.get("jenis") or ""),
        "kecamatan": sanitize_csv_cell(item.get("kecamatan") or ""),
        "kelurahan": sanitize_csv_cell(item.get("kelurahan") or ""),
        "alamat": sanitize_csv_cell(item.get("alamat") or ""),
        "jarak_km": sanitize_csv_cell(
            item.get("distance_km") if item.get("distance_km") is not None else ""
        ),
        "fasilitas": sanitize_csv_cell((item.get("fasilitas") or "")[:200]),
        "pemilik": sanitize_csv_cell(item.get("nama_pemilik") or ""),
        "telp": sanitize_csv_cell(telp),
        "hp": sanitize_csv_cell(hp),
        "wa": sanitize_csv_cell(wa),
        "wa_link": sanitize_csv_cell(wa_link),
        "gmaps_url": sanitize_csv_cell(gmaps.get("maps_url") or ""),
        "link": sanitize_csv_cell(item.get("url") or ""),
    }


def write_csv(
    items: list[dict[str, Any]],
    output_path: Path,
    mask_contact: bool = False,
) -> Path:
    """Write sorted kos listings to UTF-8-SIG CSV safely (handles empty sets)."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    sorted_items = sorted(
        items,
        key=lambda x: (
            1 if x.get("price_suspect") else 0,
            x.get("price") if isinstance(x.get("price"), int) else 10**12,
        ),
    )
    with output_path.open("w", newline="", encoding="utf-8-sig") as fh:
        writer = csv.DictWriter(fh, fieldnames=CSV_FIELDNAMES)
        writer.writeheader()
        for item in sorted_items:
            writer.writerow(listing_to_csv_row(item, mask_contact=mask_contact))
    return output_path


def write_json(payload: Any, output_path: Path) -> Path:
    """Write UTF-8 JSON file cleanly with parent directory creation."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=1),
        encoding="utf-8",
    )
    return output_path


def upsert_items_with_existing(
    existing_path: Path,
    new_items: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Merge new kos items into an existing JSON result file, deduplicating by url/slug."""
    if not existing_path.exists():
        return list(new_items)
    try:
        raw = json.loads(existing_path.read_text(encoding="utf-8"))
        prev = raw if isinstance(raw, list) else raw.get("items", []) if isinstance(raw, dict) else []
    except (OSError, json.JSONDecodeError):
        prev = []

    seen: dict[str, dict[str, Any]] = {}
    ordered_keys: list[str] = []
    for item in [*new_items, *prev]:
        if not isinstance(item, dict):
            continue
        k = str(item.get("url") or item.get("id_kost") or item.get("slug") or item.get("title") or "")
        if not k or k in seen:
            continue
        seen[k] = item
        ordered_keys.append(k)
    return [seen[k] for k in ordered_keys]


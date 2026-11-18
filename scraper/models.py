"""Canonical data models, price parsers, and area presets for kos-scraper."""

from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

_LANDMARKS_FILE = Path(__file__).resolve().parent.parent / "shared" / "landmarks.json"

PRESET_AREAS: list[dict[str, str]] = [
    {"slug": "jakarta-selatan", "label": "Jakarta Selatan"},
    {"slug": "jakarta-pusat", "label": "Jakarta Pusat"},
    {"slug": "jakarta-barat", "label": "Jakarta Barat"},
    {"slug": "jakarta-timur", "label": "Jakarta Timur"},
    {"slug": "jakarta-utara", "label": "Jakarta Utara"},
    {"slug": "depok", "label": "Depok"},
    {"slug": "tangerang-selatan", "label": "Tangerang Selatan"},
    {"slug": "bekasi", "label": "Bekasi"},
    {"slug": "bandung", "label": "Bandung"},
    {"slug": "yogyakarta", "label": "Yogyakarta"},
]

LANDMARK_REFS: list[dict[str, Any]] = json.loads(_LANDMARKS_FILE.read_text(encoding="utf-8"))


@dataclass
class KosListing:
    """Normalized kos listing record shared across all source adapters."""

    source: str
    url: str
    slug: str
    title: str | None = None
    nama_kost: str | None = None
    price: int | None = None
    price_text: str | None = None
    price_options: list[int] = field(default_factory=list)
    price_suspect: bool = False
    price_source: str | None = None
    jenis: str | None = None
    kecamatan: str | None = None
    kelurahan: str | None = None
    alamat: str | None = None
    deskripsi: str | None = None
    fasilitas: str | None = None
    fasilitas_list: list[str] = field(default_factory=list)
    peraturan: list[str] = field(default_factory=list)
    image_url: str | None = None
    image_urls: list[str] = field(default_factory=list)
    image_source: str | None = None
    source_rating: float | None = None
    source_review_count: int | None = None
    available_room: int | None = None
    promo_label: str | None = None
    lat: float | None = None
    lon: float | None = None
    distance_km: float | None = None
    nama_pemilik: str | None = None
    telp: str | None = None
    hp: str | None = None
    wa: str | None = None
    wa_link: str | None = None
    kontak: list[str] = field(default_factory=list)
    area_match: list[str] = field(default_factory=list)
    is_featured: bool = False
    gmaps: dict[str, Any] | None = None
    price_estimate_from_reviews: int | None = None
    price_estimate_text: str | None = None
    scam_risk: dict[str, Any] | None = None
    attributes: dict[str, Any] | None = None
    nearby_transit: dict[str, Any] | None = None
    scraped_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(timespec="seconds")
    )

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def format_idr(amount: int | None) -> str | None:
    """Format integer Rupiah price consistently with dot separators."""
    if amount is None or amount < 0:
        return None
    return f"Rp {amount:,}".replace(",", ".")


def parse_price(raw: str | None) -> int | None:
    """Extract integer Rupiah price from strings like 'Rp 1.500.000' or '2,5 jt'."""
    if not raw:
        return None
    text = raw.strip()
    m_jt = re.search(r"(?:rp\.?\s*)?(\d+(?:[.,]\d+)?)\s*(?:jt|juta)\b", text, re.I)
    if m_jt:
        num = float(m_jt.group(1).replace(",", "."))
        return int(round(num * 1_000_000))
    m_rb = re.search(r"(?:rp\.?\s*)?(\d+(?:[.,]\d+)?)\s*(?:rb|ribu|k)\b", text, re.I)
    if m_rb:
        num = float(m_rb.group(1).replace(",", "."))
        return int(round(num * 1_000))
    m_rp = re.search(r"rp\.?\s*(\d{1,3}(?:[.,]\d{3})+|\d+)", text, re.I)
    if m_rp:
        digits = re.sub(r"\D", "", m_rp.group(1))
        val = int(digits) if digits else None
        return val if (val is not None and val <= 100_000_000) else None
    digits = re.sub(r"\D", "", text)
    val = int(digits) if digits else None
    return val if (val is not None and val <= 100_000_000) else None


_NON_RENT_BEFORE_RE = re.compile(
    r"\b(?:deposit|jaminan|uang\s+muka|booking\s+fee|berdua|extra\s+person|tambahan|tamu|menginap|"
    r"parkir|biaya\s+(?:listrik|air|admin|service|kebersihan)|token|ipl|denda|laundry|"
    r"(?:sewa\s+)?(?:harian|mingguan|tahunan)|per\s*(?:hari|minggu|malam|tahun)|daily|weekly|yearly)\b",
    re.I,
)
_NON_RENT_AFTER_RE = re.compile(
    r"^\s*(?:/|\bper\b)?\s*(?:hari|hr|malam|minggu|mgg|tahun|thn|orang|pax|day|night|week|year)\b",
    re.I,
)
_PRICE_TOKEN_RE = re.compile(
    r"rp\.?\s*[\d.,]+(?:\s*(?:jt|juta|rb|ribu))?|\b\d+(?:[.,]\d+)?\s*(?:jt|juta|rb|ribu)\b",
    re.I,
)


def extract_all_prices(text: str | None, min_monthly: int = 100_000) -> list[int]:
    """Return sorted unique plausible monthly prices found inside a text block."""
    if not text:
        return []
    found: set[int] = set()
    for match in re.finditer(
        r"rp\.?\s*[\d.,]+(?:\s*(?:jt|juta|rb|ribu))?|\b\d+(?:[.,]\d+)?\s*(?:jt|juta)\b",
        text,
        re.I,
    ):
        val = parse_price(match.group(0))
        if val is not None and min_monthly <= val <= 100_000_000:
            found.add(val)
    return sorted(found)


def extract_room_rent_prices(text: str | None, min_monthly: int = 100_000) -> list[int]:
    """Extract plausible monthly room-rent prices, excluding deposits, addons, and daily/weekly rates."""
    if not text:
        return []
    found: set[int] = set()
    prev_end = 0
    for match in _PRICE_TOKEN_RE.finditer(text):
        seg_before = text[max(prev_end, match.start() - 55) : match.start()]
        # Trim at the latest line/bullet boundary so previous sentence keywords don't bleed in
        for sep in ("\n", "•", ";", "|", ". "):
            pos = seg_before.rfind(sep)
            if pos != -1:
                seg_before = seg_before[pos + len(sep) :]
        seg_after = text[match.end() : match.end() + 26].split("\n", 1)[0]
        prev_end = match.end()

        if _NON_RENT_BEFORE_RE.search(seg_before) or _NON_RENT_AFTER_RE.search(seg_after):
            continue
        val = parse_price(match.group(0))
        if val is not None and min_monthly <= val <= 100_000_000:
            found.add(val)
    return sorted(found)


def normalize_wa_link(raw_phone: str | None) -> str | None:
    """Normalize Indonesian phone numbers into a wa.me URL."""
    if not raw_phone:
        return None
    digits = re.sub(r"\D", "", raw_phone)
    if digits.startswith("08"):
        digits = "62" + digits[1:]
    elif digits.startswith("8") and len(digits) >= 9:
        digits = "62" + digits
    if len(digits) < 10 or len(digits) > 15:
        return None
    return f"https://wa.me/{digits}"


def mask_phone(raw_phone: str | None) -> str:
    """Mask middle digits of a phone number for privacy-conscious previews."""
    if not raw_phone:
        return ""
    digits = re.sub(r"\D", "", raw_phone)
    if len(digits) < 8:
        return "••••"
    return f"{digits[:4]}-••••-{digits[-4:]}"


def match_keywords(item: dict[str, Any], keywords: list[str]) -> list[str]:
    """Match keywords case-insensitively across location and title metadata."""
    if not keywords:
        return []
    fields = ("title", "nama_kost", "slug", "jenis", "kecamatan", "kelurahan", "alamat", "deskripsi")
    blob = " ".join(str(item.get(k) or "") for k in fields).lower().replace("-", " ")
    return [kw for kw in keywords if kw.lower() in blob]


def dedup_image_urls(urls: Iterable[Any], limit: int = 12) -> list[str]:
    """Return ordered, deduplicated HTTP(S) image URLs excluding non-photo/placeholder assets."""
    out: list[str] = []
    seen: set[str] = set()
    for raw in urls:
        if not isinstance(raw, str):
            continue
        clean = raw.strip()
        if not clean or not clean.startswith(("http://", "https://")) or clean in seen:
            continue
        if re.search(
            r"streetviewpixels-pa\.googleapis\.com|googleusercontent\.com/a/|/AAAAAAAAAAI/|default_geocode|"
            r"(?:\.svg|\.html|/favicon|Ic_Verified|2b5f0791-94da-45df-98a0-2362a3bf96a9)(?:$|[/?#])",
            clean,
            re.I,
        ):
            continue
        seen.add(clean)
        out.append(clean)
        if len(out) >= limit:
            break
    return out


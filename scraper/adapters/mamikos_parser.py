"""Browser discovery & /room/* embedded `detail = {...}` parser for Mamikos."""

from __future__ import annotations

import html as html_lib
import json
import re
from typing import Any

import lxml.html

from ..models import KosListing, dedup_image_urls, format_idr, parse_price

_GENDER_CODE_MAP = {
    0: "Kost Campur",
    1: "Kost Putra",
    2: "Kost Putri",
}


def clean_text(raw: str) -> str:
    return re.sub(r"\s+", " ", html_lib.unescape(raw)).strip()


def _clean_subdistrict(raw: str) -> str | None:
    cleaned = re.sub(r"^Kecamatan\s+", "", clean_text(raw), flags=re.I).strip()
    return cleaned or None


def map_gender(raw: Any) -> str | None:
    if isinstance(raw, int) and raw in _GENDER_CODE_MAP:
        return _GENDER_CODE_MAP[raw]
    low = str(raw or "").strip().lower()
    if low in {"0", "campur", "kost campur"}:
        return "Kost Campur"
    if low in {"1", "putra", "cowok", "kost putra"}:
        return "Kost Putra"
    if low in {"2", "putri", "cewek", "kost putri"}:
        return "Kost Putri"
    return None


def detect_jenis(tokens: list[str]) -> str | None:
    for tok in tokens:
        low = tok.lower()
        if low in {"putri", "putra", "campur"}:
            return f"Kost {tok.capitalize()}"
    return None


def collect_str_list(*groups: Any) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for group in groups:
        if not isinstance(group, list):
            continue
        for entry in group:
            val = entry.get("name") or entry.get("label") if isinstance(entry, dict) else entry
            txt = clean_text(str(val or ""))
            if txt and txt.lower() not in seen:
                seen.add(txt.lower())
                out.append(txt)
    return out


def _collect_booking_rules(raw: Any) -> list[str]:
    if not isinstance(raw, dict):
        return []
    labels = {
        "is_married": "Boleh Pasutri",
        "is_bring_child": "Boleh Bawa Anak",
        "is_24_hours": "Akses 24 Jam",
    }
    return [label for key, label in labels.items() if raw.get(key) is True]


def _clean_coord(val: Any, lo: float, hi: float) -> float | None:
    try:
        num = float(val)
    except (TypeError, ValueError):
        return None
    return num if lo <= num <= hi and num != 0 else None


def extract_detail_json(raw_html: str) -> dict[str, Any] | None:
    """Decode Mamikos embedded JS `detail = {...}` object from /room/* HTML."""
    m = re.search(r"(?:var\s+|window\.)?\bdetail\s*=\s*(\{)", raw_html)
    if not m:
        return None
    try:
        parsed, _ = json.JSONDecoder().raw_decode(raw_html, m.start(1))
        return parsed if isinstance(parsed, dict) else None
    except (ValueError, json.JSONDecodeError):
        return None


def _clean_rating(val: Any) -> float | None:
    try:
        num = float(str(val).replace(",", "."))
    except (TypeError, ValueError):
        return None
    return round(num, 2) if 0 < num <= 5.0 else None


def map_browser_card(source_name: str, raw: dict[str, Any]) -> dict[str, Any] | None:
    url = str(raw.get("url") or "").strip()
    title = clean_text(str(raw.get("title") or ""))
    if not url or not title:
        return None
    price_val = raw.get("price")
    price = int(price_val) if isinstance(price_val, (int, float)) and price_val >= 100_000 else None
    subdistrict = _clean_subdistrict(str(raw.get("subdistrict") or raw.get("area_label") or ""))
    alamat = clean_text(str(raw.get("address") or raw.get("area_label") or "")) or subdistrict
    raw_photos = raw.get("photo_urls") if isinstance(raw.get("photo_urls"), list) else [raw.get("photo_url")]
    photos = dedup_image_urls(raw_photos)
    rev_cnt = raw.get("review_count")
    avail = raw.get("available_room")
    raw_promo = clean_text(str(raw.get("promo_label") or ""))
    promo = None if (not raw_promo or re.fullmatch(r"non[-_\s]*gp", raw_promo, re.I)) else raw_promo
    return {
        "source": source_name,
        "url": url,
        "slug": url.rstrip("/").rsplit("/", 1)[-1],
        "title": title,
        "listing_price": price,
        "jenis": map_gender(raw.get("gender")),
        "kecamatan": subdistrict,
        "alamat": alamat,
        "fasilitas_list": collect_str_list(raw.get("top_facilities"), raw.get("labels")),
        "image_url": photos[0] if photos else raw.get("photo_url"),
        "image_urls": photos,
        "lat": _clean_coord(raw.get("latitude"), -11.0, 6.0),
        "lon": _clean_coord(raw.get("longitude"), 95.0, 141.0),
        "source_rating": _clean_rating(raw.get("rating")),
        "source_review_count": int(rev_cnt) if isinstance(rev_cnt, int) and rev_cnt >= 0 else None,
        "available_room": int(avail) if isinstance(avail, int) and avail >= 0 else None,
        "promo_label": promo,
        "is_featured": bool(raw.get("is_featured")),
    }


def build_listing_from_detail(
    source_name: str,
    url: str,
    slug: str,
    detail: dict[str, Any],
    hint: dict[str, Any],
) -> KosListing:
    """Map embedded `detail = {...}` JSON payload to canonical KosListing."""
    raw_imgs: list[Any] = []
    for card in detail.get("cards") or []:
        if isinstance(card, dict):
            photo = card.get("photo_url") or card.get("url") or {}
            if isinstance(photo, dict):
                raw_imgs.append(photo.get("large") or photo.get("medium") or photo.get("small"))
    raw_imgs.extend(hint.get("image_urls") or [])
    raw_imgs.append(hint.get("image_url"))
    image_urls = dedup_image_urls(raw_imgs)

    title = clean_text(str(detail.get("room_title") or "")) or hint.get("title") or slug.replace("-", " ").title()
    pm = detail.get("price_monthly")
    price = int(pm) if isinstance(pm, (int, float)) and pm >= 100_000 else None
    parsed_time = parse_price(str(detail.get("price_title_time") or ""))
    if price is None:
        price = parsed_time or hint.get("listing_price")
    price_options = sorted(
        {p for p in (price, parsed_time, hint.get("listing_price")) if isinstance(p, int) and p >= 100_000}
    )

    kecamatan = _clean_subdistrict(str(detail.get("area_subdistrict") or "")) or hint.get("kecamatan")
    kota = clean_text(str(detail.get("area_city") or ""))
    raw_addr = clean_text(str(detail.get("address") or ""))
    alamat = raw_addr or hint.get("alamat") or (", ".join(x for x in (kecamatan, kota) if x) or None)

    desc_parts = [
        clean_text(str(detail.get(k) or ""))
        for k in ("description", "remarks", "fac_near_other", "fac_room_other", "fac_share_other")
        if clean_text(str(detail.get(k) or ""))
    ]
    if detail.get("size"):
        desc_parts.insert(0, f"Ukuran kamar: {clean_text(str(detail['size']))}")
    facilities = collect_str_list(
        detail.get("fac_room"),
        detail.get("fac_bath"),
        detail.get("fac_share"),
        detail.get("fac_park"),
        detail.get("top_facilities"),
        detail.get("fac_near"),
        detail.get("fac_keyword"),
        hint.get("fasilitas_list"),
    )
    peraturan = collect_str_list(
        detail.get("kos_rule"),
        detail.get("kos_rule_icon"),
        _collect_booking_rules(detail.get("booking_rules")),
        detail.get("booking_rules") if isinstance(detail.get("booking_rules"), list) else [],
    )
    source_rating = _clean_rating(detail.get("rating")) or hint.get("source_rating")
    rev_raw = detail.get("review_count")
    source_review_count = (
        int(rev_raw) if isinstance(rev_raw, int) and rev_raw >= 0 else hint.get("source_review_count")
    )
    avail_raw = detail.get("available_room")
    available_room = int(avail_raw) if isinstance(avail_raw, int) and avail_raw >= 0 else hint.get("available_room")
    promo_obj = detail.get("promotion")
    promo_text = (
        clean_text(str(promo_obj.get("title") or promo_obj.get("name") or ""))
        if isinstance(promo_obj, dict)
        else ""
    ) or hint.get("promo_label")

    return KosListing(
        source=source_name,
        url=url,
        slug=slug,
        title=title,
        nama_kost=title,
        price=price,
        price_text=format_idr(price) if price is not None else "Hubungi",
        price_options=price_options,
        price_suspect=price is None or price < 100_000,
        price_source="mamikos_detail_json" if price else "unavailable",
        jenis=map_gender(detail.get("gender")) or hint.get("jenis"),
        kecamatan=kecamatan,
        alamat=alamat,
        deskripsi="\n".join(dict.fromkeys(desc_parts)) or None,
        fasilitas=(", ".join(facilities)[:400] if facilities else None),
        fasilitas_list=facilities,
        peraturan=peraturan,
        image_url=image_urls[0] if image_urls else None,
        image_urls=image_urls,
        source_rating=source_rating,
        source_review_count=source_review_count,
        available_room=available_room,
        promo_label=promo_text or None,
        lat=_clean_coord(detail.get("latitude"), -11.0, 6.0) or hint.get("lat"),
        lon=_clean_coord(detail.get("longitude"), 95.0, 141.0) or hint.get("lon"),
        nama_pemilik=clean_text(str(detail.get("owner_name") or "")) or None,
        is_featured=bool(hint.get("is_featured", False)),
    )


def build_listing_from_fallback(
    source_name: str,
    url: str,
    slug: str,
    raw_html: str | None,
    hint: dict[str, Any],
) -> KosListing:
    """Fallback parser when detail HTML lacks embedded `detail` JSON or network fails offline."""
    raw_imgs: list[Any] = [*(hint.get("image_urls") or []), hint.get("image_url")]
    if raw_html:
        doc = lxml.html.fromstring(raw_html)
        h1 = doc.xpath("//h1")
        if h1 and clean_text(h1[0].text_content()):
            hint.setdefault("title", clean_text(h1[0].text_content()))
        raw_imgs.extend(doc.xpath('//meta[@property="og:image"]/@content | //img[contains(@src, "mamikos")]/@src'))

    title = hint.get("title") or slug.replace("-", " ").title()
    price = hint.get("listing_price")
    facilities = list(hint.get("fasilitas_list") or [])
    kecamatan = hint.get("kecamatan")
    image_urls = dedup_image_urls(raw_imgs)

    return KosListing(
        source=source_name,
        url=url,
        slug=slug,
        title=title,
        nama_kost=title,
        price=price,
        price_text=format_idr(price) if price is not None else "Hubungi",
        price_options=[price] if price else [],
        price_suspect=price is None or price < 100_000,
        price_source="mamikos_ssr_card" if price else "unavailable",
        jenis=hint.get("jenis"),
        kecamatan=kecamatan,
        alamat=hint.get("alamat") or kecamatan,
        fasilitas=(", ".join(facilities)[:400] if facilities else None),
        fasilitas_list=facilities,
        image_url=image_urls[0] if image_urls else None,
        image_urls=image_urls,
        source_rating=hint.get("source_rating"),
        source_review_count=hint.get("source_review_count"),
        available_room=hint.get("available_room"),
        promo_label=hint.get("promo_label"),
        lat=hint.get("lat"),
        lon=hint.get("lon"),
        is_featured=bool(hint.get("is_featured", False)),
    )


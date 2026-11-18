"""Next.js __NEXT_DATA__ adapter for cove.id coliving and kos listings."""

from __future__ import annotations

import json
import re
from typing import Any

import lxml.html

from ..models import KosListing, dedup_image_urls, format_idr
from .base import SourceAdapter

_AREA_PATH_MAP = {
    "jakarta-selatan": "/kost/jakarta/selatan",
    "jakarta-pusat": "/kost/jakarta/pusat",
    "jakarta-barat": "/kost/jakarta/barat",
    "jakarta-timur": "/kost/jakarta/timur",
    "jakarta-utara": "/kost/jakarta/utara",
    "tangerang-selatan": "/kost/tangerang/selatan",
    "depok": "/kost/depok",
    "bekasi": "/kost/bekasi",
    "bandung": "/kost/bandung",
}

_AMENITY_FLAGS = (
    ("wifi", "Free WiFi"),
    ("water_heater", "Water Heater"),
    ("tv", "TV"),
    ("fridge", "Kulkas"),
    ("kitchen", "Dapur"),
    ("washer", "Mesin Cuci"),
    ("dryer", "Pengering"),
    ("balcony", "Balkon"),
    ("microwave", "Microwave"),
    ("electric_hob", "Kompor Listrik"),
    ("gas_hob", "Kompor Gas"),
    ("dishwasher", "Dishwasher"),
    ("ironing_board", "Setrika"),
    ("espresso_machine", "Coffee Maker"),
)

_BUILDING_AMENITY_FLAGS = (
    ("moto_parking", "Parkir Motor"),
    ("car_parking", "Parkir Mobil"),
    ("laundry", "Laundry"),
    ("coin_laundry", "Laundry Koin"),
    ("gym", "Gym"),
    ("lift", "Lift"),
    ("dining_area", "Ruang Makan"),
    ("garden", "Taman"),
    ("lobby", "Lobi"),
    ("lounge", "Ruang Bersama"),
)


def _clean_coord(val: Any, lo: float, hi: float) -> float | None:
    try:
        num = float(val)
    except (TypeError, ValueError):
        return None
    return num if lo <= num <= hi and num != 0 else None


def _extract_cove_facilities(prop: dict[str, Any], building: dict[str, Any], fallback: Any) -> list[str]:
    out = [label for field, label in _AMENITY_FLAGS if prop.get(field)]
    out.extend(label for field, label in _BUILDING_AMENITY_FLAGS if building.get(field) and label not in out)
    return out or list(fallback or [])


def _extract_cove_prices(prop: dict[str, Any], fallback: int | None) -> list[int]:
    vals: set[int] = set()
    if isinstance(fallback, int) and fallback >= 100_000:
        vals.add(fallback)
    for room in prop.get("listings") or []:
        if not isinstance(room, dict):
            continue
        prices = room.get("prices") if isinstance(room.get("prices"), dict) else {}
        for k in ("monthly_min_price", "monthly_price", "price"):
            v = prices.get(k) if prices else room.get(k)
            if isinstance(v, (int, float)) and 100_000 <= v <= 100_000_000:
                vals.add(int(v))
    return sorted(vals)[:8]


def _extract_next_data(html: str) -> dict[str, Any]:
    doc = lxml.html.fromstring(html)
    scripts = doc.xpath('//script[@id="__NEXT_DATA__"]/text()')
    if not scripts:
        return {}
    try:
        return json.loads(scripts[0])
    except json.JSONDecodeError:
        return {}


def _localized_text(val: Any) -> str:
    if isinstance(val, dict):
        return str(val.get("id") or val.get("en") or "").strip()
    return str(val or "").strip()


class CoveAdapter(SourceAdapter):
    """Adapter for cove.id Next.js SSR listings & property JSON payloads."""

    name = "cove"
    base_url = "https://cove.id"

    def build_list_url(self, area: str = "jakarta-selatan", page: int = 1) -> str:
        sub = _AREA_PATH_MAP.get(area, f"/kost/jakarta/{area.replace('jakarta-', '')}")
        return f"{self.base_url}{sub}?page={page}" if page > 1 else f"{self.base_url}{sub}"

    def list_page(
        self,
        area: str = "jakarta-selatan",
        max_price: int | None = None,
        page: int = 1,
        sort: str = "price",
        order: str = "asc",
        html: str | None = None,
    ) -> tuple[list[dict[str, Any]], bool, str]:
        url = self.build_list_url(area=area, page=page)
        raw_html = html if html is not None else self.client.get(url)
        nd = _extract_next_data(raw_html)
        init_props = nd.get("props", {}).get("pageProps", {}).get("initialProperties", {})
        props = init_props.get("properties") if isinstance(init_props, dict) else []
        if not isinstance(props, list):
            return [], False, url

        items: list[dict[str, Any]] = []
        for prop in props:
            if not isinstance(prop, dict):
                continue
            slug = str(prop.get("slug") or "").strip()
            if not slug:
                continue
            price_raw = prop.get("monthly_min_price")
            price = int(price_raw) if isinstance(price_raw, (int, float)) and price_raw > 0 else None
            if max_price and price and price > max_price:
                continue

            building = prop.get("building") if isinstance(prop.get("building"), dict) else {}
            area_obj = building.get("area") if isinstance(building.get("area"), dict) else {}
            kecamatan = _localized_text(area_obj.get("name")) or None

            facilities = _extract_cove_facilities(prop, building, None)
            media = prop.get("media") if isinstance(prop.get("media"), list) else []
            image_url = media[0].get("medium") or media[0].get("large") if media and isinstance(media[0], dict) else None
            tags = [t.get("name", {}).get("id") for t in (prop.get("tags") or []) if isinstance(t, dict)]
            jenis = "Kost Campur" if any("pasangan" in str(t).lower() or "profesional" in str(t).lower() for t in tags) else "Coliving"

            items.append({
                "source": self.name,
                "title": prop.get("name") or slug,
                "url": f"{self.base_url}/properties/{slug}",
                "slug": slug,
                "listing_price": price,
                "jenis": jenis,
                "kecamatan": kecamatan,
                "alamat": _localized_text(prop.get("address")) or None,
                "fasilitas_list": facilities,
                "image_url": image_url,
                "lat": _clean_coord(building.get("lat"), -11.0, 6.0),
                "lon": _clean_coord(building.get("lng"), 95.0, 141.0),
                "raw_prop": prop,
            })

        total_pages = int(init_props.get("last_page") or 1) if isinstance(init_props, dict) else 1
        return items, page < total_pages, url

    def parse_detail(
        self,
        url: str,
        html: str | None = None,
        listing_hint: dict[str, Any] | None = None,
    ) -> KosListing:
        raw_html = html if html is not None else self.client.get(url)
        nd = _extract_next_data(raw_html)
        hint = listing_hint or {}
        slug = hint.get("slug") or url.rstrip("/").rsplit("/", 1)[-1]

        prop = nd.get("props", {}).get("pageProps", {}).get("property")
        if not isinstance(prop, dict):
            prop = hint.get("raw_prop") if isinstance(hint.get("raw_prop"), dict) else {}

        title = prop.get("name") or hint.get("title") or slug
        price_raw = prop.get("monthly_min_price") or hint.get("listing_price")
        price = int(price_raw) if isinstance(price_raw, (int, float)) and price_raw > 0 else None

        building = prop.get("building") if isinstance(prop.get("building"), dict) else {}
        desc = _localized_text(building.get("description"))
        desc = re.sub(r"<[^>]+>", " ", desc)
        desc = re.sub(r"\s+", " ", desc).strip()[:600] or None

        area_obj = building.get("area") if isinstance(building.get("area"), dict) else {}
        kecamatan = _localized_text(area_obj.get("name")) or hint.get("kecamatan")

        facilities = _extract_cove_facilities(prop, building, hint.get("fasilitas_list"))
        media = prop.get("media") if isinstance(prop.get("media"), list) else []
        raw_imgs: list[Any] = [
            (m.get("medium") or m.get("large"))
            for m in media
            if isinstance(m, dict)
        ]
        raw_imgs.append(hint.get("image_url"))
        image_urls = dedup_image_urls(raw_imgs)
        image_url = image_urls[0] if image_urls else None
        lat = _clean_coord(building.get("lat"), -11.0, 6.0) or hint.get("lat")
        lon = _clean_coord(building.get("lng"), 95.0, 141.0) or hint.get("lon")
        price_options = _extract_cove_prices(prop, price)

        return KosListing(
            source=self.name,
            url=url,
            slug=slug,
            title=title,
            nama_kost=title,
            price=price,
            price_text=format_idr(price) if price is not None else "Hubungi",
            price_options=price_options,
            price_suspect=price is None or price < 100_000,
            price_source="cove_next_data" if price else "unavailable",
            jenis=hint.get("jenis") or "Coliving",
            kecamatan=kecamatan,
            alamat=_localized_text(prop.get("address")) or (hint.get("alamat") if isinstance(hint.get("alamat"), str) else None),
            deskripsi=desc,
            fasilitas=(", ".join(facilities)[:400] if facilities else None),
            fasilitas_list=facilities,
            image_url=image_url,
            image_urls=image_urls,
            lat=lat,
            lon=lon,
        )


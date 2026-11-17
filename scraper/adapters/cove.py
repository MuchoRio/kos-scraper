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
)


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

            facilities = [label for field, label in _AMENITY_FLAGS if prop.get(field)]
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
                "alamat": prop.get("address"),
                "fasilitas_list": facilities,
                "image_url": image_url,
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

        facilities = [label for field, label in _AMENITY_FLAGS if prop.get(field)] or list(
            hint.get("fasilitas_list") or []
        )
        media = prop.get("media") if isinstance(prop.get("media"), list) else []
        raw_imgs: list[Any] = [
            (m.get("medium") or m.get("large"))
            for m in media
            if isinstance(m, dict)
        ]
        raw_imgs.append(hint.get("image_url"))
        image_urls = dedup_image_urls(raw_imgs)
        image_url = image_urls[0] if image_urls else None

        return KosListing(
            source=self.name,
            url=url,
            slug=slug,
            title=title,
            nama_kost=title,
            price=price,
            price_text=format_idr(price) if price is not None else "Hubungi",
            price_options=[price] if price else [],
            price_suspect=price is None or price < 100_000,
            price_source="cove_next_data" if price else "unavailable",
            jenis=hint.get("jenis") or "Coliving",
            kecamatan=kecamatan,
            alamat=prop.get("address") or hint.get("alamat"),
            deskripsi=desc,
            fasilitas=(", ".join(facilities)[:400] if facilities else None),
            fasilitas_list=facilities,
            image_url=image_url,
            image_urls=image_urls,
        )


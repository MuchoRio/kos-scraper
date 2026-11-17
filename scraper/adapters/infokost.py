"""SSR lxml adapter for infokost.id listings and detail pages."""

from __future__ import annotations

import html as html_lib
import re
from typing import Any

import lxml.html

from ..models import KosListing, dedup_image_urls, extract_all_prices, format_idr, parse_price
from .base import SourceAdapter
from .infokost_rsc import extract_infokost_rsc_meta

_JENIS_MAP = {
    "cewek": "Kost Putri",
    "putri": "Kost Putri",
    "cowok": "Kost Putra",
    "putra": "Kost Putra",
    "campur": "Kost Campur",
}

_JAKSEL_SUBDISTRICTS: dict[str, str] = {
    "mampang": "mampang-prapatan-jakarta-selatan",
    "kemang": "mampang-prapatan-jakarta-selatan",
    "bangka": "mampang-prapatan-jakarta-selatan",
    "pela": "mampang-prapatan-jakarta-selatan",
    "blok m": "kebayoran-baru-jakarta-selatan",
    "kebayoran": "kebayoran-baru-jakarta-selatan",
    "senopati": "kebayoran-baru-jakarta-selatan",
    "melawai": "kebayoran-baru-jakarta-selatan",
    "petogogan": "kebayoran-baru-jakarta-selatan",
    "cipete": "cilandak-jakarta-selatan",
    "fatmawati": "cilandak-jakarta-selatan",
    "cilandak": "cilandak-jakarta-selatan",
    "ampera": "pasar-minggu-jakarta-selatan",
    "pejaten": "pasar-minggu-jakarta-selatan",
    "pasar minggu": "pasar-minggu-jakarta-selatan",
    "tebet": "tebet-jakarta-selatan",
    "setiabudi": "setiabudi-jakarta-selatan",
    "kuningan": "setiabudi-jakarta-selatan",
    "kalibata": "pancoran-jakarta-selatan",
    "pancoran": "pancoran-jakarta-selatan",
}


def _clean(raw: str) -> str:
    return re.sub(r"\s+", " ", html_lib.unescape(raw)).strip()


def _map_jenis(text: str | None) -> str | None:
    if not text:
        return None
    low = text.lower()
    for key, val in _JENIS_MAP.items():
        if re.search(rf"\b{key}\b", low):
            return val
    return None


def resolve_infokost_areas(area: str, keywords: list[str] | None) -> list[str]:
    """Expand jakarta-selatan into targeted Infokost subdistrict slugs matching keywords."""
    if area != "jakarta-selatan" or not keywords:
        return [area]
    targets: list[str] = []
    for kw in keywords:
        low = kw.strip().lower()
        for needle, slug in _JAKSEL_SUBDISTRICTS.items():
            if needle in low and slug not in targets:
                targets.append(slug)
    return targets or [area]


class InfokostAdapter(SourceAdapter):
    """Adapter for infokost.id SSR listings (/kost/<area>) and /listings/* detail pages."""

    name = "infokost"
    base_url = "https://infokost.id"

    def build_list_url(self, area: str = "jakarta-selatan", page: int = 1) -> str:
        base = f"{self.base_url}/kost/{area}"
        return f"{base}/{page}" if page > 1 else base

    def _parse_cards(
        self,
        doc: lxml.html.HtmlElement,
        max_price: int | None,
        area_slug: str,
    ) -> list[dict[str, Any]]:
        seen: set[str] = set()
        items: list[dict[str, Any]] = []
        subdistrict_label = (
            area_slug.replace("-jakarta-selatan", "").replace("-", " ").title()
            if area_slug.endswith("-jakarta-selatan")
            else None
        )
        for anchor in doc.xpath('//a[contains(@href, "/listings/")]'):
            href = anchor.get("href") or ""
            full_url = href if href.startswith("http") else f"{self.base_url}{href}"
            if full_url in seen:
                continue
            seen.add(full_url)
            slug = full_url.rstrip("/").rsplit("/", 1)[-1]

            tokens = [_clean(t) for t in anchor.itertext() if t.strip()]
            tokens = [t for t in tokens if t not in {",", "/ bulan"}]
            if len(tokens) < 2:
                continue

            blob = " | ".join(tokens)
            price_tok = next((t for t in tokens if "rp" in t.lower()), None)
            price = parse_price(price_tok)
            if max_price and price and price > max_price:
                continue

            jenis = _map_jenis(blob)
            filtered = [
                t
                for t in tokens
                if t.lower() not in {"cewek", "cowok", "campur", "putri", "putra"}
                and not t.lower().startswith("rp")
            ]
            building = filtered[0] if filtered else slug
            room_name = filtered[1] if len(filtered) > 1 and "menit ke" not in filtered[1].lower() else ""
            title = f"{building} - {room_name}" if room_name else building
            if area_slug.startswith("jakarta-") or "jakarta-selatan" in area_slug:
                other_cities = ("bekasi", "depok", "tangerang", "bogor", "bandung", "ciracas", "kramat jati")
                if any(c in title.lower() for c in other_cities):
                    continue
            kecamatan = next(
                (
                    t
                    for t in filtered[1:]
                    if len(t) <= 30
                    and "menit" not in t.lower()
                    and "jakarta" not in t.lower()
                    and t != room_name
                ),
                subdistrict_label,
            )
            raw_img = next(iter(anchor.xpath(".//img/@src | .//img/@data-src")), None)
            card_imgs = dedup_image_urls([raw_img])
            img = card_imgs[0] if card_imgs else None

            items.append({
                "source": self.name,
                "title": title,
                "nama_kost": building,
                "url": full_url,
                "slug": slug,
                "listing_price": price,
                "jenis": jenis,
                "kecamatan": kecamatan,
                "deskripsi": blob if subdistrict_label else None,
                "image_url": img,
            })
        return items

    def list_page(
        self,
        area: str = "jakarta-selatan",
        max_price: int | None = None,
        page: int = 1,
        sort: str = "price",
        order: str = "asc",
        html: str | None = None,
        keywords: list[str] | None = None,
    ) -> tuple[list[dict[str, Any]], bool, str]:
        if html is not None:
            url = self.build_list_url(area=area, page=page)
            doc = lxml.html.fromstring(html)
            items = self._parse_cards(doc, max_price=max_price, area_slug=area)
            has_next = bool(doc.xpath(f'//a[contains(@href, "/kost/{area}/{page + 1}")]'))
            return items, has_next, url

        target_areas = resolve_infokost_areas(area, keywords)
        # Rotate through targeted subdistricts across pages 1..N so each area gets scanned cleanly
        sub_idx = (page - 1) % len(target_areas)
        sub_page = ((page - 1) // len(target_areas)) + 1
        target_slug = target_areas[sub_idx]
        url = self.build_list_url(area=target_slug, page=sub_page)
        raw_html = self.client.get(url)
        doc = lxml.html.fromstring(raw_html)
        items = self._parse_cards(doc, max_price=max_price, area_slug=target_slug)
        sub_has_next = bool(doc.xpath(f'//a[contains(@href, "/kost/{target_slug}/{sub_page + 1}")]'))
        has_more_subs = sub_idx + 1 < len(target_areas)
        return items, (sub_has_next or has_more_subs), url

    def parse_detail(
        self,
        url: str,
        html: str | None = None,
        listing_hint: dict[str, Any] | None = None,
    ) -> KosListing:
        raw_html = html if html is not None else self.client.get(url)
        doc = lxml.html.fromstring(raw_html)
        hint = listing_hint or {}
        slug = hint.get("slug") or url.rstrip("/").rsplit("/", 1)[-1]

        h1 = doc.xpath("//h1")
        h1_text = _clean(h1[0].text_content()) if h1 else None
        title = hint.get("title") or h1_text or slug

        price_el = doc.xpath('//div[contains(@class, "text-2xl") and contains(., "Rp")]')
        price_raw = _clean(price_el[0].text_content()) if price_el else None
        price = parse_price(price_raw) or hint.get("listing_price")
        if price and price < 100_000:
            price = hint.get("listing_price")
        price_suspect = price is None or price < 100_000

        facilities: list[str] = []
        for heading in ("FASILITAS KAMAR", "FASILITAS & LAYANAN GEDUNG"):
            nodes = doc.xpath(f'//*[contains(text(), "{heading}")]/following-sibling::*[1]')
            if nodes:
                for tok in nodes[0].itertext():
                    t = _clean(tok)
                    if t and t not in facilities and len(t) <= 45:
                        facilities.append(t)

        rsc = extract_infokost_rsc_meta(raw_html)
        body_head = _clean(" ".join(doc.xpath("//body//text()")[:80]))
        jenis = hint.get("jenis") or _map_jenis(body_head)
        lat_match = re.search(r"lat=(-?\d+\.\d+)&(?:amp;)?lng=(-?\d+\.\d+)", raw_html)
        lat = float(lat_match.group(1)) if lat_match else rsc["lat"]
        lon = float(lat_match.group(2)) if lat_match else rsc["lon"]

        if rsc["unphotographed"]:
            image_urls: list[str] = []
        else:
            hero_imgs = doc.xpath('//a[contains(@href, "/media?media=photo")]//img/@src')
            raw_imgs = list(rsc["media_urls"]) + hero_imgs + [hint.get("image_url")]
            image_urls = dedup_image_urls(raw_imgs)
        img = image_urls[0] if image_urls else None
        all_prices = extract_all_prices(price_raw, min_monthly=100_000)

        return KosListing(
            source=self.name,
            url=url,
            slug=slug,
            title=title,
            nama_kost=hint.get("nama_kost") or title,
            price=price,
            price_text=format_idr(price) if price is not None else "Hubungi",
            price_options=all_prices or ([price] if price else []),
            price_suspect=price_suspect,
            price_source="infokost_dom" if price_raw else "listing_card",
            jenis=jenis,
            kecamatan=hint.get("kecamatan"),
            alamat=rsc["address"] or hint.get("kecamatan"),
            fasilitas=(", ".join(facilities)[:400] if facilities else None),
            fasilitas_list=facilities,
            image_url=img,
            image_urls=image_urls,
            lat=lat,
            lon=lon,
        )

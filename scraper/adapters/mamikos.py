"""Browser (/cari Vuex) + /room/* detail-JSON adapter for mamikos.com."""

from __future__ import annotations

import re
from typing import Any

import lxml.html

from ..models import KosListing, parse_price
from .base import SourceAdapter
from .mamikos_parser import (
    build_listing_from_detail,
    build_listing_from_fallback,
    clean_text as _clean,
    detect_jenis as _detect_jenis,
    extract_detail_json,
    fetch_mamikos_browser,
)

_AREA_ALIASES = {
    "jakarta-selatan": "jakarta-selatan",
    "jakarta-pusat": "jakarta-pusat",
    "jakarta-barat": "jakarta-barat",
    "jakarta-timur": "jakarta-timur",
    "jakarta-utara": "jakarta-utara",
    "depok": "depok",
    "tangerang-selatan": "tangerang-selatan",
    "bekasi": "bekasi",
    "bandung": "bandung",
    "yogyakarta": "jogja",
}

_MAMIKOS_JAKSEL_SUBS = {
    "mampang": "mampang-jakarta-selatan",
    "kemang": "mampang-jakarta-selatan",
    "cipete": "mampang-jakarta-selatan",
    "blok m": "putri-jakarta-selatan",
    "pasar minggu": "pasar-minggu-jakarta-selatan",
    "pejaten": "pasar-minggu-jakarta-selatan",
    "ampera": "pasar-minggu-jakarta-selatan",
    "tebet": "tebet-jakarta-selatan",
    "pancoran": "pancoran-jakarta-selatan",
    "kalibata": "pancoran-jakarta-selatan",
}


def resolve_mamikos_areas(area: str, keywords: list[str] | None) -> list[str]:
    targets = [_AREA_ALIASES.get(area, area)]
    if area == "jakarta-selatan" and keywords:
        for kw in keywords:
            low = kw.strip().lower()
            for needle, slug in _MAMIKOS_JAKSEL_SUBS.items():
                if needle in low and slug not in targets:
                    targets.append(slug)
    return targets


class MamikosAdapter(SourceAdapter):
    """Adapter for mamikos.com SSR area listings (/kost/kost-<area>-murah)."""

    name = "mamikos"
    base_url = "https://mamikos.com"

    def build_list_url(self, area: str = "jakarta-selatan", page: int = 1) -> str:
        mapped = _AREA_ALIASES.get(area, area)
        base = f"{self.base_url}/kost/kost-{mapped}-murah"
        return f"{base}?page={page}" if page > 1 else base

    def _parse_cards(self, doc: lxml.html.HtmlElement, max_price: int | None) -> list[dict[str, Any]]:
        seen: set[str] = set()
        items: list[dict[str, Any]] = []
        for anchor in doc.xpath('//a[contains(@href, "/room/")]'):
            href = anchor.get("href") or ""
            full_url = href if href.startswith("http") else f"{self.base_url}{href}"
            if full_url in seen:
                continue
            seen.add(full_url)
            slug = full_url.rstrip("/").rsplit("/", 1)[-1]

            tokens = [_clean(t) for t in anchor.itertext() if t.strip()]
            tokens = [t for t in tokens if t not in {"·", "star-glyph", "featured"}]
            if len(tokens) < 3:
                continue

            price_tok = next((t for t in tokens if "rp" in t.lower()), None)
            price = parse_price(price_tok)
            if max_price and price and price > max_price:
                continue

            jenis = _detect_jenis(tokens)
            skip_set = {"putri", "putra", "campur", "/bulan", "/hari", "/minggu"}
            content_tokens = [
                t
                for t in tokens
                if t.lower() not in skip_set
                and not t.lower().startswith("sisa ")
                and not t.lower().startswith("rp")
                and not re.fullmatch(r"\d+(?:\.\d+)?", t)
            ]
            if not content_tokens:
                continue

            title = content_tokens[0]
            kecamatan = content_tokens[1] if len(content_tokens) > 1 else None
            facilities = [t for t in content_tokens[2:] if len(t) <= 35]
            img = next(iter(anchor.xpath(".//img/@src | .//img/@data-src")), None)

            items.append({
                "source": self.name,
                "title": title,
                "url": full_url,
                "slug": slug,
                "listing_price": price,
                "jenis": jenis,
                "kecamatan": kecamatan,
                "fasilitas_list": facilities,
                "image_url": img,
                "is_featured": "featured" in " ".join(anchor.itertext()).lower(),
            })
        return items

    use_browser: bool = True

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
            return self._parse_cards(doc, max_price=max_price), False, url

        if getattr(self, "use_browser", True):
            cache: dict[tuple[Any, ...], list[dict[str, Any]]] = getattr(self, "_browser_cache", {})
            if not hasattr(self, "_browser_cache"):
                self._browser_cache = cache
            cache_key = (area, max_price, tuple(keywords or ()), sort, order)
            if cache_key not in cache:
                browser_items = fetch_mamikos_browser(self.name, area, max_price, sort, order, keywords)
                if browser_items:
                    cache[cache_key] = browser_items
            if cache_key in cache and cache[cache_key]:
                all_items = cache[cache_key]
                start = max(0, page - 1) * 20
                end = start + 20
                return (
                    all_items[start:end],
                    len(all_items) > end,
                    f"{self.base_url}/cari?area={area}&page={page}",
                )

        targets = resolve_mamikos_areas(area, keywords)
        if page > len(targets):
            return [], False, self.build_list_url(area=area, page=page)

        url = self.build_list_url(area=targets[page - 1], page=1)
        raw_html = self.client.get(url)
        doc = lxml.html.fromstring(raw_html)
        return self._parse_cards(doc, max_price=max_price), page < len(targets), url

    def parse_detail(
        self,
        url: str,
        html: str | None = None,
        listing_hint: dict[str, Any] | None = None,
    ) -> KosListing:
        hint = dict(listing_hint or {})
        slug = hint.get("slug") or url.rstrip("/").rsplit("/", 1)[-1]

        raw_html: str | None = html
        if raw_html is None:
            try:
                raw_html = self.client.get(url)
            except Exception:
                if not hint.get("title"):
                    raise

        detail = extract_detail_json(raw_html) if raw_html else None
        if detail:
            return build_listing_from_detail(self.name, url, slug, detail, hint)
        return build_listing_from_fallback(self.name, url, slug, raw_html, hint)

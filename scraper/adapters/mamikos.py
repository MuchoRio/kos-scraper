"""SSR + card-enriched adapter for mamikos.com area landing pages."""

from __future__ import annotations

import html as html_lib
import re
from typing import Any

import lxml.html

from ..models import KosListing, dedup_image_urls, format_idr, parse_price
from .base import SourceAdapter

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
    "pasar minggu": "pasar-minggu-jakarta-selatan",
    "pejaten": "pasar-minggu-jakarta-selatan",
    "ampera": "pasar-minggu-jakarta-selatan",
    "tebet": "tebet-jakarta-selatan",
    "pancoran": "pancoran-jakarta-selatan",
    "kalibata": "pancoran-jakarta-selatan",
    "jagakarsa": "jagakarsa-jakarta-selatan",
}


def _clean(raw: str) -> str:
    return re.sub(r"\s+", " ", html_lib.unescape(raw)).strip()


def _detect_jenis(tokens: list[str]) -> str | None:
    for tok in tokens:
        low = tok.lower()
        if low in {"putri", "putra", "campur"}:
            return f"Kost {tok.capitalize()}"
    return None


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

        raw_imgs: list[Any] = [hint.get("image_url")]
        if html is not None or not hint.get("title"):
            raw_html = html if html is not None else self.client.get(url)
            doc = lxml.html.fromstring(raw_html)
            h1 = doc.xpath("//h1")
            if h1 and _clean(h1[0].text_content()):
                hint.setdefault("title", _clean(h1[0].text_content()))
            raw_imgs.extend(
                doc.xpath('//meta[@property="og:image"]/@content | //img[contains(@src, "mamikos")]/@src')
            )

        title = hint.get("title") or slug.replace("-", " ").title()
        price = hint.get("listing_price")
        facilities = list(hint.get("fasilitas_list") or [])
        kecamatan = hint.get("kecamatan")
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
            price_source="mamikos_ssr_card" if price else "unavailable",
            jenis=hint.get("jenis"),
            kecamatan=kecamatan,
            alamat=f"{kecamatan}, Area Listing Mamikos" if kecamatan else None,
            fasilitas=(", ".join(facilities)[:400] if facilities else None),
            fasilitas_list=facilities,
            image_url=image_url,
            image_urls=image_urls,
            is_featured=bool(hint.get("is_featured", False)),
        )

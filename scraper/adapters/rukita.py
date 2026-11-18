"""Adapter for rukita.co SSR listings and LodgingBusiness JSON-LD details."""

from __future__ import annotations

import html as html_lib
import json
import re
from typing import Any

import lxml.html

from ..models import KosListing, dedup_image_urls, extract_all_prices, format_idr, parse_price
from .base import SourceAdapter

_PLACE_RE = re.compile(r"^/place/([a-z0-9-]+)")


def _clean_text(raw: str) -> str:
    return re.sub(r"\s+", " ", html_lib.unescape(raw)).strip()


def _detect_jenis(text: str) -> str | None:
    m = re.search(r"\b(Putri|Putra|Campur)\b", text, re.I)
    return f"Kost {m.group(1).capitalize()}" if m else None


class RukitaAdapter(SourceAdapter):
    """Adapter for rukita.co using SSR links and Schema.org JSON-LD."""

    name = "rukita"
    base_url = "https://www.rukita.co"

    def build_list_url(
        self,
        area: str = "jakarta-selatan",
        page: int = 1,
        sort: str = "price",
        order: str = "asc",
    ) -> str:
        url = f"{self.base_url}/kost/{area}"
        params: list[str] = []
        if page > 1:
            params.append(f"page={page}")
        if sort == "price" and order == "asc":
            params.append("sort=lowest_price")
        return f"{url}?{'&'.join(params)}" if params else url

    def list_page(
        self,
        area: str = "jakarta-selatan",
        max_price: int | None = None,
        page: int = 1,
        sort: str = "price",
        order: str = "asc",
        html: str | None = None,
    ) -> tuple[list[dict[str, Any]], bool, str]:
        url = self.build_list_url(area=area, page=page, sort=sort, order=order)
        raw_html = html if html is not None else self.client.get(url)
        doc = lxml.html.fromstring(raw_html)

        seen: set[str] = set()
        items: list[dict[str, Any]] = []
        for anchor in doc.xpath('//a[contains(@href, "/place/")]'):
            href = anchor.get("href") or ""
            m_slug = _PLACE_RE.search(href)
            if not m_slug:
                continue
            slug = m_slug.group(1)
            full_url = f"{self.base_url}/place/{slug}"
            if full_url in seen:
                continue
            seen.add(full_url)

            texts = [_clean_text(t) for t in anchor.itertext() if t.strip()]
            if not texts:
                continue
            blob = " | ".join(texts)
            prices = extract_all_prices(blob, min_monthly=100_000)
            min_p = min(prices) if prices else None
            if max_price and min_p and min_p > max_price:
                continue

            title = next((t for t in texts if len(t) >= 4 and not t.startswith("Rp")), slug)
            img = next(iter(anchor.xpath(".//img/@src | .//img/@data-src")), None)
            items.append({
                "source": self.name,
                "title": title,
                "url": full_url,
                "slug": slug,
                "listing_price": min_p,
                "price_options": prices,
                "jenis": _detect_jenis(blob),
                "image_url": img,
            })

        has_next = bool(doc.xpath(f'//a[contains(@href, "page={page + 1}")]'))
        return items, has_next, url

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

        ld = self._extract_lodging_json_ld(doc)
        h1 = doc.xpath("//h1")
        title = ld.get("name") or (_clean_text(h1[0].text_content()) if h1 else hint.get("title"))

        addr_obj = ld.get("address") if isinstance(ld.get("address"), dict) else {}
        alamat = _clean_text(str(addr_obj.get("streetAddress") or "")) or None
        kota = addr_obj.get("addressLocality")
        kecamatan, kelurahan = self._split_kecamatan_kelurahan(alamat, kota)

        geo = ld.get("geo") if isinstance(ld.get("geo"), dict) else {}
        lat = self._to_float(geo.get("latitude"))
        lon = self._to_float(geo.get("longitude"))

        price_range_str = str(ld.get("priceRange") or "")
        prices = extract_all_prices(price_range_str, min_monthly=100_000)
        if not prices and hint.get("price_options"):
            prices = list(hint["price_options"])
        resolved_price = min(prices) if prices else (hint.get("listing_price") or parse_price(price_range_str))
        price_suspect = resolved_price is None or resolved_price < 100_000

        fasilitas_list = self._extract_facilities(doc)
        peraturan = self._extract_rules(doc)
        page_head_text = _clean_text(" ".join(doc.xpath("//body//text()")[:120]))
        jenis = hint.get("jenis") or _detect_jenis(page_head_text) or _detect_jenis(str(ld.get("description") or ""))

        image_raw = ld.get("image")
        raw_imgs: list[Any] = []
        if isinstance(image_raw, list):
            raw_imgs.extend(image_raw)
        elif isinstance(image_raw, str):
            raw_imgs.append(image_raw)
        raw_imgs.append(hint.get("image_url"))
        image_urls = dedup_image_urls(raw_imgs)
        image_url = image_urls[0] if image_urls else None

        return KosListing(
            source=self.name,
            url=url,
            slug=slug,
            title=title,
            nama_kost=title,
            price=resolved_price,
            price_text=format_idr(resolved_price) if resolved_price is not None else (price_range_str or None),
            price_options=sorted(set(prices))[:8],
            price_suspect=price_suspect,
            price_source="json_ld" if ld.get("priceRange") else "listing_card",
            jenis=jenis,
            kecamatan=kecamatan,
            kelurahan=kelurahan,
            alamat=alamat,
            deskripsi=_clean_text(str(ld.get("description") or ""))[:600] or None,
            fasilitas=(", ".join(fasilitas_list)[:400] if fasilitas_list else None),
            fasilitas_list=fasilitas_list,
            peraturan=peraturan,
            image_url=image_url,
            image_urls=image_urls,
            lat=lat,
            lon=lon,
        )

    @staticmethod
    def _extract_rules(doc: lxml.html.HtmlElement) -> list[str]:
        rules: list[str] = []
        body_text = _clean_text(" ".join(doc.xpath("//body//text()[not(ancestor::script)]")))
        for pat in (
            r"Pasutri\s+(?:Diperbolehkan|Tidak\s+Diperbolehkan)",
            r"Tamu\s+(?:Lawan\s+Jenis\s+)?Dilarang\s+(?:Masuk\s+Kamar|Menginap)",
            r"Boleh\s+Bawa\s+Hewan|Tidak\s+Boleh\s+Bawa\s+Hewan",
            r"Akses\s+24\s+Jam",
        ):
            for m in re.finditer(pat, body_text, re.I):
                val = _clean_text(m.group(0))
                if val not in rules:
                    rules.append(val)
        return rules

    @staticmethod
    def _extract_lodging_json_ld(doc: lxml.html.HtmlElement) -> dict[str, Any]:
        scripts = doc.xpath('//script[@id="structured-data-lodging-business"]/text()')
        if not scripts:
            scripts = doc.xpath('//script[@type="application/ld+json"]/text()')
        for raw in scripts:
            try:
                data = json.loads(raw)
                if isinstance(data, dict) and data.get("@type") == "LodgingBusiness":
                    return data
            except json.JSONDecodeError:
                continue
        return {}

    @staticmethod
    def _extract_facilities(doc: lxml.html.HtmlElement) -> list[str]:
        found: list[str] = []
        for heading in doc.xpath("//h2 | //h3"):
            title = _clean_text(heading.text_content())
            if "fasilitas" not in title.lower() or "sekitar" in title.lower():
                continue
            parent = heading.getparent()
            if parent is None:
                continue
            for txt in parent.itertext():
                item = _clean_text(txt)
                if (
                    not item
                    or item == title
                    or item.lower() in {"lihat selengkapnya", "tampilkan lebih sedikit"}
                    or len(item) > 45
                ):
                    continue
                if item not in found:
                    found.append(item)
        return found

    @staticmethod
    def _split_kecamatan_kelurahan(alamat: str | None, fallback_city: str | None) -> tuple[str | None, str | None]:
        if not alamat:
            return fallback_city, None
        m_kec = re.search(r"Kec\.?\s*([^,]+)", alamat, re.I)
        kecamatan = m_kec.group(1).strip() if m_kec else fallback_city
        parts = [p.strip() for p in alamat.split(",") if p.strip()]
        kelurahan = parts[1] if len(parts) >= 3 and "rt" not in parts[1].lower() else None
        return kecamatan, kelurahan

    @staticmethod
    def _to_float(val: Any) -> float | None:
        try:
            return float(val) if val is not None else None
        except (TypeError, ValueError):
            return None


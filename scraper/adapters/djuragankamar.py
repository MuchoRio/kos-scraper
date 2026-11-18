"""SSR lxml adapter for djuragankamar.com listings (/pencarian & /penginapan/*)."""

from __future__ import annotations

import html as html_lib
import re
from typing import Any

import lxml.html

from ..models import KosListing, dedup_image_urls, format_idr, parse_price
from .base import SourceAdapter

_CITY_IDS = {
    "jakarta-selatan": "156",
    "jakarta-barat": "159",
    "yogyakarta": "227",
    "surabaya": "264",
    "semarang": "220",
    "malang": "259",
    "solo": "218",
    "palembang": "112",
    "banjarmasin": "354",
}

_SECTION_FACILITIES = ("Fasilitas Umum", "Fasilitas Kamar", "Fasilitas Parkir", "Kamar Mandi")


def _clean(raw: str) -> str:
    return re.sub(r"\s+", " ", html_lib.unescape(raw)).strip()


def _extract_map_coords(raw_html: str) -> list[tuple[float | None, float | None]]:
    coords: list[tuple[float | None, float | None]] = []
    for m in re.finditer(
        r"locationsMap\.push\(\{\s*lat:\s*([^,}]+?),\s*lng:\s*([^}]+?)\}\)",
        raw_html,
        re.S,
    ):
        try:
            lat = float(m.group(1).strip())
            lng = float(m.group(2).strip())
            valid = -11.0 <= lat <= -1.0 and 95.0 <= lng <= 141.0
            coords.append((lat, lng) if valid else (None, None))
        except ValueError:
            coords.append((None, None))
    return coords


def _valid_images(urls: list[Any]) -> list[str]:
    cleaned = [
        str(u)
        for u in urls
        if isinstance(u, str)
        and "load-image.webp" not in u.lower()
        and "person-circle" not in u.lower()
        and "/img/logo" not in u.lower()
    ]
    return dedup_image_urls(cleaned)


class DjuraganKamarAdapter(SourceAdapter):
    """Adapter for djuragankamar.com SSR search and property detail pages."""

    name = "djuragankamar"
    base_url = "https://djuragankamar.com"

    def build_list_url(self, area: str = "jakarta-selatan", page: int = 1) -> str | None:
        city_id = _CITY_IDS.get(area)
        if not city_id:
            return None
        base = f"{self.base_url}/pencarian?city_id={city_id}"
        return f"{base}&page={page}" if page > 1 else base

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
        if not url and html is None:
            return [], False, f"{self.base_url}/pencarian"
        resolved_url = url or f"{self.base_url}/pencarian"
        raw_html = html if html is not None else self.client.get(resolved_url)
        doc = lxml.html.fromstring(raw_html)
        coords = _extract_map_coords(raw_html)

        seen: set[str] = set()
        items: list[dict[str, Any]] = []
        cards = doc.xpath('//div[contains(@class, "card")][.//a[contains(@href, "/penginapan/")]]')
        for idx, card in enumerate(cards):
            href = next(iter(card.xpath('.//a[contains(@href, "/penginapan/")]/@href')), "")
            full_url = href if href.startswith("http") else f"{self.base_url}{href}"
            if not href or full_url in seen:
                continue
            seen.add(full_url)

            slug = full_url.rstrip("/").rsplit("/", 1)[-1]
            titles = [_clean(t) for t in card.xpath(".//h3//text() | .//h4//text() | .//h5//text()")]
            title = next((t for t in titles if len(t) >= 3 and "lihat penginapan" not in t.lower()), slug)
            card_txt = _clean(card.text_content())

            # Only trust monthly list price on cards to prevent daily rates (~Rp250rb) posing as monthly rent
            m_bul = re.search(r"Rp\s*[\d.,]+(?=\s*/\s*Bulan)", card_txt, re.I)
            monthly = parse_price(m_bul.group(0)) if m_bul else None
            if max_price and monthly and monthly > max_price:
                continue

            imgs = _valid_images(card.xpath(".//img/@data-src | .//img/@src"))
            lat, lon = coords[idx] if idx < len(coords) else (None, None)
            addr_p = next((_clean(p.text_content()) for p in card.xpath(".//p") if _clean(p.text_content()) and "☆" not in p.text_content()), None)
            m_kec = re.search(r"(?:Kec\.?\s*)([A-Za-z.\s]{3,30})(?:,|Jakarta|$)", card_txt, re.I)
            kec = _clean(m_kec.group(1)) if m_kec else None
            if not kec:
                m_area = re.search(r"\b(Senopati|Cipete|Kemang|Cilandak|Tebet|Mampang Prapatan|Kebayoran Baru|Kby\. Baru)\b", card_txt, re.I)
                kec = m_area.group(1) if m_area else None
            items.append({
                "source": self.name,
                "title": title,
                "url": full_url,
                "slug": slug,
                "listing_price": monthly,
                "alamat": addr_p,
                "kecamatan": kec,
                "image_url": imgs[0] if imgs else None,
                "lat": lat,
                "lon": lon,
            })

        city_id = _CITY_IDS.get(area, "")
        has_next = bool(city_id and doc.xpath(f'//a[contains(@href, "page={page + 1}")]'))
        return items, has_next, resolved_url

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

        titles = [_clean(x.text_content()) for x in doc.xpath("//h1 | //h2")]
        title = next((t for t in titles if t and t.lower() not in {"djuragan kamar", "tambahkan ulasan", "masuk sebagai", "kebijakan umun"}), hint.get("title") or slug)

        # Extract monthly rate specifically from table cells paired with 'Bulan'
        monthly_prices: list[int] = []
        for tr in doc.xpath("//tr"):
            row_txt = _clean(" ".join(tr.itertext()))
            if re.search(r"\bBulan\b", row_txt, re.I):
                val = parse_price(row_txt)
                if val and val >= 100_000:
                    monthly_prices.append(val)
        price = min(monthly_prices) if monthly_prices else hint.get("listing_price")

        facilities: list[str] = []
        for sec in _SECTION_FACILITIES:
            nodes = doc.xpath(f'//*[normalize-space(text())="{sec}"]/following-sibling::*[1]')
            if nodes:
                for tok in nodes[0].itertext():
                    txt = _clean(tok)
                    if txt and txt not in facilities and len(txt) <= 45:
                        facilities.append(txt)

        peraturan: list[str] = []
        rule_nodes = doc.xpath('//*[contains(text(), "Tata Tertib")]/following-sibling::*[1]')
        if rule_nodes:
            for tok in rule_nodes[0].itertext():
                txt = _clean(tok)
                if txt and txt not in peraturan and len(txt) <= 80:
                    peraturan.append(txt)

        body_txt = _clean(" ".join(doc.xpath("//body//text()[not(ancestor::script)]")))
        m_addr = re.search(r"(?:Jl\.|Jalan)\s+[^.\n]{8,140}?(?:\d{5}|Selatan|Barat|Timur|Pusat|Utara|Yogyakarta)", body_txt)
        alamat = (_clean(m_addr.group(0)) if m_addr else None) or hint.get("alamat")

        m_desc = re.search(r"Deskripsi\s+(.{10,450}?)(?:\s+Peta\b|\s+Ulasan\b)", body_txt)
        deskripsi = _clean(m_desc.group(1)) if m_desc else None

        image_urls = _valid_images(doc.xpath("//img/@data-src | //img/@src | //meta[@property='og:image']/@content") + [hint.get("image_url")])

        return KosListing(
            source=self.name,
            url=url,
            slug=slug,
            title=title,
            nama_kost=title,
            price=price,
            price_text=format_idr(price) if price is not None else "Hubungi",
            price_options=sorted(set(monthly_prices)) or ([price] if price else []),
            price_suspect=price is None or price < 100_000,
            price_source="djuragan_monthly_table" if monthly_prices else ("listing_card" if price else "unavailable"),
            kecamatan=hint.get("kecamatan"),
            alamat=alamat,
            deskripsi=deskripsi,
            fasilitas=(", ".join(facilities)[:400] if facilities else None),
            fasilitas_list=facilities,
            peraturan=peraturan,
            image_url=image_urls[0] if image_urls else None,
            image_urls=image_urls,
            lat=hint.get("lat"),
            lon=hint.get("lon"),
        )

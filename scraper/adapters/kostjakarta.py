"""SSR WordPress adapter for kostjakarta.com listings with owner contacts."""

from __future__ import annotations

import html as html_lib
import re
from typing import Any

import lxml.html

from ..models import KosListing, dedup_image_urls, extract_room_rent_prices, format_idr, normalize_wa_link
from .base import SourceAdapter

_AREA_CATEGORIES = {
    "jakarta-selatan": "/category/kost-jakarta-selatan/",
    "jakarta-pusat": "/category/kost-jakarta-pusat/",
    "jakarta-barat": "/category/kost-jakarta-barat/",
    "jakarta-timur": "/category/kost-jakarta-timur/",
    "jakarta-utara": "/category/kost-jakarta-utara/",
    "depok": "/category/kost-depok/",
    "tangerang-selatan": "/category/kost-tangerang/",
    "bekasi": "/category/kost-bekasi/",
    "bandung": "/category/kost-bandung/",
}


def _clean(raw: str) -> str:
    return re.sub(r"\s+", " ", html_lib.unescape(raw)).strip()


def _detect_jenis(text: str) -> str | None:
    low = text.lower()
    if "pasutri" in low or ("pria" in low and "wanita" in low) or "campur" in low:
        return "Kost Campur"
    if "wanita" in low or "putri" in low:
        return "Kost Putri"
    if "pria" in low or "putra" in low:
        return "Kost Putra"
    return None


def _extract_labeled_field(text: str, label: str, next_labels: list[str]) -> str | None:
    stop = "|".join(re.escape(lb) for lb in next_labels)
    m = re.search(rf"{re.escape(label)}\s*:\s*(.+?)(?=(?:{stop})\s*:|$)", text, re.I | re.S)
    return _clean(m.group(1)) if m else None


class KostJakartaAdapter(SourceAdapter):
    """Adapter for kostjakarta.com WordPress listings in Jabodetabek and Bandung."""

    name = "kostjakarta"
    base_url = "https://www.kostjakarta.com"

    def build_list_url(self, area: str = "jakarta-selatan", page: int = 1) -> str | None:
        cat = _AREA_CATEGORIES.get(area)
        if not cat:
            return None
        base = f"{self.base_url}{cat}"
        return f"{base}page/{page}/" if page > 1 else base

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
            return [], False, self.base_url
        resolved_url = url or self.base_url
        raw_html = html if html is not None else self.client.get(resolved_url)
        doc = lxml.html.fromstring(raw_html)

        seen: set[str] = set()
        items: list[dict[str, Any]] = []
        for art in doc.xpath("//article"):
            href = next(
                iter(art.xpath('.//h2//a/@href | .//h3//a/@href | .//a[contains(@href, "kostjakarta.com/")]/@href')),
                "",
            )
            if not href or href in seen or "/category/" in href:
                continue
            seen.add(href)

            slug = href.rstrip("/").rsplit("/", 1)[-1]
            titles = [_clean(t) for t in art.xpath(".//h2//text() | .//h3//text()")]
            title = next((t for t in titles if len(t) >= 4), slug.replace("-", " ").title())
            txt = _clean(art.text_content())
            prices = extract_room_rent_prices(txt, min_monthly=300_000)
            price = min(prices) if prices else None
            if max_price and price and price > max_price:
                continue

            imgs = dedup_image_urls(art.xpath(".//img/@data-src | .//img/@src"))
            items.append({
                "source": self.name,
                "title": title,
                "url": href,
                "slug": slug,
                "listing_price": price,
                "price_options": prices,
                "jenis": _detect_jenis(txt),
                "image_url": imgs[0] if imgs else None,
            })

        has_next = bool(doc.xpath(f'//a[contains(@href, "/page/{page + 1}")]'))
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

        h1 = doc.xpath("//h1")
        title = _clean(h1[0].text_content()) if h1 else (hint.get("title") or slug)

        content_nodes = doc.xpath('//div[contains(@class, "entry-content")] | //article')
        content_el = content_nodes[0] if content_nodes else doc
        raw_lines = [_clean(t) for t in content_el.xpath(".//text()[not(ancestor::script)]") if _clean(t)]
        blob = "\n".join(raw_lines)

        labels = [
            "Nama Rumah Kost", "Alamat Kost", "Nomor Telepon", "WhatsApp", "Harga Sewa",
            "Tempat Kost Untuk", "Mayoritas Penghuni", "Ukuran Kamar", "Jumlah Kamar",
            "Sekamar Boleh Berdua", "Biaya Tambahan Sekamar Berdua", "Fasilitas",
            "Parkir", "Akses Lokasi", "Keterangan", "Info Tambahan",
        ]
        alamat = _extract_labeled_field(blob, "Alamat Kost", labels)
        nama_kost = _extract_labeled_field(blob, "Nama Rumah Kost", labels) or title
        harga_raw = _extract_labeled_field(blob, "Harga Sewa", labels) or ""
        # Use raw_lines inside Harga Sewa block (preserving line boundaries) so fees/deposits drop cleanly
        harga_block = "\n".join(
            ln
            for ln in blob.splitlines()
            if "harga" in ln.lower() or "rp" in ln.lower() or "rb" in ln.lower() or "ribu" in ln.lower() or "juta" in ln.lower()
        )
        prices = extract_room_rent_prices(harga_raw, min_monthly=300_000) or extract_room_rent_prices(
            harga_block, min_monthly=300_000
        )
        price = min(prices) if prices else hint.get("listing_price")

        kec = None
        if alamat:
            m_kec = re.search(r"Kec\.?\s*([A-Za-z.\s]{3,30})", alamat, re.I)
            if m_kec:
                kec = _clean(m_kec.group(1))
            else:
                m_known = re.search(
                    r"\b(Kebayoran Baru|Kebayoran Lama|Mampang Prapatan|Pancoran|Tebet|Setiabudi|Pasar Minggu|Jagakarsa|Cilandak|Pesanggrahan|Menteng|Tanah Abang|Kemang|Cipete|Kelapa Gading|Depok|Bekasi)\b",
                    alamat,
                    re.I,
                )
                kec = _clean(m_known.group(1)) if m_known else None

        fac_str = _extract_labeled_field(blob, "Fasilitas", labels) or ""
        park_str = _extract_labeled_field(blob, "Parkir", labels) or ""
        facilities = [
            x.strip()
            for x in re.split(r"[,•\n]+", f"{fac_str}, {park_str}")
            if 2 <= len(x.strip()) <= 45 and not re.match(r"^(?:di |dan |untuk |atau |baik )", x.strip(), re.I)
        ]

        peraturan: list[str] = []
        untuk = _extract_labeled_field(blob, "Tempat Kost Untuk", labels)
        berdua = _extract_labeled_field(blob, "Sekamar Boleh Berdua", labels)
        penghuni = _extract_labeled_field(blob, "Mayoritas Penghuni", labels)
        if berdua:
            peraturan.append(f"Sekamar Berdua: {berdua}")
        if penghuni:
            peraturan.append(f"Mayoritas: {penghuni}")

        wa_hrefs = re.findall(r"(?:api\.whatsapp\.com/send\?phone=|wa\.me/)(\+?[\d]+)", raw_html)
        wa_field = _extract_labeled_field(blob, "WhatsApp", labels) or _extract_labeled_field(blob, "Nomor Telepon", labels)
        raw_phone = (wa_hrefs[0] if wa_hrefs else None) or (re.search(r"(?:\+?62|0)8[\d-]{7,13}", wa_field or "") or [None])[0]
        wa_link = normalize_wa_link(raw_phone)
        wa = re.sub(r"\D", "", raw_phone) if raw_phone else None

        raw_imgs = [
            u
            for u in content_el.xpath(".//img/@data-src | .//img/@src") + doc.xpath('//meta[@property="og:image"]/@content') + [hint.get("image_url")]
            if isinstance(u, str) and "logo" not in u.lower() and "gravatar" not in u.lower()
        ]
        image_urls = dedup_image_urls(raw_imgs)
        desc = _extract_labeled_field(blob, "Keterangan", labels) or _extract_labeled_field(blob, "Akses Lokasi", labels) or " ".join(raw_lines)[:500]

        return KosListing(
            source=self.name,
            url=url,
            slug=slug,
            title=title,
            nama_kost=nama_kost,
            price=price,
            price_text=format_idr(price) if price is not None else "Hubungi",
            price_options=sorted(set(prices))[:8],
            price_suspect=price is None or price < 100_000,
            price_source="kostjakarta_field" if harga_raw and price else ("listing_card" if price else "unavailable"),
            jenis=_detect_jenis(untuk or blob) or hint.get("jenis"),
            kecamatan=kec,
            alamat=alamat,
            deskripsi=(desc[:600] if desc else None),
            fasilitas=(", ".join(facilities)[:400] if facilities else None),
            fasilitas_list=facilities,
            peraturan=peraturan,
            image_url=image_urls[0] if image_urls else None,
            image_urls=image_urls,
            wa=wa,
            wa_link=wa_link,
            kontak=[wa] if wa else [],
        )


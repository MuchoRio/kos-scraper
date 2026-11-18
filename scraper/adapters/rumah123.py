"""SSR + Schema.org JSON-LD adapter for rumah123.com/kost listings."""

from __future__ import annotations

import html as html_lib
import json
import re
from typing import Any

import lxml.html

from ..models import KosListing, dedup_image_urls, extract_room_rent_prices, format_idr, normalize_wa_link, parse_price
from .base import SourceAdapter

_AREA_PATHS = {
    "jakarta-selatan": "/kost/di-jakarta-selatan/",
    "jakarta-pusat": "/kost/di-jakarta-pusat/",
    "jakarta-barat": "/kost/di-jakarta-barat/",
    "jakarta-timur": "/kost/di-jakarta-timur/",
    "jakarta-utara": "/kost/di-jakarta-utara/",
    "depok": "/kost/di-depok/",
    "tangerang-selatan": "/kost/di-tangerang-selatan/",
    "bekasi": "/kost/di-bekasi/",
    "bandung": "/kost/di-bandung/",
    "yogyakarta": "/kost/di-yogyakarta/",
}


def _clean(raw: str) -> str:
    return re.sub(r"\s+", " ", html_lib.unescape(raw)).strip()


def _detect_jenis(text: str) -> str | None:
    if re.search(r"campur", text, re.I):
        return "Kost Campur"
    if re.search(r"\bputri\b", text, re.I):
        return "Kost Putri"
    if re.search(r"\bputra\b", text, re.I):
        return "Kost Putra"
    return None


def _valid_images(raw_imgs: list[Any]) -> list[str]:
    filtered = [
        str(u).rstrip("\\")
        for u in raw_imgs
        if isinstance(u, str)
        and "placeholder" not in u.lower()
        and "ldp-map" not in u.lower()
        and "/portal-api/image/og/" not in u.lower()
        and "photo/" not in u.lower()
    ]
    return dedup_image_urls(filtered)


class Rumah123Adapter(SourceAdapter):
    """Adapter for rumah123.com kos pages using SSR cards + JSON-LD detail graphs."""

    name = "rumah123"
    base_url = "https://www.rumah123.com"

    def build_list_url(
        self,
        area: str = "jakarta-selatan",
        max_price: int | None = None,
        page: int = 1,
        sort: str = "price",
        order: str = "asc",
    ) -> str:
        path = _AREA_PATHS.get(area, f"/kost/di-{area}/")
        params: list[str] = []
        if max_price:
            params.append(f"maxPrice={max_price}")
        if (sort == "price" and order == "asc") or max_price:
            params.append("sort=price-asc")
        if page > 1:
            params.append(f"page={page}")
        return f"{self.base_url}{path}?{'&'.join(params)}" if params else f"{self.base_url}{path}"

    def list_page(
        self,
        area: str = "jakarta-selatan",
        max_price: int | None = None,
        page: int = 1,
        sort: str = "price",
        order: str = "asc",
        html: str | None = None,
    ) -> tuple[list[dict[str, Any]], bool, str]:
        url = self.build_list_url(area=area, max_price=max_price, page=page, sort=sort, order=order)
        raw_html = html if html is not None else self.client.get(url)
        doc = lxml.html.fromstring(raw_html)

        seen: set[str] = set()
        items: list[dict[str, Any]] = []
        for anchor in doc.xpath('//a[contains(@href, "/properti/") and contains(@href, "ksr")]'):
            href = anchor.get("href") or ""
            full_url = href if href.startswith("http") else f"{self.base_url}{href}"
            if full_url in seen:
                continue
            seen.add(full_url)

            container = anchor
            for _ in range(4):
                parent = container.getparent()
                if parent is None:
                    break
                container = parent
                if "Rp" in (container.text_content() or ""):
                    break

            card_txt = _clean(" ".join(container.xpath(".//text()[not(ancestor::script)]")))
            prices = extract_room_rent_prices(card_txt, min_monthly=100_000)
            price = min(prices) if prices else None
            if max_price and price and price > max_price:
                continue

            slug = full_url.rstrip("/").rsplit("/", 1)[-1]
            title_cand = _clean(anchor.text_content()) or slug.replace("-", " ").title()
            m_area = re.search(r"/properti/([^/]+)/", full_url)
            kec = None
            if m_area:
                area_part = m_area.group(1).replace("-", " ").title()
                kec = re.sub(r"^(?:Jakarta\s+(?:Selatan|Pusat|Barat|Timur|Utara)\s+|Tangerang\s+Selatan\s+)", "", area_part, flags=re.I).strip()
            imgs = _valid_images(container.xpath(".//img/@src | .//img/@data-src"))

            items.append({
                "source": self.name,
                "title": title_cand,
                "url": full_url,
                "slug": slug,
                "listing_price": price,
                "price_options": prices,
                "jenis": _detect_jenis(card_txt),
                "kecamatan": kec,
                "image_url": imgs[0] if imgs else None,
            })

        has_next = bool(doc.xpath(f'//a[contains(@href, "page={page + 1}")]'))
        return items, has_next, url

    def _walk_ld(self, obj: Any, acc: dict[str, Any]) -> None:
        if isinstance(obj, list):
            for el in obj:
                self._walk_ld(el, acc)
        elif isinstance(obj, dict):
            t = str(obj.get("@type") or "")
            if "Organization" in t or "BreadcrumbList" in t:
                return
            if "RealEstateAgent" in t and obj.get("name"):
                acc["agent"] = obj
            for k in ("geo", "address", "offers", "image", "description", "name"):
                if k not in acc and obj.get(k) not in (None, "", []):
                    if k == "geo" and isinstance(obj[k], dict) and obj[k].get("latitude"):
                        acc["geo"] = obj[k]
                    elif k == "address" and isinstance(obj[k], dict) and obj[k].get("addressLocality"):
                        acc["address"] = obj[k]
                    elif k == "offers" and isinstance(obj[k], dict) and obj[k].get("priceSpecification"):
                        acc["offers"] = obj[k]
                    elif k == "image" and isinstance(obj[k], list):
                        acc["image"] = obj[k]
                    elif k == "description" and "RealEstateListing" in t:
                        acc["description"] = obj[k]
                    elif k == "name" and "RealEstateListing" in t:
                        acc["name"] = obj[k]
            for v in obj.values():
                if isinstance(v, (dict, list)):
                    self._walk_ld(v, acc)

    def _extract_ld_nodes(self, doc: lxml.html.HtmlElement) -> tuple[dict[str, Any], dict[str, Any]]:
        acc: dict[str, Any] = {}
        for raw in doc.xpath('//script[@type="application/ld+json"]/text()'):
            try:
                parsed = json.loads(raw)
                self._walk_ld(parsed, acc)
            except json.JSONDecodeError:
                continue
        return acc, dict(acc.get("agent") or {})

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

        ld_list, ld_agent = self._extract_ld_nodes(doc)
        h1 = doc.xpath("//h1")
        title = _clean(h1[0].text_content()) if h1 else (str(ld_list.get("name") or "").split("|")[0].strip() or hint.get("title") or slug)

        offers = ld_list.get("offers") if isinstance(ld_list.get("offers"), dict) else {}
        pspec = offers.get("priceSpecification") if isinstance(offers.get("priceSpecification"), dict) else {}
        price = parse_price(str(pspec.get("price") or "")) or hint.get("listing_price")

        geo = ld_list.get("geo") if isinstance(ld_list.get("geo"), dict) else {}
        try:
            lat = float(geo["latitude"]) if geo.get("latitude") else None
            lon = float(geo["longitude"]) if geo.get("longitude") else None
        except (TypeError, ValueError):
            lat, lon = None, None

        addr = ld_list.get("address") if isinstance(ld_list.get("address"), dict) else {}
        locality = _clean(str(addr.get("addressLocality") or ""))
        kecamatan = locality.split(",")[0].strip() if locality else hint.get("kecamatan")

        facilities: list[str] = []
        skip_toks = {"Fasilitas", "Fasilitas Kamar", "Spesifikasi", "Tipe Properti", "Tipe Iklan", "Kost", "Disewa"}
        for heading in ("Fasilitas Kamar", "Spesifikasi"):
            for anchor_el in doc.xpath(f'//body//*[not(self::script) and normalize-space(text())="{heading}"]'):
                box = anchor_el.getparent()
                if box is not None and box.getparent() is not None and len(_clean(box.text_content())) <= len(heading) + 4:
                    box = box.getparent()
                if box is None:
                    continue
                for tok in box.xpath(".//text()[not(ancestor::script)]"):
                    t = _clean(tok)
                    if t and t not in skip_toks and len(t) <= 45 and not re.match(r"^(ID Iklan|ksr\d+)", t) and t not in facilities:
                        facilities.append(t)

        body_txt = _clean(" ".join(doc.xpath("//body//text()[not(ancestor::script)]")))
        wa_matches = [m for m in re.findall(r"wa\.me/(\d{9,15})", raw_html) if m != "085311111010"]
        wa = wa_matches[0] if wa_matches else None
        wa_link = normalize_wa_link(wa)

        ld_imgs = [x.get("url") if isinstance(x, dict) else x for x in (ld_list.get("image") or [])] if isinstance(ld_list.get("image"), list) else []
        cdn_imgs = re.findall(r"https://picture\.rumah123\.com/r123-images/[^\"'\s\\]+", raw_html)
        image_urls = _valid_images(ld_imgs + cdn_imgs + [hint.get("image_url")])

        return KosListing(
            source=self.name,
            url=url,
            slug=slug,
            title=title,
            nama_kost=title,
            price=price,
            price_text=format_idr(price) if price is not None else "Hubungi",
            price_options=[price] if price else list(hint.get("price_options") or []),
            price_suspect=price is None or price < 100_000,
            price_source="rumah123_json_ld" if pspec.get("price") else "listing_card",
            jenis=hint.get("jenis") or _detect_jenis(body_txt),
            kecamatan=kecamatan,
            alamat=locality or hint.get("kecamatan"),
            deskripsi=_clean(str(ld_list.get("description") or ""))[:600] or None,
            fasilitas=(", ".join(facilities)[:400] if facilities else None),
            fasilitas_list=facilities,
            image_url=image_urls[0] if image_urls else None,
            image_urls=image_urls,
            lat=lat,
            lon=lon,
            nama_pemilik=_clean(str(ld_agent.get("name") or "")) or None,
            wa=wa,
            wa_link=wa_link,
            kontak=[wa] if wa else [],
        )


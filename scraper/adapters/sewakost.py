"""Scoped lxml DOM adapter for sewakost.com listings and detail pages."""

from __future__ import annotations

import html as html_lib
import re
from typing import Any

import lxml.html

from ..models import (
    KosListing,
    dedup_image_urls,
    extract_all_prices,
    format_idr,
    normalize_wa_link,
    parse_price,
)
from .base import SourceAdapter

_URL_SLUG_RE = re.compile(
    r"(?:https?://www\.sewakost\.com)?/kost/[^/]+/[^/]+/(?:[^/]+/)*([a-z0-9][^/]*-\d+)/?$"
)


def _node_text(el: lxml.html.HtmlElement | None) -> str:
    if el is None:
        return ""
    raw = " ".join(t.strip() for t in el.itertext() if t.strip())
    return re.sub(r"\s+", " ", html_lib.unescape(raw)).strip()


def _field_values(doc: lxml.html.HtmlElement, field_id: str) -> list[str]:
    nodes = doc.xpath(f'//*[@id="{field_id}"]')
    if not nodes:
        return []
    el = nodes[0]
    vals = [
        re.sub(r"\s+", " ", html_lib.unescape(t)).strip()
        for t in el.xpath('.//li//text() | .//*[contains(@class, "value")]//text()')
        if t.strip()
    ]
    if vals:
        return [v for v in vals if v]
    # Fallback: skip the first label child if present
    children = list(el)
    if len(children) >= 2:
        txt = _node_text(children[-1])
        return [txt] if txt else []
    txt = _node_text(el)
    return [txt] if txt else []


def _field_first(doc: lxml.html.HtmlElement, field_id: str) -> str | None:
    vals = _field_values(doc, field_id)
    return vals[0] if vals else None


class SewakostAdapter(SourceAdapter):
    """Adapter for sewakost.com SSR pages using scoped lxml XPath queries."""

    name = "sewakost"
    base_url = "https://www.sewakost.com"

    def build_list_url(
        self,
        area: str = "jakarta-selatan",
        max_price: int | None = None,
        page: int = 1,
        sort: str = "default",
        order: str = "desc",
    ) -> str:
        # Start at Rp 300k when max_price allows, avoiding Rp 0 ('Hubungi') and Rp 1-2 owner typos
        min_price = 300_000 if (max_price and max_price >= 300_000) else 0
        seg = f"price:{min_price}-{max_price}/" if max_price else ""
        url = f"{self.base_url}/kost/jakarta/{area}/{seg}"
        if page > 1:
            url += f"index{page}/"
        if sort in {"price", "date"}:
            return f"{url}?sort_by={sort}&sort_type={order}"
        return url

    def list_page(
        self,
        area: str = "jakarta-selatan",
        max_price: int | None = None,
        page: int = 1,
        sort: str = "default",
        order: str = "desc",
        html: str | None = None,
    ) -> tuple[list[dict[str, Any]], bool, str]:
        url = self.build_list_url(area=area, max_price=max_price, page=page, sort=sort, order=order)
        raw_html = html if html is not None else self.client.get(url)
        doc = lxml.html.fromstring(raw_html)

        seen: set[str] = set()
        items: list[dict[str, Any]] = []
        for art in doc.xpath("//article"):
            links = art.xpath(f'.//a[contains(@href, "/kost/")]/@href')
            target = next((h for h in links if _URL_SLUG_RE.search(h)), None)
            if not target:
                continue
            full_url = target if target.startswith("http") else f"{self.base_url}{target}"
            if full_url in seen:
                continue
            m_slug = _URL_SLUG_RE.search(full_url)
            slug = m_slug.group(1) if m_slug else full_url.rstrip("/").rsplit("/", 1)[-1]
            seen.add(full_url)

            is_featured = "featured" in (art.get("class") or "")
            title_nodes = art.xpath('.//*[contains(@class, "title")]//a | .//h2 | .//h3')
            title = _node_text(title_nodes[0]) if title_nodes else ""
            if len(title) < 4:
                link_texts = [_node_text(a) for a in art.xpath(f'.//a[@href="{target}"]')]
                title = max(link_texts, key=len, default="")
            title = re.sub(r"\s*(Top Listing|\d+\s+pics?\s+more)\s*", " ", title, flags=re.I).strip()
            if len(title) < 4:
                continue

            price_nodes = art.xpath('.//*[contains(@class, "price")]')
            card_price_raw = _node_text(price_nodes[0]) if price_nodes else ""
            card_price = parse_price(card_price_raw)
            img = next(iter(art.xpath(".//img/@data-src | .//img/@src")), None)
            card_text = _node_text(art)
            m_jenis = re.search(r"(Kost\s+(?:Putri|Putra|Campur|Pasutri))", card_text, re.I)
            field_spans = [_node_text(sp) for sp in art.xpath('.//li[contains(@class, "fields")]/span') if _node_text(sp)]
            kec_match = next(
                (
                    sp
                    for sp in field_spans[1:]
                    if not sp.lower().startswith("kost ")
                    and not sp.lower().startswith("jakarta ")
                    and sp != title
                ),
                None,
            )

            items.append({
                "source": self.name,
                "title": title,
                "url": full_url,
                "slug": slug,
                "listing_price": card_price,
                "jenis": m_jenis.group(1) if m_jenis else None,
                "kecamatan": kec_match,
                "image_url": img,
                "is_featured": is_featured,
            })

        has_next = bool(doc.xpath(f'//a[contains(@href, "index{page + 1}/")]'))
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

        h1 = doc.xpath("//h1")
        title = _node_text(h1[0]) if h1 else hint.get("title")
        if title:
            title = re.sub(r"\s*-\s*Kost\s+Jakarta.*$", "", title, flags=re.I).strip()

        # Scope all price scanning strictly inside the main listing container to avoid sidebar bleed
        main_box = doc.xpath('//*[@id="area_listing"] | //div[contains(@class, "listing-details")]')
        scoped_root = main_box[0] if main_box else doc
        raw_price_text = _field_first(doc, "df_field_price")
        raw_price_val = parse_price(raw_price_text)
        desc_text = _field_first(doc, "df_field_additional_information")
        scoped_prices = extract_all_prices(_node_text(scoped_root), min_monthly=100_000)

        resolved_price, price_suspect, price_source = self._resolve_price(
            raw_price_val, hint.get("listing_price"), scoped_prices, desc_text
        )
        price_text = format_idr(resolved_price) if resolved_price is not None else raw_price_text

        fasilitas_list = self._extract_facilities(doc)
        peraturan = self._extract_rules(doc)

        owner_el = doc.xpath('//li[contains(@class, "name")]')
        nama_pemilik = _node_text(owner_el[0])[:60] if owner_el else None
        telp = self._clean_phone(_field_first(doc, "df_field_telepon"))
        hp = self._clean_phone(_field_first(doc, "df_field_nomorhp"))
        wa = self._clean_phone(_field_first(doc, "df_field_whatsapp"))
        wa_link = normalize_wa_link(wa or hp or telp)
        kontak = sorted({p for p in (telp, hp, wa) if p})

        raw_imgs = (
            doc.xpath('//div[contains(@class, "gallery")]//img/@src')
            + doc.xpath('//div[contains(@class, "gallery")]//img/@data-src')
            + doc.xpath('//div[contains(@class, "gallery")]//a/@href')
            + doc.xpath('//meta[@property="og:image"]/@content')
            + [hint.get("image_url")]
        )
        image_urls = dedup_image_urls(raw_imgs)
        image_url = image_urls[0] if image_urls else None

        return KosListing(
            source=self.name,
            url=url,
            slug=slug,
            title=title,
            nama_kost=_field_first(doc, "df_field_nama_kost") or title,
            price=resolved_price,
            price_text=price_text,
            price_options=scoped_prices[:8],
            price_suspect=price_suspect,
            price_source=price_source,
            jenis=_field_first(doc, "df_field_jenis") or hint.get("jenis"),
            kecamatan=_field_first(doc, "df_field_lokasi_level2"),
            kelurahan=_field_first(doc, "df_field_lokasi_level3"),
            alamat=_field_first(doc, "df_field_address"),
            deskripsi=(desc_text[:600] if desc_text else None),
            fasilitas=(", ".join(fasilitas_list)[:400] if fasilitas_list else None),
            fasilitas_list=fasilitas_list,
            peraturan=peraturan,
            image_url=image_url,
            image_urls=image_urls,
            nama_pemilik=nama_pemilik or None,
            telp=telp,
            hp=hp,
            wa=wa,
            wa_link=wa_link,
            kontak=kontak,
            is_featured=bool(hint.get("is_featured", False)),
        )

    @staticmethod
    def _resolve_price(
        raw_price: int | None,
        card_price: int | None,
        scoped_prices: list[int],
        desc_text: str | None,
    ) -> tuple[int | None, bool, str]:
        if raw_price is not None and 100_000 <= raw_price <= 100_000_000:
            return raw_price, False, "df_field_price"
        if card_price is not None and 100_000 <= card_price <= 100_000_000:
            return card_price, False, "listing_card"
        desc_prices = extract_all_prices(desc_text, min_monthly=100_000)
        if desc_prices:
            return min(desc_prices), False, "description"
        if scoped_prices:
            return min(scoped_prices), False, "scoped_container"
        return raw_price, True, "unverified_raw"

    @staticmethod
    def _extract_facilities(doc: lxml.html.HtmlElement) -> list[str]:
        items: list[str] = []
        for fid, label in (
            ("df_field_aircon", "AC"),
            ("df_field_free_wifi", "Free WiFi"),
            ("df_field_kamar_mandi_dalam", "Kamar Mandi Dalam"),
        ):
            val = (_field_first(doc, fid) or "").lower()
            if val in {"ya", "yes", "ada"}:
                items.append(label)
        for fid in ("df_field_fasilitas_kamar", "df_field_fasilitas_kost", "df_field_fasilitas_sekitar"):
            items.extend(_field_values(doc, fid))
        deduped: list[str] = []
        seen: set[str] = set()
        for item in items:
            key = item.lower()
            if key not in seen and key not in {"ya", "tidak"}:
                seen.add(key)
                deduped.append(item)
        return deduped

    @staticmethod
    def _extract_rules(doc: lxml.html.HtmlElement) -> list[str]:
        rules: list[str] = []
        for fid, prefix in (
            ("df_field_peruntukan_kost", "Peruntukan"),
            ("df_field_pasutri", "Pasutri"),
            ("df_field_bawa_anak", "Bawa Anak"),
            ("df_field_jam_malam", "Jam Malam"),
            ("df_field_hean_peliharaan", "Hewan Peliharaan"),
        ):
            vals = _field_values(doc, fid)
            if vals:
                rules.append(f"{prefix}: {', '.join(vals)}")
        return rules

    @staticmethod
    def _clean_phone(raw: str | None) -> str | None:
        if not raw:
            return None
        cleaned = re.sub(r"[^\d+]", "", raw)
        return cleaned if len(re.sub(r"\D", "", cleaned)) >= 7 else None


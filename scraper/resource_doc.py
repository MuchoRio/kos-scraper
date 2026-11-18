"""Google Resource URL validator, HTTP fetcher, clean extractors & Google Docs KST parser."""

from __future__ import annotations

import re
import ssl
import urllib.parse
import urllib.request
from typing import Any, Callable

from .models import dedup_image_urls, normalize_wa_link

_SHEET_RE = re.compile(r"^https://docs\.google\.com/spreadsheets/d/([a-zA-Z0-9_-]{15,})(?:/[^\s]*)?$", re.I)
_DOC_RE = re.compile(r"^https://docs\.google\.com/document/d/([a-zA-Z0-9_-]{15,})(?:/[^\s]*)?$", re.I)
_PLACEHOLDER_RE = re.compile(r"belum\s+diisi", re.I)
_COORDS_RE = (
    re.compile(r"!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)"),
    re.compile(r"@(-?\d+\.\d+),(-?\d+\.\d+)"),
    re.compile(r"[?&]q=(-?\d+\.\d+)(?:,|%2C)(-?\d+\.\d+)", re.I),
)

AREA_MATCHERS = {
    "jakarta-selatan": ("jakarta selatan", "jaksel", "mampang", "kemang", "tebet", "pancoran", "cilandak", "kebayoran", "setiabudi", "pasar minggu", "jagakarsa", "pesanggrahan"),
    "jakarta-pusat": ("jakarta pusat", "jakpus", "menteng", "tanah abang", "senen", "kemayoran", "gambir", "cempaka putih", "benhil"),
    "jakarta-barat": ("jakarta barat", "jakbar", "kebon jeruk", "grogol", "palmerah", "taman sari", "kalideres", "kemanggisan", "binus", "kedoya", "tanjung duren", "cengkareng"),
    "jakarta-timur": ("jakarta timur", "jaktim", "pulo gadung", "jatinegara", "duren sawit", "matraman", "utan kayu", "kramat jati", "cakung"),
    "jakarta-utara": ("jakarta utara", "jakut", "kelapa gading", "tanjung priok", "penjaringan", "pademangan"),
    "tangerang-selatan": ("tangerang selatan", "tangsel", "bintaro", "bsd", "serpong"),
    "depok": ("depok", "margonda", "beji", "ui "),
    "bekasi": ("bekasi",),
    "bandung": ("bandung",),
    "yogyakarta": ("yogyakarta", "jogja", "sleman", "bantul", "kaliurang"),
}

_DOC_FIELD_RE = re.compile(
    r"^(Nama Kos|Nomor Kontak|Lokasi|Link Google Maps|Harga per Bulan|Gender|Ketersediaan[^:\n]*|Fasilitas Kost|Keunggulan Lokasi[^:\n]*|Foto Kost)\s*$",
    re.I,
)
_DOC_FIELD_KEYS = (
    ("nama", "nama"),
    ("kontak", "kontak"),
    ("maps", "maps"),
    ("harga", "harga"),
    ("gender", "gender"),
    ("ketersediaan", "avail"),
    ("fasilitas", "fasilitas"),
    ("keunggulan", "deskripsi"),
    ("foto", "foto"),
    ("lokasi", "alamat"),
)


def parse_google_resource_url(raw_url: str) -> dict[str, str]:
    """Validate and classify a public Google Sheets or Google Docs URL."""
    url = str(raw_url or "").strip()
    m_sheet = _SHEET_RE.match(url)
    if m_sheet:
        m_gid = re.search(r"(?:[?&#]gid=)(\d+)", url)
        return {"kind": "sheet", "id": m_sheet.group(1), "gid": m_gid.group(1) if m_gid else "0", "url": url}
    m_doc = _DOC_RE.match(url)
    if m_doc:
        m_tab = re.search(r"(?:[?&#]tab=)([a-zA-Z0-9._-]+)", url)
        return {"kind": "doc", "id": m_doc.group(1), "tab": m_tab.group(1) if m_tab else "", "url": url}
    raise ValueError("URL harus berupa link Google Sheets atau Google Docs yang valid (https://docs.google.com/...).")


def fetch_google_text(url: str, timeout: float = 25.0) -> str:
    """Fetch public Google Sheet CSV or Google Doc export text, flagging login-gated docs."""
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; KosHunt/2.1)"})
    with urllib.request.urlopen(req, timeout=timeout, context=ssl.create_default_context()) as resp:
        if "accounts.google.com" in resp.geturl():
            raise ValueError("Dokumen Google bersifat privat (memerlukan login). Ubah akses menjadi 'Anyone with the link can view'.")
        return resp.read().decode("utf-8-sig", errors="replace")


def clean_cell(val: str | None) -> str | None:
    if not val:
        return None
    cleaned = re.sub(r"[\u202a-\u202e\u200b-\u200f]+", "", str(val))
    cleaned = cleaned.replace("\u2011", "-").replace("\u2013", "-")
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    if not cleaned or _PLACEHOLDER_RE.search(cleaned):
        return None
    return cleaned


def strip_leading_emoji(val: str | None) -> str | None:
    if not val:
        return None
    cleaned = re.sub(r"^[^\w\d(+]+", "", val).strip()
    return cleaned or val


def extract_phone_and_link(raw: str | None) -> tuple[str | None, str | None, str | None]:
    """Return (wa_number, wa_link, platform_url) from a contact/link cell."""
    val = clean_cell(raw)
    if not val:
        return None, None, None
    m_url = re.search(r"https?://[^\s,]+", val, re.I)
    if m_url:
        u = m_url.group(0).rstrip(".,;)")
        if "docs.google.com" not in u.lower():
            return None, None, u
    digits = re.sub(r"\D", "", val)
    if digits.startswith("8") and 8 <= len(digits) <= 13:
        digits = "0" + digits
    if len(digits) < 8 or len(digits) > 15:
        return None, None, None
    return digits, normalize_wa_link(digits), None


def extract_coords_from_maps_url(url: str | None) -> tuple[float | None, float | None]:
    if not url:
        return None, None
    for pat in _COORDS_RE:
        m = pat.search(url)
        if m:
            try:
                lat, lon = float(m.group(1)), float(m.group(2))
                if -11.0 <= lat <= 6.0 and 95.0 <= lon <= 141.0:
                    return lat, lon
            except ValueError:
                continue
    return None, None


def clean_photo_urls(raw: str | None) -> list[str]:
    val = clean_cell(raw)
    if not val:
        return []
    candidates = [p.strip() for p in re.split(r"[\s,\n]+", val) if p.strip().startswith("http")]
    imgs = [
        u for u in candidates
        if "googleusercontent.com" in u.lower()
        or re.search(r"\.(?:jpg|jpeg|png|webp)(?:$|[?#])", u, re.I)
    ]
    return dedup_image_urls(imgs)


def parse_doc_kst_blocks(
    text: str,
    doc_url: str,
    normalize_fn: Callable[[int, dict[str, str], str, str | None], dict[str, Any] | None],
) -> list[dict[str, Any]]:
    chunks = re.split(r"\b(KST-\d+)\b", text)
    out: list[dict[str, Any]] = []
    row_no = 0
    for i in range(1, len(chunks) - 1, 2):
        kid, block = chunks[i], chunks[i + 1]
        lines = [ln.strip() for ln in block.splitlines() if ln.strip()]
        raw: dict[str, str] = {"nama": lines[0] if lines else ""}
        idx = 1
        while idx < len(lines) - 1:
            m = _DOC_FIELD_RE.match(lines[idx])
            if m:
                key = m.group(1).lower()
                for token, dst in _DOC_FIELD_KEYS:
                    if token in key:
                        raw[dst] = lines[idx + 1]
                        break
                idx += 2
            else:
                idx += 1
        row_no += 1
        norm = normalize_fn(row_no, raw, doc_url, kid)
        if norm:
            out.append(norm)
    return out


def load_google_doc(
    doc_id: str,
    url: str,
    area: str,
    keywords: list[str] | None,
    normalize_fn: Callable[[int, dict[str, str], str, str | None], dict[str, Any] | None],
    fetch_fn: Callable[[str], str] = fetch_google_text,
) -> dict[str, Any]:
    """Parse KST blocks directly from a Google Doc or follow matching master-index sub-docs."""
    doc_txt = fetch_fn(f"https://docs.google.com/document/d/{doc_id}/export?format=txt")
    rows = parse_doc_kst_blocks(doc_txt, url, normalize_fn)
    sub_docs: list[dict[str, str]] = []
    if not rows:
        doc_html = fetch_fn(f"https://docs.google.com/document/d/{doc_id}/export?format=html")
        for m in re.finditer(r'<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>', doc_html, re.S):
            href, label = m.group(1), re.sub(r"<[^>]+>|\s+", " ", m.group(2)).strip()
            if "google.com/url?q=" in href:
                href = urllib.parse.unquote(href.split("url?q=", 1)[1].split("&", 1)[0])
            if "docs.google.com/document/d/" in href:
                sub_docs.append({"label": label, "url": href})
        needles = [k.lower() for k in (keywords or []) if k.strip()] or list(AREA_MATCHERS.get(area, ()))
        picked = [sd for sd in sub_docs if any(n in sd["label"].lower() for n in needles)][:3] or sub_docs[:2]
        for sd in picked:
            try:
                sub_id = parse_google_resource_url(sd["url"])["id"]
                sub_txt = fetch_fn(f"https://docs.google.com/document/d/{sub_id}/export?format=txt")
                rows.extend(parse_doc_kst_blocks(sub_txt, sd["url"], normalize_fn))
            except Exception:
                continue
    return {
        "kind": "doc",
        "schema": "google_doc_kst",
        "headers": ["ID Kost", "Nama Kos", "Harga", "Lokasi"],
        "rows": rows,
        "sub_docs": sub_docs,
    }


def matches_meta_filters(
    r: dict[str, Any],
    price_category: str,
    availability: str,
    quality: str,
    gender: str,
    pet: str,
) -> bool:
    """Match Kostpedia categorical filters (Kategori Harga, Ketersediaan, Kualitas, Gender, Pet)."""
    avail = (r.get("status_ketersediaan") or "").lower()
    if availability == "strict_available":
        if "tersedia" not in avail or "penuh" in avail or "tidak aktif" in avail:
            return False
    elif availability == "available_or_unknown" and not r.get("is_available", True):
        return False

    if price_category != "all":
        kat = (r.get("kategori_harga") or "").lower()
        p = r.get("price")
        if price_category == "murah" and not ("murah" in kat or (not kat and p and p <= 1_500_000)):
            return False
        if price_category == "middle" and not (any(w in kat for w in ("middle", "standar", "worth")) or (not kat and p and 1_500_000 < p <= 3_000_000)):
            return False
        if price_category == "premium" and not (any(w in kat for w in ("premium", "eksklusif", "exclusive", "vip")) or (not kat and p and p > 3_000_000)):
            return False

    if quality != "all":
        qual = (r.get("kualitas") or "").lower()
        if not qual:
            return False
        if quality == "top" and "top" not in qual:
            return False
        if quality == "worth_it" and "worth" not in qual:
            return False
        if quality == "best_deal" and "best" not in qual and "deal" not in qual:
            return False
        if quality == "standar" and "standar" not in qual:
            return False

    if gender != "all":
        jenis = (r.get("jenis") or "").lower()
        aliases = {"wanita": ("wanita", "putri"), "pria": ("pria", "putra")}.get(gender, (gender,))
        if not any(a in jenis for a in aliases):
            return False

    if pet != "all":
        pst = (r.get("pet_status") or "").lower()
        is_no = any(w in pst for w in ("tidak", "no pet", "dilarang"))
        is_yes = any(w in pst for w in ("cat", "dog", "pet")) and not is_no
        if pet == "pet_friendly" and not is_yes:
            return False
        if pet == "no_pet" and not is_no:
            return False
    return True



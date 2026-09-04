#!/usr/bin/env python3
"""kos-scraper: scrape kos listings from sewakost.com (curl-friendly, no JS needed).

Usage:
  python3 kos_scraper.py list --area jakarta-selatan --max-price 1000000 --max-pages 3
  python3 kos_scraper.py list --area jakarta-selatan --max-price 1000000 --keyword "blok m,kemang,kebayoran,mampang,cipete,fatmawati" --max-pages 5
  python3 kos_scraper.py detail <url> [url2 ...]
  python3 kos_scraper.py search --area jakarta-selatan --max-price 1000000 --keyword "blok m,kemang" --details 10

Output: JSON to stdout. Polite: 1.5s delay between requests, browser UA.
Data: sewakost.com (public listings). Respect ToS; personal use only.
"""
import json, re, sys, time, argparse, urllib.request

UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
BASE = "https://www.sewakost.com"
SLEEP = 1.5

def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "id-ID,id;q=0.9,en;q=0.8"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", errors="replace")

def clean(s):
    s = re.sub(r"<script.*?</script>", " ", s, flags=re.S)
    s = re.sub(r"<style.*?</style>", " ", s, flags=re.S)
    s = re.sub(r"<[^>]+>", " ", s)
    return re.sub(r"\s+", " ", s).strip()

def parse_price(s):
    m = re.search(r"Rp\s?([\d.]+)", s or "")
    return int(m.group(1).replace(".", "")) if m else None

def list_page(area="jakarta-selatan", max_price=None, page=1, sort="price", order="asc"):
    seg = f"price:0-{max_price}/" if max_price else ""
    url = f"{BASE}/kost/jakarta/{area}/{seg}"
    if page > 1:
        url += f"index{page}/"
    url += f"?sort_by={sort}&sort_type={order}"
    html = fetch(url)
    # detail URLs may sit behind filter segments (price:, lokasi:, jenis:) — match last segment
    cards = re.findall(
        r'<a[^>]*href="((?:https://www\.sewakost\.com)?/kost/jakarta/' + re.escape(area) + r'/(?:[^"]*/)?([a-z0-9][^":]*?-\d+)/)"[^>]*>(.*?)</a>',
        html, re.S)
    seen, out = set(), []
    for href, slug, inner in cards:
        full = href if href.startswith("http") else BASE + href
        title = clean(inner)
        title = re.sub(r"\s*(Top Listing|\d+ pics more)\s*", " ", title).strip()
        if len(title) < 4:
            continue
        if full in seen:
            continue
        seen.add(full)
        out.append({"title": title, "url": full, "slug": slug})
    # pagination: does next page exist?
    has_next = bool(re.search(r"index%d/" % (page + 1), html))
    return out, has_next, url

def parse_detail(url):
    html = fetch(url)
    text = clean(html)
    d = {"url": url}
    m = re.search(r"^(.*?)\s*-\s*Kost Jakarta", text)
    d["title"] = m.group(1).strip() if m else None
    m = re.search(r"(Rp\s?[\d.]+)", text)
    d["price_text"] = m.group(1) if m else None
    d["price"] = parse_price(d["price_text"])
    # listing pages often show rating stars / gallery counters as tiny "Rp 1/2/5"
    # artifacts; prefer the largest plausible monthly price on the page
    all_prices = [parse_price(p) for p in re.findall(r"Rp\s?[\d.]+", text)]
    all_prices = [p for p in all_prices if p and p >= 100000]
    if all_prices:
        d["price"] = min(all_prices) if (d["price"] or 0) < 100000 else d["price"]
        if (d["price"] or 0) < 100000:
            d["price_text"] = f"Rp {d['price']:,}".replace(",", ".")
    d["price_options"] = sorted(set(all_prices))[:8]
    for field, pat in [
        ("jenis", r"Jenis Kost\s+(.*?)\s+(?:AC|Free WiFi|Kamar Mandi|Fasilitas|Lokasi)"),
        ("kecamatan", r"Kecamatan\s+(.*?)\s+Kelurahan"),
        ("kelurahan", r"Kelurahan\s+(.*?)\s+Alamat"),
        ("alamat", r"Alamat\s+(.*?)\s+Fasilitas Kost"),
        ("nama_kost", r"Nama Kost\s+(.*?)\s+Provinsi"),
    ]:
        m = re.search(pat, text)
        d[field] = m.group(1).strip() if m else None
    m = re.search(r"Deskripsi\s+(.*?)\s+Informasi Umum", text)
    d["deskripsi"] = (m.group(1).strip()[:600] if m else None)
    # facilities: grab "Fasilitas ..." section lines
    m = re.search(r"Fasilitas Kost\s+(.*?)\s+Peraturan Kost", text)
    d["fasilitas"] = (m.group(1).strip()[:400] if m else None)
    phones = sorted(set(re.findall(r"(?:0\d{9,13})", text)))
    d["kontak"] = phones[:3]
    # structured contact fields straight from the seller block (more reliable
    # than regexing the whole page text)
    def _field(label):
        m = re.search(re.escape(label) + r"</div>\s*<div[^>]*>\s*(?:<!--.*?-->\s*)*([0-9+\s.\-]{6,25})",
                       html, re.S)
        return re.sub(r"\s+", "", m.group(1)) if m else None
    d["nama_pemilik"] = None
    m = re.search(r'<li class="name">\s*(.*?)\s*(?:<|&)', html, re.S)
    if m:
        d["nama_pemilik"] = clean(m.group(1))[:60] or None
    d["telp"] = _field("Telepon")
    d["hp"] = _field("Nomor HP")
    d["wa"] = _field("Whatsapp")
    # wa link helper (normalize 08.. -> 628..)
    wa = d["wa"] or d["hp"] or d["telp"]
    if wa:
        digits = re.sub(r"\D", "", wa)
        if digits.startswith("08"):
            digits = "62" + digits[1:]
        d["wa_link"] = f"https://wa.me/{digits}" if len(digits) >= 10 else None
    else:
        d["wa_link"] = None
    return d

def match_kw(item, keywords):
    blob = " ".join(str(item.get(k) or "") for k in ("title", "slug", "kecamatan", "kelurahan", "alamat", "deskripsi")).lower()
    blob = blob.replace("-", " ")
    return [kw for kw in keywords if kw.lower() in blob]

def cmd_list(a):
    kws = [k.strip() for k in (a.keyword or "").split(",") if k.strip()]
    all_items, page = [], 1
    while page <= a.max_pages:
        try:
            items, has_next, url = list_page(a.area, a.max_price, page)
        except Exception as e:
            print(json.dumps({"error": str(e), "page": page}), file=sys.stderr)
            break
        if not items:
            break
        for it in items:
            it["area_match"] = match_kw(it, kws) if kws else []
            if kws and not it["area_match"] and a.strict:
                continue
            all_items.append(it)
        time.sleep(SLEEP)
        if not has_next:
            break
        page += 1
    print(json.dumps({"source": "sewakost.com", "count": len(all_items), "items": all_items}, ensure_ascii=False, indent=1))

def cmd_detail(a):
    out = []
    for u in a.urls:
        try:
            out.append(parse_detail(u))
        except Exception as e:
            out.append({"url": u, "error": str(e)})
        time.sleep(SLEEP)
    print(json.dumps(out, ensure_ascii=False, indent=1))

def cmd_search(a):
    kws = [k.strip() for k in (a.keyword or "").split(",") if k.strip()]
    all_items, page = [], 1
    while page <= a.max_pages and len(all_items) < a.details * 2:
        try:
            items, has_next, _ = list_page(a.area, a.max_price, page)
        except Exception:
            break
        for it in items:
            it["area_match"] = match_kw(it, kws) if kws else []
            if kws and not it["area_match"]:
                continue
            all_items.append(it)
        time.sleep(SLEEP)
        if not has_next:
            break
        page += 1
    out = []
    for it in all_items[:a.details]:
        try:
            d = parse_detail(it["url"])
            d["area_match"] = it["area_match"]
            out.append(d)
        except Exception as e:
            it["error"] = str(e)
            out.append(it)
        time.sleep(SLEEP)
    print(json.dumps({"source": "sewakost.com", "count": len(out), "items": out}, ensure_ascii=False, indent=1))

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)
    l = sub.add_parser("list"); l.add_argument("--area", default="jakarta-selatan")
    l.add_argument("--max-price", type=int, default=None); l.add_argument("--max-pages", type=int, default=3)
    l.add_argument("--keyword", default=""); l.add_argument("--strict", action="store_true")
    d = sub.add_parser("detail"); d.add_argument("urls", nargs="+")
    s = sub.add_parser("search"); s.add_argument("--area", default="jakarta-selatan")
    s.add_argument("--max-price", type=int, default=None); s.add_argument("--max-pages", type=int, default=5)
    s.add_argument("--keyword", default=""); s.add_argument("--details", type=int, default=10)
    args = p.parse_args()
    {"list": cmd_list, "detail": cmd_detail, "search": cmd_search}[args.cmd](args)

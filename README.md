# kos-scraper 🏠

Workflow automation buat scrapping kosan — biar ga usah ngubek Google Maps satu-satu, bray.

## Cara pake

```bash
# 1x jalan: scrape → filter area → ambil detail → jadi CSV
./kos_hunt.sh "kemang,blok m,cipete,mampang" 1000000 jakarta-selatan
```

Argumen: `./kos_hunt.sh "keyword1,keyword2" MAX_HARGA AREA`
- `keyword` — filter area (cocok di judul/slug iklan)
- `MAX_HARGA` — batas harga bulanan (cth: `1000000`)
- `AREA` — area sewakost.com (cth: `jakarta-selatan`)

Hasil masuk ke `hasil/` : CSV + JSON mentah (list & detail).

## Perintah manual

```bash
# list iklan aja (JSON ke stdout)
python3 kos_scraper.py list --area jakarta-selatan --max-price 1000000 --max-pages 3

# detail 1..n iklan
python3 kos_scraper.py detail <url1> <url2>

# cari + langsung ambil detail yg match keyword
python3 kos_scraper.py search --area jakarta-selatan --max-price 1000000 \
  --keyword "blok m,kemang" --details 10
```

## Sumber data

- **sewakost.com** — bisa di-scrape via HTTP biasa (no JS), ada filter harga `price:0-1000000`, pagination `index2/...`, halaman detail kaya (fasilitas, alamat, kontak). ✅ jalan
- **Mamikos / Rukita / 99.co** — JS-rendered, perlu headless browser. Belum di sini (VPS ini ga ada Chromium). Liat `ROADMAP.md`.

## Etika scraping

- Delay 1.5 dtk/req, UA browser normal. Buat pake pribadi aja, hormatin ToS situs sumber.
- Nomor kontak di hasil scrape **jangan disebar** — hasil CSV buat riset pribadi.

## Struktur

```
kos_scraper.py   # scraper (list/detail/search → JSON)
kos_hunt.sh      # workflow 1x jalan → CSV di hasil/
hasil/           # contoh output (di-gitignore, kecuali contoh)
ROADMAP.md       # rencana: Mamikos, Rukita, Sheets, monitoring
```

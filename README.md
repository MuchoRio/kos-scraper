# kos-scraper / KosHunt Studio

Multi-source boarding house (kos) scraper & **Bento Grid Web Studio** — lintas-platform (macOS, Linux, Windows).

## Arsitektur

- `scraper/` — Python 3 engine (`lxml` scoped DOM parsing, multi-thread list & detail concurrency `--concurrency`, retry + exponential backoff/jitter, round-robin fairness antar sumber, semantic attribute classifier `Texas/Non-Texas, Pet, Pasutri, KM, Dapur, Harga Tier`, `shared/transum_hubs.json` transit proximity, cached OSM Nominatim geocoding + Haversine distance, galeri multi-foto `image_urls`, Google Maps rating/evaluasi sentimen/clue harga, **Scam & Red-Flag Detector**, safe `utf-8-sig` CSV writer dengan anti formula-injection).
  - `sewakost.com` adapter (`df_field_*` DOM parser + anti-sidebar price bleed guard + listing card price cross-check + multi-foto galeri).
  - `rukita.co` adapter (SSR card parser + Schema.org `LodgingBusiness` JSON-LD `geo`, `priceRange`, & galeri).
  - `mamikos.com` adapter (SSR `/kost/kost-<area>-murah` cards lengkap dengan tipe, fasilitas, & harga).
  - `infokost.id` adapter (SSR `/kost/<area>` & `/listings/*` DOM parser + koordinat + galeri kamar).
  - `cove.id` adapter (Next.js `__NEXT_DATA__` JSON parser + galeri media).
  - *Catatan `99.co/id`*: Diblokir verifikasi bot Cloudflare (`HTTP 403`) dan tidak di-bypass.
  - `gmaps.py`, `gmaps_analyzer.py`, & `fraud_detector.py` — Integrasi Google Places API (New) via `GOOGLE_MAPS_API_KEY` (atau `chrome_browser` fallback untuk rating/link Maps), ekstraksi estimasi harga dari komentar penghuni, dan deteksi sinyal penipuan dua lapis.
- `server/` — Node.js + Express 5 local API (`127.0.0.1:3001`), validasi `concurrency` `1–8`, job queue concurrency cap `1`, cancellation nyata, dan live SSE progress stream.
- `client/` — React 19 + TypeScript + Vite + Tailwind CSS v4 **Bento Grid UI** (Light & Dark mode, bar filter utama ringkas + **Filter Lanjutan Modal** ala Progressive Disclosure, removable active chips, **Fasilitas Kamar vs Gedung** ber-ikon, tab **Di Sekitar Kost** untuk Halte Busway/MRT/KRL/LRT/Mall terdekat, kartu foto `16:10` full-bleed + galeri multi-foto di Detail Drawer, Favorit, History `hasil/`, Export CSV).

## Prasyarat

- **Python 3.10+** dengan `lxml` (`pip install lxml` jika belum tersedia)
- **Node.js 20+** & npm

## Cara Menjalankan (Web Studio)

### Opsi 1 — One-Click Launcher (Production Bundle)
- **macOS / Linux**: `./run.sh`
- **Windows CMD**: `run.bat`
- **Windows PowerShell**: `.\run.ps1`

Lalu buka browser ke `http://127.0.0.1:3001`.

### Opsi 2 — Mode Development (Hot Reload)
```bash
npm run install:all
npm run dev
```
Frontend berjalan di `http://127.0.0.1:5173` (proxy `/api` ke `http://127.0.0.1:3001`).

## Cara Menjalankan (CLI / Otomasi)

```bash
# Workflow hunt multi-sumber -> JSON & CSV di hasil/
python3 kos_scraper.py hunt --sources sewakost,rukita --area jakarta-selatan --max-price 1500000 --keyword "kemang,blok m,cipete" --details 20

# Shortcut bash (POSIX)
./kos_hunt.sh "kemang,blok m,cipete,mampang" 1000000 jakarta-selatan sewakost,rukita

# Subcommand manual
python3 kos_scraper.py list --sources sewakost,rukita --area jakarta-selatan --max-price 1000000 --max-pages 3
python3 kos_scraper.py search --sources sewakost --area jakarta-selatan --max-price 1000000 --keyword "cipete" --geocode --gmaps --ref-lat -6.2784 --ref-lon 106.7973
python3 kos_scraper.py detail <url1> [url2 ...]
```

## Endpoint API Utama

- `GET /api/health` & `GET /api/presets`
- `POST /api/jobs` / `GET /api/jobs/:id` / `POST /api/jobs/:id/cancel` / `GET /api/jobs/:id/events` (SSE)
- `GET /api/results` & `GET /api/results/:filename`
- `GET /api/favorites` & `POST /api/favorites/toggle`
- `POST /api/export/csv`

## Testing & Verifikasi

```bash
npm run lint   # TypeScript typecheck
npm test       # Python unittest (offline fixtures) + Node API tests + Vite build
```

## Etika & Privasi

- Default polite delay `>= 1.5s` per host dan concurrency cap `1` job aktif.
- Nomor kontak hasil scrape **tidak untuk disebar** (UI mendukung mode sensor kontak & folder `hasil/*.json`/`hasil/*.csv` ter-gitignore).

## Troubleshooting

- **`EADDRINUSE` pada port 3001**: Jalankan dengan port lain, misal `PORT=3050 ./run.sh` (POSIX) atau `$env:PORT=3050; .\run.ps1` (PowerShell).
- **Python interpreter berbeda**: Override dengan `PYTHON_BIN=/path/to/python3 npm run dev`.

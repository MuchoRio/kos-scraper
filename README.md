# kos-scraper / KosHunt Studio

Multi-source boarding house (kos) scraper & **Bento Grid Web Studio** — lintas-platform (macOS, Linux, Windows).

## Arsitektur

- `scraper/` — Python 3 engine (`lxml` scoped DOM parsing, multi-thread list & detail concurrency `--concurrency`, retry + exponential backoff/jitter, round-robin fairness antar sumber, semantic attribute classifier `Texas/Non-Texas, Pet Friendly + Tidak Pet guard, Pasutri, KM, Dapur, Harga Tier`, `shared/transum_hubs.json` transit proximity, `shared/landmarks.json` acuan Menara Bank Mega, cached OSM Nominatim geocoding + Haversine distance, galeri multi-foto `image_urls`, Google Maps pin exact `!3d!4d` / sentimen / clue harga, **Scam & Red-Flag Detector**, CRUD upsert `exporters.py`, safe `utf-8-sig` CSV writer).
  - **8 Website Adapters**: `sewakost.com`, `rukita.co`, `mamikos.com`, `infokost.id`, `cove.id`, `djuragankamar.com`, `rumah123.com`, `kostjakarta.com`.
  - **Riset Direktori Terpisah (`resource_doc.py`, `resource_parser.py`, `resource_runner.py`)**: Analisis sheet & dokumen publik (`inspect-resource` / `analyze-resource`) secara terisolasi ke `hasil/resources/`, lengkap dengan pra-filter Kategori Harga / Ketersediaan / Kualitas / Gender / Pet, deduplikasi, resolusi `maps.app.goo.gl` & `place_id:ChIJ...`, serta `--mask-source-url`.
  - *Catatan situs diblokir anti-bot*: `99.co/id` (Cloudflare 403), `trovit` (401), `papikost` (403), dan `idkos` (timeout/404) tidak di-bypass.
  - `gmaps.py`, `gmaps_analyzer.py`, & `fraud_detector.py` — Integrasi Google Places API (New) via `GOOGLE_MAPS_API_KEY` (dengan resolusi `places.photos` → `photoUri` bebas API key) atau `chrome_browser` fallback untuk pin exact, foto tempat & lampiran ulasan asli (`lh[345].googleusercontent.com`), badge `image_source: "google_maps"`, rating, estimasi harga dari ulasan, & deteksi risiko penipuan dua lapis.
- `server/` — Node.js + Express 5 local API (`127.0.0.1:3001`), katalog sumber privat server-side (`resourceCatalog.js` membaca `hasil/resource_catalog.json` / `RESOURCE_CATALOG_JSON` tanpa membocorkan URL ke klien), target resource `1–25.000 / Semua` (`detailsLimit: 0`) & scraper `1–2.000` terpisah dari `liveEnrichLimit`, limit payload JSON `50mb` untuk export ribuan baris CSV, CRUD hapus file riwayat (`DELETE`), job queue concurrency cap `1`, cancellation nyata, dan live SSE progress stream (file-backed saat >200 item).
- `client/` — React 19 + TypeScript + Vite + Tailwind CSS v4 **Bento Grid UI** (mode terpisah **`Scraper Web`** | **`Riset Sheet & Doc`**, custom target `1–25.000 / Semua` + `Scraper Web` `1–2.000`, **Pagination `20` item/halaman**, **Filter Lanjutan & Pengaturan Modal** ber-tab + kontrol `Batas Enrich Live`, **Mode Simpan CRUD File** `replace` / `merge` / `archive`, **Database Server vs Custom URL** tanpa badge file di header, **Fasilitas Kamar vs Gedung** ber-ikon, badge rating platform (`source_rating`), sisa kamar & promo, tab **Di Sekitar Kost** transum, galeri multi-foto, Favorit, Riwayat `hasil/`, Export CSV).

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
- `GET /api/results`, `GET /api/results/:filename`, & `DELETE /api/results/:filename`
- `GET/POST /api/resources/presets` & `DELETE /api/resources/presets/:id`
- `POST /api/resources/inspect`, `POST /api/resources/jobs`, `GET /api/resources/results`, & `DELETE /api/resources/results/:filename`
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

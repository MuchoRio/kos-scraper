# Roadmap

- [x] **Sewakost adapter hardening** — Scoped `lxml` DOM parser (`df_field_*`), perbaikan bug `price_text` & sidebar price bleed, retry + backoff/jitter, CLI `--sort`/`--order`.
- [x] **Rukita adapter** — `rukita.co/kost/<area>` SSR + Schema.org `LodgingBusiness` JSON-LD (`geo`, `priceRange`, fasilitas).
- [x] **Mamikos, Infokost, & Cove adapters** — SSR listing & JSON `__NEXT_DATA__` parsers + round-robin fairness antar sumber.
- [x] **Google Maps Rating, Sentimen & Anti-Penipuan** — Places API (New) + fallback Chrome lokal, clue harga dari ulasan, & deteksi dua lapis risiko penipuan (`fraud_detector.py`).
- [x] **Geocoding + jarak** — Haversine distance + cached OSM Nominatim (`scraper/geo.py`, 1.1 req/s).
- [x] **Cross-platform workflow & Bento Grid Web Studio** — Pengganti `kos_hunt.sh` bash-only (`scraper/runner.py`), Node/Express SSE queue (`server/`), dan React/Vite Bento Grid UI (`client/`).
- [x] **Multi-thread concurrency & Progressive Disclosure UI** — Paralelisme list & detail worker (`ThreadPoolExecutor`), **Filter Lanjutan Modal**, deteksi atribut kos Indonesia, jarak transum terdekat (`HALTE BUSWAY | MRT | KRL | LRT | MALL`), fasilitas Kamar vs Gedung ber-ikon, & galeri multi-foto.
- [x] **8 Website Adapters + Landmark Bank Mega & Price Hygiene** — Penambahan `DjuraganKamar`, `Rumah123`, `KostJakarta`, filter nominal sewa bulanan murni (kecuali deposit/addon), dan default acuan Menara Bank Mega Tendean.
- [x] **Riset Direktori Sheet/Doc Terpisah, Katalog Privat Server, CRUD File & Pagination 20/Hal** — Pemisahan mode `Riset Sheet & Doc` (`/api/resources/*`, `hasil/resources/`), katalog URL privat server-side (`hasil/resource_catalog.json`), filter kategori sheet di Pengaturan, mode simpan `replace`/`merge`/`archive`, hapus file riwayat, batas custom `1–300`, dan pagination 20 item per halaman.
- [x] **Ekstraksi Foto Tempat & Ulasan Google Maps (`v2.0.4`)** — Resolusi `places.photos` (`photoUri` bebas API key) dan XHR/DOM place + review attachments via headless Chrome (`=w960-h720-k-no`), anti-bleed antar hasil pencarian, filter avatar & 404 Street View, auto-refresh cache lama tanpa `"photos"`, serta `referrerPolicy="no-referrer"` + badge `Foto Google Maps` pada kartu & galeri detail.
- [ ] **99.co adapter** — Terblokir verifikasi bot Cloudflare (`HTTP 403`); tidak di-bypass.
- [ ] **Google Sheets export** — Push hasil ke spreadsheet via OAuth (`credentials.json` terisolasi `.env`).
- [ ] **Monitoring harian (cron / launchd / Task Scheduler)** — Diff hasil run harian & kirim notifikasi kos baru.

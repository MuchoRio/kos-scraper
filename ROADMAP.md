# Roadmap

- [x] **Sewakost adapter hardening** — Scoped `lxml` DOM parser (`df_field_*`), perbaikan bug `price_text` & sidebar price bleed, retry + backoff/jitter, CLI `--sort`/`--order`.
- [x] **Rukita adapter** — `rukita.co/kost/<area>` SSR + Schema.org `LodgingBusiness` JSON-LD (`geo`, `priceRange`, fasilitas).
- [x] **Mamikos, Infokost, & Cove adapters** — SSR listing & JSON `__NEXT_DATA__` parsers + round-robin fairness antar sumber.
- [x] **Google Maps Rating, Sentimen & Anti-Penipuan** — Places API (New) + fallback Chrome lokal, clue harga dari ulasan, & deteksi dua lapis risiko penipuan (`fraud_detector.py`).
- [x] **Geocoding + jarak** — Haversine distance + cached OSM Nominatim (`scraper/geo.py`, 1.1 req/s).
- [x] **Cross-platform workflow & Bento Grid Web Studio** — Pengganti `kos_hunt.sh` bash-only (`scraper/runner.py`), Node/Express SSE queue (`server/`), dan React/Vite Bento Grid UI (`client/`).
- [x] **Multi-thread concurrency & Progressive Disclosure UI** — Paralelisme list & detail worker (`ThreadPoolExecutor`), **Filter Lanjutan Modal**, deteksi atribut kos Indonesia, jarak transum terdekat (`HALTE BUSWAY | MRT | KRL | LRT | MALL`), fasilitas Kamar vs Gedung ber-ikon, & galeri multi-foto.
- [ ] **99.co adapter** — Terblokir verifikasi bot Cloudflare (`HTTP 403`); tidak di-bypass.
- [ ] **Google Sheets export** — Push hasil ke spreadsheet via OAuth (`credentials.json` terisolasi `.env`).
- [ ] **Monitoring harian (cron / launchd / Task Scheduler)** — Diff hasil run harian & kirim notifikasi kos baru.

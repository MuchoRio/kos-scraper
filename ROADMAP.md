# Roadmap

- [ ] **Mamikos adapter** — listing page JS-rendered; butuh Playwright/Chromium. Probe: HTML awal cuma 92KB, list dimuat via JS bundle (`landing-kost.*.js`), belum ketemu endpoint API publik.
- [ ] **Rukita adapter** — `rukita.co/kost/<area>` SSR (1.3MB HTML, 30 link `/place/...` per halaman). Detail `/place/<slug>` ada harga + fasilitas. Paling gampang kedua setelah sewakost.
- [ ] **99.co adapter** — butuh probe ulang (kemarin fetch gagal).
- [ ] **Google Sheets export** — push CSV → spreadsheet via OAuth (`google-workspace` skill). Status: nunggu setup OAuth user.
- [ ] **Monitoring harian (cron)** — jalanin `kos_hunt.sh` tiap 08:00 WIB, diff vs kemarin, kirim yg baru ke Telegram.
- [ ] **Geocoding + jarak** — tiap hasil ditempelin lat/lon + jarak ke titik (kantor/kampus) via `maps` skill (OSM, gratis).

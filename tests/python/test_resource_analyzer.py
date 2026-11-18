"""Offline unit tests for separated Google Sheet & Doc directory parser & runner."""

from __future__ import annotations

import pathlib
import tempfile
import unittest
from unittest.mock import patch

from scraper.resource_parser import (
    compute_resource_stats,
    extract_coords_from_maps_url,
    filter_and_rank_rows,
    load_google_resource,
    parse_google_resource_url,
)
from scraper.resource_runner import run_resource_analysis


class TestResourceParserAndRunner(unittest.TestCase):
    def test_validates_google_urls_and_rejects_arbitrary_hosts(self) -> None:
        sheet = parse_google_resource_url(
            "https://docs.google.com/spreadsheets/d/1VwTJymN8n-h3CZwAuFu5kdNdwsUvZBoRuBOVDAZl7Jc/edit?gid=0#gid=0"
        )
        self.assertEqual(sheet["kind"], "sheet")
        self.assertEqual(sheet["gid"], "0")

        doc = parse_google_resource_url(
            "https://docs.google.com/document/d/1j2J67Y5BrGZji9bRR3zkCcucEzEEK3LdR-E1jfKKldc/edit?tab=t.sbuhwwmpwo3p"
        )
        self.assertEqual(doc["kind"], "doc")

        with self.assertRaises(ValueError):
            parse_google_resource_url("https://169.254.169.254/latest/meta-data/")

    def test_parses_kostpedia_19col_filters_placeholders_and_dedups(self) -> None:
        sample_csv = "\n".join([
            "checklist_kost,ID Kost,Nama Kost,Harga/Bulan,Nomor Kontak,Kualitas Kost,Kategori Harga,Status Ketersediaan,Gender,Status Pet Friendly,Alamat,Kelurahan,Kecamatan,Kota,Provinsi,Fasilitas,Deskripsi,URL G - Maps,URL Foto/Video",
            'FALSE,KST-1,Kost  Tebet,Rp1.219.000,81316059370,Belum diisi (akan diperbarui),💸 Kost Murah,🟢 Kost Tersedia ,👫 Kost Campur,Belum diisi (akan diperbarui),"Jl. Tebet Barat VIII No. 19",Tebet,Tebet,🌳 Jakarta Selatan,DKI,"WiFi, AC, Kamar Mandi Dalam","Deskripsi tes",https://www.google.com/maps/place/?q=place_id:ChIJ008hUHnzaS4RP63k0506oPg,"https://lh5.googleusercontent.com/p/IMG1 https://vt.tiktok.com/ZSH/"',
            'FALSE,KST-2,Kost  Tebet,Rp1.219.000,81316059370,Belum diisi (akan diperbarui),💸 Kost Murah,🟢 Kost Tersedia ,👫 Kost Campur,Belum diisi (akan diperbarui),"Jl. Tebet Barat VIII No. 19",Tebet,Tebet,🌳 Jakarta Selatan,DKI,"WiFi, AC","Duplikat",Belum diisi,https://maps.app.goo.gl/abc',
            'FALSE,KST-3,Kost Penuh,Rp900.000,81200000001,👍 Worth It,💸 Kost Murah,🔴 Kost Penuh,👩 Kost Wanita,🚫 Tidak Pet Friendly,"Jl. Mampang",Mampang,Mampang Prapatan,🌳 Jakarta Selatan,DKI,"WiFi","Penuh",https://maps.google.com?q=-6.245,106.829,Belum diisi',
        ])
        sheet_url = "https://docs.google.com/spreadsheets/d/1VwTJymN8n-h3CZwAuFu5kdNdwsUvZBoRuBOVDAZl7Jc/edit?gid=0"
        with patch("scraper.resource_parser._fetch_text", return_value=sample_csv):
            loaded = load_google_resource(sheet_url)
        self.assertEqual(loaded["schema"], "kostpedia_19col")
        stats = compute_resource_stats(loaded)
        self.assertEqual(stats["total_rows"], 3)
        self.assertEqual(stats["duplicate_rows"], 1)

        # Ensure only lh5.googleusercontent.com photo kept, NOT vt.tiktok.com or maps.app.goo.gl
        row1 = loaded["rows"][0]
        self.assertEqual(row1["image_urls"], ["https://lh5.googleusercontent.com/p/IMG1"])
        self.assertEqual(row1["wa_link"], "https://wa.me/6281316059370")
        self.assertEqual(row1["kategori_harga"], "Kost Murah")

        # Filter available <= 1.5jt in jakarta-selatan with deduplication
        filtered, dups = filter_and_rank_rows(
            loaded["rows"], area="jakarta-selatan", max_price=1_500_000, only_available=True, deduplicate=True
        )
        self.assertEqual(dups, 1)
        self.assertEqual([r["title"] for r in filtered], ["Kost Tebet"])

        # Strict availability & category/pet filters
        strict_rows, _ = filter_and_rank_rows(
            loaded["rows"], area="jakarta-selatan", availability="strict_available", price_category="murah", gender="campur"
        )
        self.assertEqual([r["title"] for r in strict_rows], ["Kost Tebet"])
        no_pet_rows, _ = filter_and_rank_rows(
            loaded["rows"], area="jakarta-selatan", availability="all", pet="no_pet", quality="worth_it"
        )
        self.assertEqual([r["title"] for r in no_pet_rows], ["Kost Penuh"])

        # Inline q=lat,lon coordinate parsing
        lat, lon = extract_coords_from_maps_url("https://maps.google.com/maps?q=-6.17144%2C106.78389")
        self.assertAlmostEqual(lat or 0.0, -6.17144, places=4)
        self.assertAlmostEqual(lon or 0.0, 106.78389, places=4)

    def test_run_resource_analysis_writes_under_separated_resources_subdir(self) -> None:
        mini_csv = "\n".join([
            "No,Nama Kost,WA Kontak",
            "1,Kost Bima Mampang,+62 812‑8070‑6804",
        ])
        url = "https://docs.google.com/spreadsheets/d/1GRGV53lLVkzj7jfEHk3tHO1AjuHk4AC0ZMS3LYW8Wuo/edit?gid=0"
        with tempfile.TemporaryDirectory() as tmp:
            out_dir = pathlib.Path(tmp)
            with patch("scraper.resource_parser._fetch_text", return_value=mini_csv):
                res = run_resource_analysis(
                    url=url,
                    area="jakarta-selatan",
                    max_price=None,
                    details_limit=5,
                    include_unpriced=True,
                    geocode=False,
                    gmaps=False,
                    out_dir=out_dir,
                )
            self.assertEqual(res["kind"], "resource")
            self.assertEqual(res["detail_count"], 1)
            self.assertEqual(res["files"]["detail_json"], "resource_detail_latest.json")
            self.assertEqual(res["files"]["csv"], "resource_hasil_latest.csv")
            self.assertTrue((out_dir / "resources" / res["files"]["detail_json"]).exists())
            self.assertTrue((out_dir / "resources" / res["files"]["csv"]).exists())


if __name__ == "__main__":
    unittest.main()


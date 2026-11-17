"""Offline fixture unit tests for sewakost and rukita adapters."""

from __future__ import annotations

import pathlib
import unittest

from scraper.adapters import RukitaAdapter, SewakostAdapter
from scraper.models import format_idr, normalize_wa_link, parse_price

FIXTURES = pathlib.Path(__file__).resolve().parents[1] / "fixtures"


class TestModelsAndPrices(unittest.TestCase):
    def test_price_parsing_variants(self) -> None:
        self.assertEqual(parse_price("Rp 650.000"), 650000)
        self.assertEqual(parse_price("Rp 2.480.000"), 2480000)
        self.assertEqual(parse_price("2,5 jt"), 2500000)
        self.assertEqual(parse_price("850 rb"), 850000)
        self.assertEqual(parse_price("Rp 2"), 2)
        self.assertEqual(parse_price("Rp 650.0001.000.000"), 650000)
        self.assertIsNone(parse_price("Hubungi"))
        self.assertEqual(format_idr(650000), "Rp 650.000")

    def test_wa_normalization(self) -> None:
        self.assertEqual(normalize_wa_link("0812-3456-7890"), "https://wa.me/6281234567890")
        self.assertEqual(normalize_wa_link("+62 818 321 093"), "https://wa.me/62818321093")
        self.assertIsNone(normalize_wa_link("123"))


class TestSewakostAdapter(unittest.TestCase):
    def setUp(self) -> None:
        self.adapter = SewakostAdapter()

    def test_list_page_parses_cards_and_pagination(self) -> None:
        html = (FIXTURES / "sewakost_list.html").read_text(encoding="utf-8")
        items, has_next, _ = self.adapter.list_page(area="jakarta-selatan", max_price=1000000, html=html)
        self.assertGreaterEqual(len(items), 10)
        self.assertTrue(has_next)
        self.assertTrue(all(it["source"] == "sewakost" for it in items))
        self.assertTrue(any(it.get("listing_price") == 1000000 for it in items))

    def test_detail_normal_extracts_all_df_fields(self) -> None:
        html = (FIXTURES / "sewakost_detail_normal.html").read_text(encoding="utf-8")
        detail = self.adapter.parse_detail(
            "https://www.sewakost.com/kost/jakarta/jakarta-selatan/kos-khusus-perempuan-dekat-stasiun-mrt-cipete-201495/",
            html=html,
        )
        self.assertEqual(detail.price, 650000)
        self.assertEqual(detail.price_text, "Rp 650.000")
        self.assertFalse(detail.price_suspect)
        self.assertEqual(detail.jenis, "Kost Putri")
        self.assertEqual(detail.kecamatan, "Cilandak")
        self.assertEqual(detail.kelurahan, "Gandaria Selatan")
        self.assertIn("Kamar Mandi Dalam", detail.fasilitas_list)
        self.assertIn("Parkir Motor", detail.fasilitas_list)
        self.assertEqual(detail.wa, "081200000001")
        self.assertEqual(detail.wa_link, "https://wa.me/6281200000001")

    def test_detail_suspect_price_prevents_sidebar_bleed(self) -> None:
        html = (FIXTURES / "sewakost_detail_suspect_price.html").read_text(encoding="utf-8")
        detail = self.adapter.parse_detail(
            "https://www.sewakost.com/kost/jakarta/jakarta-selatan/kost-petogogan-panglima-polim-jakarta-selatan-181192/",
            html=html,
        )
        # Must NOT grab Rp 190.000 from related listing cards outside #area_listing
        self.assertNotEqual(detail.price, 190000)
        self.assertEqual(detail.price_options, [])
        self.assertTrue(detail.price_suspect)

    def test_detail_suspect_price_uses_listing_card_fallback_when_available(self) -> None:
        html = (FIXTURES / "sewakost_detail_suspect_price.html").read_text(encoding="utf-8")
        detail = self.adapter.parse_detail(
            "https://www.sewakost.com/kost/jakarta/jakarta-selatan/kost-petogogan-panglima-polim-jakarta-selatan-181192/",
            html=html,
            listing_hint={"listing_price": 2400000},
        )
        self.assertEqual(detail.price, 2400000)
        self.assertEqual(detail.price_text, "Rp 2.400.000")
        self.assertFalse(detail.price_suspect)
        self.assertEqual(detail.price_source, "listing_card")


class TestRukitaAdapter(unittest.TestCase):
    def setUp(self) -> None:
        self.adapter = RukitaAdapter()

    def test_list_page_extracts_rukita_cards(self) -> None:
        html = (FIXTURES / "rukita_list.html").read_text(encoding="utf-8")
        items, has_next, _ = self.adapter.list_page(area="jakarta-selatan", html=html)
        self.assertGreaterEqual(len(items), 10)
        self.assertTrue(has_next)
        self.assertTrue(all(it["source"] == "rukita" for it in items))
        self.assertTrue(any(it["slug"] == "aruna-pejaten" for it in items))

    def test_detail_parses_json_ld_geo_and_facilities(self) -> None:
        html = (FIXTURES / "rukita_detail.html").read_text(encoding="utf-8")
        detail = self.adapter.parse_detail("https://www.rukita.co/place/aruna-pejaten", html=html)
        self.assertEqual(detail.title, "Rukita Aruna Pejaten")
        self.assertEqual(detail.price, 2618000)
        self.assertEqual(detail.price_text, "Rp 2.618.000")
        self.assertFalse(detail.price_suspect)
        self.assertAlmostEqual(detail.lat or 0, -6.2767, places=3)
        self.assertAlmostEqual(detail.lon or 0, 106.8340, places=3)
        self.assertIn("Wifi", detail.fasilitas_list)
        self.assertEqual(detail.jenis, "Kost Putri")


if __name__ == "__main__":
    unittest.main()

"""Unit tests for safe CSV exporter and cached geo calculations."""

from __future__ import annotations

import csv
import tempfile
import unittest
from pathlib import Path

from scraper.exporters import CSV_FIELDNAMES, sanitize_csv_cell, write_csv
from scraper.geo import Geocoder, build_geocode_query, haversine_km


class _NoCallClient:
    def get(self, *_args, **_kwargs):
        raise AssertionError("Should not invoke HTTP when geo cache hits")


class TestCsvExporter(unittest.TestCase):
    def test_formula_injection_neutralized(self) -> None:
        self.assertEqual(sanitize_csv_cell("=CMD()"), "'=CMD()")
        self.assertEqual(sanitize_csv_cell("+62812"), "'+62812")
        self.assertEqual(sanitize_csv_cell("-100"), "'-100")
        self.assertEqual(sanitize_csv_cell("@SUM(A1)"), "'@SUM(A1)")
        self.assertEqual(sanitize_csv_cell("Kos Aman"), "Kos Aman")

    def test_write_csv_handles_empty_items_without_index_error(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "empty.csv"
            write_csv([], out)
            with out.open("r", encoding="utf-8-sig", newline="") as fh:
                rows = list(csv.reader(fh))
            self.assertEqual(rows, [CSV_FIELDNAMES])

    def test_write_csv_sorts_normal_prices_first_and_masks_contact(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "masked.csv"
            items = [
                {"source": "sewakost", "title": "=B", "price": 2, "price_suspect": True, "url": "u2"},
                {"source": "rukita", "title": "A", "price": 900000, "price_suspect": False, "wa": "081234567890", "wa_link": "https://wa.me/6281234567890", "url": "u1"},
            ]
            write_csv(items, out, mask_contact=True)
            with out.open("r", encoding="utf-8-sig", newline="") as fh:
                rows = list(csv.DictReader(fh))
            self.assertEqual(len(rows), 2)
            self.assertEqual(rows[0]["nama"], "A")
            self.assertEqual(rows[0]["wa"], "0812-••••-7890")
            self.assertEqual(rows[0]["wa_link"], "")
            self.assertEqual(rows[1]["nama"], "'=B")


class TestGeo(unittest.TestCase):
    def test_haversine_known_distance(self) -> None:
        # Blok M to Cipete Raya (~3.8 km)
        dist = haversine_km(-6.2443, 106.7981, -6.2784, 106.7973)
        self.assertGreater(dist, 3.0)
        self.assertLess(dist, 4.5)

    def test_build_query_and_cache_hit(self) -> None:
        q = build_geocode_query({"kelurahan": "Gandaria Selatan", "kecamatan": "Cilandak"})
        self.assertEqual(q, "Gandaria Selatan, Cilandak, Indonesia")
        with tempfile.TemporaryDirectory() as tmp:
            cache_file = Path(tmp) / "geo.json"
            cache_file.write_text('{"gandaria selatan, cilandak, indonesia": {"lat": -6.27, "lon": 106.79}}', encoding="utf-8")
            geo = Geocoder(cache_path=cache_file, client=_NoCallClient())
            item = {"kelurahan": "Gandaria Selatan", "kecamatan": "Cilandak"}
            geo.enrich_distance(item, -6.2443, 106.7981, allow_remote=True)
            self.assertAlmostEqual(item["lat"], -6.27)
            self.assertIsNotNone(item["distance_km"])


if __name__ == "__main__":
    unittest.main()


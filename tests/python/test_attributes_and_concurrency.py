"""Unit tests for Indonesian kos semantic attributes and bounded multi-thread runner."""

from __future__ import annotations

import threading
import time
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from scraper.attributes import extract_kos_attributes
from scraper.runner import enrich_details, scrape_listings


class TestKosAttributes(unittest.TestCase):
    def test_freedom_and_negation_rules(self) -> None:
        texas = extract_kos_attributes({
            "title": "Kost Eksklusif Kemang",
            "deskripsi": "Bebas akses 24 jam tanpa jam malam, strategis",
            "fasilitas_list": ["Free WiFi", "AC", "Kamar Mandi Dalam", "Dapur Bersama"],
            "price": 2_800_000,
        })
        self.assertEqual(texas["freedom"], "texas")
        self.assertEqual(texas["price_tier"], "exclusive")
        self.assertEqual(texas["bathroom"], "dalam")
        self.assertEqual(texas["kitchen"], "yes")
        self.assertTrue(texas["wifi"])
        self.assertTrue(texas["ac"])

        sopan = extract_kos_attributes({
            "title": "Kost Putri Cipete",
            "jenis": "Kost Putri",
            "deskripsi": "Bebas sopan, dekat Stasiun MRT Cipete, dilarang bawa hewan, tidak ada dapur",
            "fasilitas_list": ["Kamar Mandi Luar"],
            "peraturan": ["Jam malam: Ya"],
            "price": 900_000,
        })
        self.assertEqual(sopan["freedom"], "non_texas")
        self.assertEqual(sopan["pet"], "no_pet")
        self.assertEqual(sopan["pasutri"], "non_pasutri")
        self.assertTrue(sopan["transum"])
        self.assertEqual(sopan["bathroom"], "luar")
        self.assertEqual(sopan["kitchen"], "no")
        self.assertEqual(sopan["price_tier"], "under_1m")

    def test_pet_variants_and_pasutri(self) -> None:
        cat_only = extract_kos_attributes({
            "title": "Kost Blok M",
            "deskripsi": "Cat only (khusus kucing saja), boleh pasutri resmi",
            "fasilitas": "WiFi, AC",
            "price": 1_800_000,
        })
        self.assertEqual(cat_only["pet"], "cat_only")
        self.assertEqual(cat_only["pasutri"], "pasutri")
        self.assertEqual(cat_only["price_tier"], "mid")

        all_pets = extract_kos_attributes({
            "title": "Kost Mampang",
            "deskripsi": "Pet friendly boleh bawa kucing dan dog friendly",
            "price": 1_400_000,
        })
        self.assertEqual(all_pets["pet"], "all_pets")

        negated_pet = extract_kos_attributes({
            "title": "Kost Tebet",
            "deskripsi": "Tidak boleh bawa kucing atau anjing",
            "peraturan": ["Dilarang bawa hewan peliharaan"],
            "price": 1_200_000,
        })
        self.assertEqual(negated_pet["pet"], "no_pet")

        sheet_neg_pet = extract_kos_attributes({
            "title": "Kost Kuningan",
            "peraturan": ["Tidak Pet Friendly", "Status: Kost Tersedia"],
            "price": 1_300_000,
        })
        self.assertEqual(sheet_neg_pet["pet"], "no_pet")


class TestConcurrentRunner(unittest.TestCase):
    def test_concurrent_enrich_preserves_order_and_is_thread_safe(self) -> None:
        lock = threading.Lock()
        active = 0
        peak_active = 0

        class _SlowAdapter:
            def parse_detail(self, url: str, listing_hint: dict | None = None) -> SimpleNamespace:
                nonlocal active, peak_active
                with lock:
                    active += 1
                    peak_active = max(peak_active, active)
                time.sleep(0.05)
                with lock:
                    active -= 1
                hint = listing_hint or {}
                idx = int(str(hint.get("slug", "kos-0")).split("-")[1])
                rec = {
                    **hint,
                    "url": url,
                    "title": f"Kos {idx}",
                    "price": 950_000,
                    "price_suspect": False,
                    "deskripsi": "Dekat MRT dan free wifi, akses 24 jam",
                    "fasilitas_list": ["Free WiFi", "Kamar Mandi Dalam"],
                }
                return SimpleNamespace(to_dict=lambda: rec)

        candidates = [
            {"source": "sewakost", "url": f"https://example.com/{i}", "slug": f"kos-{i}", "area_match": ["cipete"]}
            for i in range(8)
        ]
        events: list[dict] = []

        t0 = time.monotonic()
        with (
            patch("scraper.runner.PoliteHttpClient", return_value=object()),
            patch("scraper.runner.get_adapter", return_value=_SlowAdapter()),
        ):
            out = enrich_details(
                candidates,
                details_limit=8,
                concurrency=4,
                geocode=False,
                gmaps=False,
                progress_cb=events.append,
            )
        elapsed = time.monotonic() - t0

        self.assertEqual(len(out), 8)
        self.assertEqual([item["slug"] for item in out], [f"kos-{i}" for i in range(8)])
        self.assertGreaterEqual(peak_active, 2)
        self.assertLess(elapsed, 0.35)
        self.assertEqual(out[0]["attributes"]["freedom"], "texas")
        self.assertTrue(out[0]["attributes"]["transum"])
        self.assertEqual(len([ev for ev in events if ev.get("type") == "item"]), 8)

    def test_scrape_listings_runs_sources_in_parallel(self) -> None:
        class _FakeSrcAdapter:
            def __init__(self, name: str) -> None:
                self.name = name

            def list_page(self, **_kwargs) -> tuple[list[dict], bool, None]:
                time.sleep(0.05)
                return (
                    [{"source": self.name, "url": f"https://{self.name}.test/1", "slug": f"{self.name}-1"}],
                    False,
                    None,
                )

        with (
            patch("scraper.pipeline_workers.PoliteHttpClient", return_value=object()),
            patch("scraper.runner.PoliteHttpClient", return_value=object()),
            patch("scraper.pipeline_workers.get_adapter", side_effect=lambda name, client=None: _FakeSrcAdapter(name)),
        ):
            items = scrape_listings(
                sources=["sewakost", "rukita", "mamikos", "infokost"],
                area="jakarta-selatan",
                max_pages=1,
            )
        self.assertEqual(len(items), 4)
        self.assertEqual({it["source"] for it in items}, {"sewakost", "rukita", "mamikos", "infokost"})


class TestTransitProximity(unittest.TestCase):
    def test_computes_nearest_jakarta_transit_stops_from_coordinates(self) -> None:
        from scraper.transit import compute_nearby_transit

        # Near Duren Tiga / Mampang Prapatan
        res = compute_nearby_transit(-6.2528, 106.8273)
        self.assertIsNotNone(res)
        assert res is not None
        self.assertEqual(res["nearest"]["category"], "busway")
        self.assertIn("Duren Tiga", res["nearest"]["name"])
        self.assertLess(res["nearest"]["distance_km"], 0.2)
        self.assertGreaterEqual(len(res["categories"]["mrt"]), 1)
        self.assertIsNone(compute_nearby_transit(None, None))

    def test_dedup_image_urls_filters_relative_and_duplicates(self) -> None:
        from scraper.models import LANDMARK_REFS, dedup_image_urls
        from scraper.transit import compute_nearby_transit

        self.assertEqual(LANDMARK_REFS[0]["id"], "bank-mega")
        near_mega = compute_nearby_transit(-6.2409, 106.8302)
        self.assertIsNotNone(near_mega)
        assert near_mega is not None
        self.assertIn("Tendean", near_mega["nearest"]["name"])

        urls = dedup_image_urls([
            "https://img.example/1.jpg",
            "https://img.example/1.jpg",
            "/relative.jpg",
            "https://img.example/2.jpg",
            None,
        ])
        self.assertEqual(urls, ["https://img.example/1.jpg", "https://img.example/2.jpg"])


if __name__ == "__main__":
    unittest.main()

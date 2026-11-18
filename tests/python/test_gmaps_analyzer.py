"""Unit tests for Google Maps review sentiment analysis and price-clue extraction."""

from __future__ import annotations

import json
import tempfile
import unittest
from io import BytesIO
from pathlib import Path
from unittest.mock import patch

from scraper.gmaps import GoogleMapsEnricher, build_gmaps_query, resolve_places_photo_uri
from scraper.gmaps_analyzer import analyze_reviews, classify_review, extract_review_price_clues


class TestGmapsAnalyzer(unittest.TestCase):
    def test_extracts_realistic_indonesian_price_clues_and_ignores_noise(self) -> None:
        text = (
            "Kost ini bersih banget, kamar AC nyaman. Waktu 2024 saya bayar 1,5 jt/bln, "
            "jalan kaki 5 menit ke MRT. Ada juga kamar kipas mulai 850rb."
        )
        clues = extract_review_price_clues(text)
        amounts = [c["amount"] for c in clues]
        self.assertEqual(amounts, [1500000, 850000])
        # Must NOT misparse year 2024 or "5 menit" as monthly rent
        self.assertNotIn(2024, amounts)
        self.assertNotIn(5, amounts)

    def test_sejuta_and_plain_rp_price_clues(self) -> None:
        clues = extract_review_price_clues("Harga sewa per bulan sejutaan, temenku bayar Rp 1.250.000")
        amounts = [c["amount"] for c in clues]
        self.assertIn(1000000, amounts)
        self.assertIn(1250000, amounts)

    def test_classifies_positive_negative_and_builds_summary(self) -> None:
        reviews = [
            {
                "author": "Budi",
                "rating": 5,
                "relative_time": "2 bulan lalu",
                "text": "Kamar bersih, wangi, penjaga ramah, dekat MRT. Bayar 1.6jt per bulan.",
            },
            {
                "author": "Sari",
                "rating": 2,
                "relative_time": "seminggu lalu",
                "text": "Air mati sering pas pagi, kamar agak lembab dan bau, parkir susah buat mobil.",
            },
            {
                "author": "Andi",
                "rating": 4,
                "relative_time": "1 bulan lalu",
                "text": "Nyaman tapi agak berisik pas malam karena dekat jalan raya. Sewa 1,4 jt.",
            },
        ]
        summary = analyze_reviews(reviews)
        self.assertEqual(len(summary["positive_reviews"]), 2)  # Budi (pos) + Andi (mixed)
        self.assertEqual(len(summary["negative_reviews"]), 2)  # Sari (neg) + Andi (mixed)
        self.assertEqual(summary["review_price_estimate"], 1500000)  # median of 1.6M & 1.4M
        self.assertEqual(summary["review_price_estimate_text"], "Rp 1.500.000")
        neg_tags = {t["tag"] for t in summary["cons_summary"]}
        self.assertIn("Air / Listrik", neg_tags)
        self.assertIn("Parkir Terbatas", neg_tags)
        self.assertEqual(classify_review(reviews[0])["sentiment"], "positive")


class TestGmapsEnricher(unittest.TestCase):
    def test_enrich_uses_cache_and_populates_price_estimate(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            cache_path = Path(tmp) / "gmaps.json"
            api_payload = {
                "status": "ok",
                "engine": "places_api",
                "place_name": "Kost Kenanga Cipete",
                "rating": 4.7,
                "review_count": 18,
                "limited_view": False,
                "maps_url": "https://maps.google.com/?cid=123",
                "lat": -6.278,
                "lon": 106.797,
                "reviews": [
                    {"author": "Rina", "rating": 5, "relative_time": "baru", "text": "Bersih dan nyaman, harga 1,2jt/bln"},
                    {"author": "Dian", "rating": 2, "relative_time": "lama", "text": "Agak berisik malam hari"},
                ],
            }
            enricher = GoogleMapsEnricher(api_key="TEST_KEY", cache_path=cache_path, min_delay=0)
            record = {
                "title": "Kost Kenanga",
                "kelurahan": "Cipete Selatan",
                "kecamatan": "Cilandak",
                "price": None,
                "price_suspect": True,
            }
            with patch("scraper.gmaps.fetch_places_api", return_value=api_payload) as mock_api:
                enriched = enricher.enrich_item(record, ref_lat=-6.2443, ref_lon=106.7981)
                self.assertEqual(mock_api.call_count, 1)
                self.assertEqual(enriched["gmaps"]["rating"], 4.7)
                self.assertEqual(enriched["price_estimate_from_reviews"], 1200000)
                self.assertIsNotNone(enriched["distance_km"])

                # Second call must hit local cache without calling Places API again
                record2 = dict(record)
                enricher2 = GoogleMapsEnricher(api_key="TEST_KEY", cache_path=cache_path, min_delay=0)
                enricher2.enrich_item(record2)
                self.assertEqual(mock_api.call_count, 1)
                self.assertEqual(record2["gmaps"]["rating"], 4.7)

    def test_build_gmaps_query_includes_jakarta_fallback(self) -> None:
        q = build_gmaps_query({"title": "Kost Mawar", "kecamatan": "Cilandak"})
        self.assertIn("Kost Mawar", q)
        self.assertIn("Jakarta", q)

    def test_enrich_populates_gmaps_photos_and_preserves_listing_primary(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            cache_path = Path(tmp) / "gmaps.json"
            browser_payload = {
                "status": "ok",
                "engine": "chrome_browser",
                "place_name": "KOST NINGSIH",
                "rating": 5.0,
                "review_count": 3,
                "limited_view": True,
                "maps_url": "https://www.google.com/maps/place/KOST+NINGSIH/@-6.24,106.82,17z",
                "lat": -6.2416,
                "lon": 106.8248,
                "photos": [
                    "https://lh3.googleusercontent.com/grass-cs/AABkmTestPhoto1234567890=w960-h720-k-no",
                    "https://streetviewpixels-pa.googleapis.com/v1/thumbnail?panoid=abc",
                    "https://lh3.googleusercontent.com/a/avatar123=s32",
                ],
                "reviews": [],
            }
            enricher = GoogleMapsEnricher(cache_path=cache_path, min_delay=0)
            with patch("scraper.gmaps.fetch_browser_gmaps", return_value=browser_payload):
                no_photo_rec = {"title": "Kost Ningsih", "kecamatan": "Mampang Prapatan"}
                enricher.enrich_item(no_photo_rec)
                self.assertEqual(no_photo_rec["image_source"], "google_maps")
                self.assertEqual(
                    no_photo_rec["image_urls"],
                    ["https://lh3.googleusercontent.com/grass-cs/AABkmTestPhoto1234567890=w960-h720-k-no"],
                )
                self.assertEqual(no_photo_rec["image_url"], no_photo_rec["image_urls"][0])

                with_photo_rec = {
                    "title": "Kost Ningsih",
                    "kecamatan": "Mampang Prapatan",
                    "image_url": "https://cdn.example.com/kamar.jpg",
                    "image_urls": ["https://cdn.example.com/kamar.jpg"],
                }
                enricher.enrich_item(with_photo_rec)
                self.assertEqual(with_photo_rec["image_source"], "listing")
                self.assertEqual(with_photo_rec["image_url"], "https://cdn.example.com/kamar.jpg")
                self.assertEqual(len(with_photo_rec["image_urls"]), 2)

    def test_resolve_places_photo_uri_rejects_leaked_key(self) -> None:
        class _FakeResp(BytesIO):
            def __enter__(self):
                return self

            def __exit__(self, *args):
                return False

        clean_body = json.dumps({"photoUri": "https://lh3.googleusercontent.com/places/CLEAN=w960"}).encode()
        leaked_body = json.dumps({"photoUri": "https://example.com/img?key=MY_SECRET_KEY"}).encode()
        with patch("urllib.request.urlopen", side_effect=[_FakeResp(clean_body), _FakeResp(leaked_body)]):
            self.assertEqual(
                resolve_places_photo_uri("places/P1/photos/PH1", "MY_SECRET_KEY"),
                "https://lh3.googleusercontent.com/places/CLEAN=w960",
            )
            self.assertIsNone(resolve_places_photo_uri("places/P1/photos/PH2", "MY_SECRET_KEY"))


if __name__ == "__main__":
    unittest.main()


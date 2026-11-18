"""Unit tests for Mamikos, Infokost, Cove adapters, round-robin fairness, and scam detector."""

from __future__ import annotations

import pathlib
import unittest

from scraper.adapters import CoveAdapter, InfokostAdapter, MamikosAdapter, SewakostAdapter
from scraper.adapters.infokost import resolve_infokost_areas
from scraper.fraud_detector import assess_scam_risk
from scraper.runner import interleave_by_source

FIXTURES = pathlib.Path(__file__).resolve().parents[1] / "fixtures"


class TestNewAdapters(unittest.TestCase):
    def test_mamikos_ssr_list_and_hint_detail(self) -> None:
        html = (FIXTURES / "mamikos_list.html").read_text(encoding="utf-8")
        class _NoNetClient:
            def get(self, _url: str) -> str:
                raise RuntimeError("network disabled in unit test")

        adapter = MamikosAdapter(client=_NoNetClient())
        items, has_next, _ = adapter.list_page(area="jakarta-selatan", html=html)
        self.assertGreaterEqual(len(items), 15)
        self.assertFalse(has_next)
        self.assertTrue(all(it["source"] == "mamikos" for it in items))
        detail = adapter.parse_detail(items[0]["url"], listing_hint=items[0])
        self.assertIsNotNone(detail.price)
        self.assertGreaterEqual(detail.price or 0, 100_000)

    def test_infokost_list_and_detail_fixtures(self) -> None:
        list_html = (FIXTURES / "infokost_list.html").read_text(encoding="utf-8")
        detail_html = (FIXTURES / "infokost_detail.html").read_text(encoding="utf-8")
        adapter = InfokostAdapter()
        items, has_next, _ = adapter.list_page(area="jakarta-selatan", html=list_html)
        self.assertGreaterEqual(len(items), 5)
        self.assertTrue(has_next)
        detail = adapter.parse_detail("https://infokost.id" + "/listings/setiabudi-home-26-pocket-single-a-17119", html=detail_html)
        self.assertEqual(detail.price, 1500000)
        self.assertIn("Wifi", detail.fasilitas_list)
        self.assertIsNotNone(detail.lat)

    def test_infokost_blocks_carousel_bleed_and_proposed_placeholders(self) -> None:
        from scraper.models import dedup_image_urls

        proposed_html = """
        <html><body>
          <h1>Kost Proposed Tanpa Foto</h1>
          <a href="/listings/kost-proposed-1/media?media=photo">
            <img src="https://images.rukita.co/ais/2b5f0791-94da-45df-98a0-2362a3bf96a9.png"/>
          </a>
          <div class="scrollbar-hide">
            <a class="bg-noir-0" href="/listings/other-kost-99">
              <img src="https://images.rukita.co/buildings/roomvariantphoto/photo/other-room.jpg"/>
            </a>
          </div>
          <script>self.__next_f.push([1,"{\\"status\\":\\"5_PROPOSED\\",\\"address\\":\\"Jl. Kemang Baru 10, [106.82, -6.25]\\",\\"coordinate\\":{\\"latitude\\":\\"-6.2561\\",\\"longitude\\":\\"106.8178\\"},\\"commercialType\\":\\"NONE\\"},\\"assetDisplay\\":{\\"assetId\\":1,\\"assetMedias\\":[{\\"id\\":1,\\"type\\":\\"IMAGE\\",\\"url\\":\\"https://images.rukita.co/ais/2b5f0791-94da-45df-98a0-2362a3bf96a9.png\\"}]},\\"variantDisplay\\":{\\"variantId\\":2,\\"medias\\":[{\\"id\\":2,\\"type\\":\\"IMAGE\\",\\"url\\":\\"https://images.rukita.co/ais/2b5f0791-94da-45df-98a0-2362a3bf96a9.png\\"}]}"])</script>
        </body></html>
        """
        detail = InfokostAdapter().parse_detail(
            "https://infokost.id/listings/kost-proposed-1",
            html=proposed_html,
            listing_hint={"image_url": "https://images.rukita.co/ais/2b5f0791-94da-45df-98a0-2362a3bf96a9.png"},
        )
        self.assertEqual(detail.image_urls, [])
        self.assertIsNone(detail.image_url)
        self.assertEqual(detail.alamat, "Jl. Kemang Baru 10")
        self.assertAlmostEqual(detail.lat or 0.0, -6.2561, places=3)
        self.assertEqual(
            dedup_image_urls(["https://cdn.test/logo.svg", "https://cdn.test/real.jpg"]),
            ["https://cdn.test/real.jpg"],
        )

    def test_cove_next_data_list_and_detail_fixtures(self) -> None:
        list_html = (FIXTURES / "cove_list.html").read_text(encoding="utf-8")
        detail_html = (FIXTURES / "cove_detail.html").read_text(encoding="utf-8")
        adapter = CoveAdapter()
        items, _, _ = adapter.list_page(area="jakarta-selatan", html=list_html)
        self.assertEqual(len(items), 20)
        detail = adapter.parse_detail(items[0]["url"], html=detail_html, listing_hint=items[0])
        self.assertEqual(detail.price, 3850000)
        self.assertIn("Free WiFi", detail.fasilitas_list)
        self.assertIsNotNone(detail.deskripsi)

    def test_sewakost_min_price_skips_rp1_spam_and_infokost_expands_subdistricts(self) -> None:
        url = SewakostAdapter().build_list_url(area="jakarta-selatan", max_price=1500000, sort="default")
        self.assertIn("price:300000-1500000/", url)
        self.assertNotIn("sort_by=price", url)
        areas = resolve_infokost_areas("jakarta-selatan", ["kemang", "blok m", "cipete"])
        self.assertEqual(
            areas,
            [
                "mampang-prapatan-jakarta-selatan",
                "kebayoran-baru-jakarta-selatan",
                "cilandak-jakarta-selatan",
            ],
        )

    def test_mamikos_detail_json_extraction_and_offline_fallback(self) -> None:
        class _DummyClient:
            def __init__(self, body: str | None = None, boom: bool = False) -> None:
                self.body = body or ""
                self.boom = boom
                self.calls: list[str] = []

            def get(self, url: str) -> str:
                self.calls.append(url)
                if self.boom:
                    raise RuntimeError("offline")
                return self.body

        detail_payload = {
            "room_title": "Kost Kemang Timur 99",
            "address": "Jl. Kemang Timur No. 99, Mampang Prapatan",
            "area_city": "Kota Jakarta Selatan",
            "area_subdistrict": "Kecamatan Mampang Prapatan",
            "latitude": -6.2654,
            "longitude": 106.8192,
            "gender": 2,
            "price_monthly": 1350000,
            "description": "Kost bersih bebas 24 jam, boleh bawa kucing.",
            "remarks": "Dekat Halte Transjakarta",
            "owner_name": "Ibu Sari",
            "cards": [
                {"photo_url": {"large": "https://static.mamikos.com/img1-lg.jpg", "medium": "https://static.mamikos.com/img1-md.jpg"}},
                {"photo_url": {"medium": "https://static.mamikos.com/img2-md.jpg"}},
            ],
            "fac_room": ["AC", "Kasur"],
            "fac_bath": ["K. Mandi Dalam"],
            "fac_share": ["WiFi", "Dapur"],
            "fac_park": ["Parkir Motor"],
            "kos_rule": ["Akses 24 Jam"],
            "booking_rules": {"is_married": True, "is_bring_child": False},
        }
        import json as _json
        detail_html = f"<html><body><script>var detail = {_json.dumps(detail_payload)};</script></body></html>"
        client = _DummyClient(body=detail_html)
        adapter = MamikosAdapter(client=client)
        hint = {"title": "Hint Title", "listing_price": 1300000, "image_url": "https://static.mamikos.com/thumb.jpg"}
        listing = adapter.parse_detail("https://mamikos.com/room/kost-kemang-99", listing_hint=hint)
        self.assertEqual(client.calls, ["https://mamikos.com/room/kost-kemang-99"])
        self.assertEqual(listing.title, "Kost Kemang Timur 99")
        self.assertEqual(listing.price, 1350000)
        self.assertEqual(listing.price_source, "mamikos_detail_json")
        self.assertEqual(listing.jenis, "Kost Putri")
        self.assertEqual(listing.kecamatan, "Mampang Prapatan")
        self.assertEqual(listing.alamat, "Jl. Kemang Timur No. 99, Mampang Prapatan")
        self.assertAlmostEqual(listing.lat or 0.0, -6.2654, places=4)
        self.assertAlmostEqual(listing.lon or 0.0, 106.8192, places=4)
        self.assertEqual(listing.nama_pemilik, "Ibu Sari")
        self.assertIn("K. Mandi Dalam", listing.fasilitas_list)
        self.assertIn("Boleh Pasutri", listing.peraturan)
        self.assertIn("https://static.mamikos.com/img1-lg.jpg", listing.image_urls)
        self.assertIn("https://static.mamikos.com/img2-md.jpg", listing.image_urls)

        # Offline HTTP error still falls back gracefully when listing_hint has title
        offline_adapter = MamikosAdapter(client=_DummyClient(boom=True))
        fb = offline_adapter.parse_detail("https://mamikos.com/room/kost-kemang-99", listing_hint=hint)
        self.assertEqual(fb.title, "Hint Title")
        self.assertEqual(fb.price, 1300000)

    def test_mamikos_browser_pagination_and_no_404_slugs(self) -> None:
        from unittest.mock import patch
        from scraper.adapters.mamikos import resolve_mamikos_areas

        areas = resolve_mamikos_areas("jakarta-selatan", ["kemang", "jagakarsa", "blok m"])
        self.assertNotIn("jagakarsa-jakarta-selatan", areas)
        self.assertIn("mampang-jakarta-selatan", areas)

        fake_cards = [
            {
                "source": "mamikos",
                "url": f"https://mamikos.com/room/kost-{i}",
                "slug": f"kost-{i}",
                "title": f"Kost Test {i}",
                "listing_price": 800000 + i * 10000,
                "jenis": "Kost Campur",
                "kecamatan": "Mampang Prapatan",
                "fasilitas_list": ["WiFi"],
                "image_url": f"https://static.mamikos.com/p{i}.jpg",
                "is_featured": False,
            }
            for i in range(25)
        ]
        adapter = MamikosAdapter()
        with patch("scraper.adapters.mamikos.fetch_mamikos_browser", return_value=fake_cards) as mock_browser:
            p1, has_next1, _ = adapter.list_page(area="jakarta-selatan", max_price=1500000, page=1, keywords=["kemang"])
            p2, has_next2, _ = adapter.list_page(area="jakarta-selatan", max_price=1500000, page=2, keywords=["kemang"])
            self.assertEqual(mock_browser.call_count, 1)
            self.assertEqual(len(p1), 20)
            self.assertTrue(has_next1)
            self.assertEqual(len(p2), 5)
            self.assertFalse(has_next2)


class TestFairnessAndFraudDetector(unittest.TestCase):
    def test_interleave_prevents_source_starvation(self) -> None:
        raw = [{"source": "sewakost", "id": i} for i in range(10)] + [
            {"source": "rukita", "id": i} for i in range(10)
        ] + [{"source": "mamikos", "id": i} for i in range(10)]
        picked = interleave_by_source(raw)[:6]
        sources = [x["source"] for x in picked]
        self.assertEqual(sources, ["sewakost", "rukita", "mamikos", "sewakost", "rukita", "mamikos"])

    def test_scam_detector_flags_review_fraud_and_dp_pressure(self) -> None:
        risky_record = {
            "price": 300000,
            "price_suspect": False,
            "fasilitas": "AC, Kamar Mandi Dalam",
            "deskripsi": "Kamar mewah murah meriah, wajib DP dulu sebelum survei. Hubungi 081999999999",
            "wa": "081200000001",
            "gmaps": {
                "rating": 2.4,
                "review_count": 12,
                "negative_reviews": [
                    {"text": "Jangan kos disini, ini penipuan whatsapp palsu dan DP hangus!"},
                ],
                "positive_reviews": [],
            },
        }
        risk = assess_scam_risk(risky_record)
        self.assertEqual(risk["level"], "high")
        self.assertGreaterEqual(risk["score"], 60)
        self.assertTrue(risk["warning_quotes"])
        self.assertTrue(any("penipuan" in s.lower() for s in risk["signals"]))

    def test_scam_detector_flags_caution_survey_warning_as_medium(self) -> None:
        caution_record = {
            "price": 1500000,
            "price_suspect": False,
            "deskripsi": "Kos nyaman dekat halte.",
            "gmaps": {
                "rating": 4.0,
                "review_count": 8,
                "negative_reviews": [
                    {"text": "Kamar agak kecil, better survey dulu sebelum transfer."},
                ],
                "positive_reviews": [],
            },
        }
        risk = assess_scam_risk(caution_record)
        self.assertEqual(risk["level"], "medium")

    def test_clean_record_is_low_risk(self) -> None:
        clean = {
            "price": 1800000,
            "price_suspect": False,
            "deskripsi": "Kos bersih aman nyaman.",
            "wa": "081200000001",
            "gmaps": {"rating": 4.7, "review_count": 20, "negative_reviews": [], "positive_reviews": []},
        }
        self.assertEqual(assess_scam_risk(clean)["level"], "low")


if __name__ == "__main__":
    unittest.main()


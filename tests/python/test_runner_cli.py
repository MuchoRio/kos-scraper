"""Unit tests for runner pipeline (`run_hunt`) and CLI help/invocation."""

from __future__ import annotations

import csv
import json
import pathlib
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

from scraper.exporters import upsert_items_with_existing
from scraper.runner import run_hunt

FIXTURES = pathlib.Path(__file__).resolve().parents[1] / "fixtures"
ROOT_DIR = pathlib.Path(__file__).resolve().parents[2]


class _FixtureHttpClient:
    def get(self, url: str, **_kwargs) -> str:
        if "rukita.co/kost/" in url:
            return (FIXTURES / "rukita_list.html").read_text(encoding="utf-8")
        if "rukita.co/place/" in url:
            return (FIXTURES / "rukita_detail.html").read_text(encoding="utf-8")
        if "sewakost.com/kost/" in url and url.rstrip("/").endswith("jakarta-selatan") or "price:" in url or "index" in url:
            return (FIXTURES / "sewakost_list.html").read_text(encoding="utf-8")
        return (FIXTURES / "sewakost_detail_normal.html").read_text(encoding="utf-8")


class TestRunnerPipeline(unittest.TestCase):
    def test_run_hunt_writes_outputs_to_temp_dir_without_network(self) -> None:
        events: list[dict] = []
        with tempfile.TemporaryDirectory() as tmp:
            out_dir = pathlib.Path(tmp)
            with patch("scraper.runner.PoliteHttpClient", return_value=_FixtureHttpClient()):
                summary = run_hunt(
                    sources=["sewakost", "rukita"],
                    area="jakarta-selatan",
                    max_price=3000000,
                    max_pages=1,
                    keywords=["cipete", "pejaten"],
                    details_limit=2,
                    out_dir=out_dir,
                    mask_contact=True,
                    progress_cb=events.append,
                )
            self.assertEqual(summary["detail_count"], 2)
            self.assertEqual(summary["files"]["detail_json"], "detail_latest.json")
            self.assertEqual(summary["files"]["csv"], "hasil_kos_latest.csv")
            self.assertTrue((out_dir / summary["files"]["csv"]).exists())
            self.assertTrue((out_dir / summary["files"]["detail_json"]).exists())
            self.assertTrue(any(ev.get("type") == "done" for ev in events))
            with (out_dir / summary["files"]["csv"]).open("r", encoding="utf-8-sig", newline="") as fh:
                rows = list(csv.DictReader(fh))
            self.assertEqual(len(rows), 2)

            # Second run with default keep_history=False overwrites without creating extra files
            with patch("scraper.runner.PoliteHttpClient", return_value=_FixtureHttpClient()):
                run_hunt(sources=["sewakost", "rukita"], area="jakarta-selatan", max_price=3000000, max_pages=1, keywords=["cipete"], details_limit=2, out_dir=out_dir)
            json_csv = sorted(p.name for p in out_dir.iterdir() if p.is_file())
            self.assertEqual(json_csv, ["detail_latest.json", "hasil_kos_latest.csv", "list_latest.json"])

            # Upsert merge keeps prior distinct items and updates matching URL in place
            existing_detail = out_dir / "detail_latest.json"
            existing_rows = json.loads(existing_detail.read_text(encoding="utf-8"))
            merged = upsert_items_with_existing(existing_detail, [
                {"url": existing_rows[0]["url"], "title": "Updated Kos Name", "price": 990000},
                {"url": "https://example.com/kos-baru", "title": "Kos Baru Tebet", "price": 1100000},
            ])
            self.assertEqual(len(merged), len(existing_rows) + 1)
            self.assertEqual(merged[0]["title"], "Updated Kos Name")

    def test_cli_help_executes_cleanly(self) -> None:
        res = subprocess.run(
            [sys.executable, str(ROOT_DIR / "kos_scraper.py"), "--help"],
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(res.returncode, 0)
        self.assertIn("hunt", res.stdout)


if __name__ == "__main__":
    unittest.main()


"""Unit tests for runner pipeline (`run_hunt`) and CLI help/invocation."""

from __future__ import annotations

import csv
import pathlib
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

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
            self.assertTrue((out_dir / summary["files"]["csv"]).exists())
            self.assertTrue((out_dir / summary["files"]["detail_json"]).exists())
            self.assertTrue(any(ev.get("type") == "done" for ev in events))
            with (out_dir / summary["files"]["csv"]).open("r", encoding="utf-8-sig", newline="") as fh:
                rows = list(csv.DictReader(fh))
            self.assertEqual(len(rows), 2)

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


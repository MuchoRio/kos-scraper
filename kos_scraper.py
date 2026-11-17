#!/usr/bin/env python3
"""Backward-compatible CLI entrypoint delegating to the modular `scraper` package.

Usage:
  python3 kos_scraper.py list --area jakarta-selatan --max-price 1000000 --max-pages 3
  python3 kos_scraper.py detail <url> [url2 ...]
  python3 kos_scraper.py search --area jakarta-selatan --max-price 1000000 --keyword "blok m,kemang" --details 10
  python3 kos_scraper.py hunt --sources sewakost,rukita --area jakarta-selatan --max-price 1500000
"""

from __future__ import annotations

import sys

from scraper.cli import main

if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

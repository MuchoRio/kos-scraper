"""CLI entrypoint for `python3 -m scraper.cli` and `kos_scraper.py`."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from .runner import enrich_details, run_hunt, scrape_listings


def _add_common_flags(sp: argparse.ArgumentParser, default_pages: int) -> None:
    sp.add_argument(
        "--sources",
        default="sewakost",
        help="Comma-separated: sewakost,rukita,mamikos,infokost,cove,djuragankamar,rumah123,kostjakarta",
    )
    sp.add_argument("--area", default="jakarta-selatan")
    sp.add_argument("--max-price", type=int, default=None)
    sp.add_argument("--max-pages", type=int, default=default_pages)
    sp.add_argument("--keyword", default="")
    sp.add_argument("--sort", default="default")
    sp.add_argument("--order", default="desc", choices=["asc", "desc"])
    sp.add_argument("--concurrency", type=int, default=4, help="Concurrent workers (1-8)")
    sp.add_argument("--progress-jsonl", action="store_true")


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Multi-source Indonesian kos scraper CLI")
    sub = p.add_subparsers(dest="cmd", required=True)

    lp = sub.add_parser("list")
    _add_common_flags(lp, 3)
    lp.add_argument("--strict", action="store_true")

    dp = sub.add_parser("detail")
    dp.add_argument("urls", nargs="+")
    dp.add_argument("--source", default="")

    sp = sub.add_parser("search")
    _add_common_flags(sp, 5)
    sp.add_argument("--details", type=int, default=10)
    sp.add_argument("--geocode", action="store_true")
    sp.add_argument("--gmaps", action="store_true")
    sp.add_argument("--ref-lat", type=float, default=None)
    sp.add_argument("--ref-lon", type=float, default=None)

    hp = sub.add_parser("hunt")
    _add_common_flags(hp, 5)
    hp.add_argument("--details", type=int, default=25)
    hp.add_argument("--out-dir", default="")
    hp.add_argument("--geocode", action="store_true")
    hp.add_argument("--gmaps", action="store_true")
    hp.add_argument("--ref-lat", type=float, default=None)
    hp.add_argument("--ref-lon", type=float, default=None)
    hp.add_argument("--mask-contact", action="store_true")
    return p.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    use_jsonl = getattr(args, "progress_jsonl", False)

    def cb(ev: dict[str, Any]) -> None:
        if use_jsonl:
            print(json.dumps(ev, ensure_ascii=False), file=sys.stderr, flush=True)

    if args.cmd == "detail":
        cands = [{"url": u, "source": args.source or None} for u in args.urls]
        out = enrich_details(cands, details_limit=len(cands))
        print(json.dumps(out, ensure_ascii=False, indent=1))
        return 0

    sources = [s.strip() for s in args.sources.split(",") if s.strip()]
    kws = [k.strip() for k in args.keyword.split(",") if k.strip()]

    if args.cmd == "list":
        items = scrape_listings(
            sources=sources,
            area=args.area,
            max_price=args.max_price,
            max_pages=args.max_pages,
            keywords=kws,
            sort=args.sort,
            order=args.order,
            strict=args.strict,
            progress_cb=cb,
        )
        print(json.dumps({"sources": sources, "count": len(items), "items": items}, ensure_ascii=False, indent=1))
        return 0

    if args.cmd == "search":
        items = scrape_listings(
            sources=sources,
            area=args.area,
            max_price=args.max_price,
            max_pages=args.max_pages,
            keywords=kws,
            sort=args.sort,
            order=args.order,
            strict=bool(kws),
            progress_cb=cb,
        )
        out = enrich_details(
            items,
            details_limit=args.details,
            keywords=kws,
            max_price=args.max_price,
            geocode=args.geocode,
            gmaps=args.gmaps,
            ref_lat=args.ref_lat,
            ref_lon=args.ref_lon,
            concurrency=max(1, min(8, args.concurrency)),
            progress_cb=cb,
        )
        print(json.dumps({"sources": sources, "count": len(out), "items": out}, ensure_ascii=False, indent=1))
        return 0

    if args.cmd == "hunt":
        out_dir = Path(args.out_dir).resolve() if args.out_dir else None
        summary = run_hunt(
            sources=sources,
            area=args.area,
            max_price=args.max_price,
            max_pages=args.max_pages,
            keywords=kws,
            details_limit=args.details,
            sort=args.sort,
            order=args.order,
            geocode=args.geocode,
            gmaps=args.gmaps,
            ref_lat=args.ref_lat,
            ref_lon=args.ref_lon,
            out_dir=out_dir,
            mask_contact=args.mask_contact,
            concurrency=max(1, min(8, args.concurrency)),
            progress_cb=cb,
        )
        print(json.dumps(summary, ensure_ascii=False, indent=1))
        return 0
    return 1


if __name__ == "__main__":
    raise SystemExit(main())


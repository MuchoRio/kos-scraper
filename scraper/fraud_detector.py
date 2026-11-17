"""Two-layer kos scam & red-flag risk detector (audience reviews + listing anomalies)."""

from __future__ import annotations

import re
from typing import Any

HIGH_SCAM_REVIEW_PHRASES: tuple[str, ...] = (
    "penipuan",
    "penipu",
    "tipu",
    "scam",
    "modus",
    "whatsapp palsu",
    "wa palsu",
    "nomor palsu",
    "no palsu",
    "dp hangus",
    "dp hilang",
    "fiktif",
    "alamat palsu",
    "foto palsu",
    "bukan kos",
    "bukan kost",
    "calo",
    "makelar",
    "jangan kos",
    "jangan kesini",
    "jangan di sini",
)

CAUTION_REVIEW_PHRASES: tuple[str, ...] = (
    "survey dulu",
    "survei dulu",
    "cek langsung",
    "hati-hati",
    "hati hati",
    "waspada",
    "tidak sesuai foto",
    "beda dengan foto",
    "uang kembali",
    "kurang meyakinkan",
)

DP_PRESSURE_PATTERNS: tuple[str, ...] = (
    "wajib dp dulu",
    "dp sebelum survey",
    "dp sebelum survei",
    "transfer sebelum survey",
    "transfer sebelum survei",
    "wajib transfer dulu",
    "booking fee dulu",
    "tanpa survey",
    "no survey",
)

_PHONE_IN_DESC_RE = re.compile(r"(?:\+?62|0)8\d[\d\s\-]{7,13}")


def _normalize_digits(raw: str) -> str:
    d = re.sub(r"\D", "", raw)
    if d.startswith("62"):
        d = "0" + d[2:]
    return d


def assess_scam_risk(record: dict[str, Any]) -> dict[str, Any]:
    """Compute scam risk score, severity level, signals, and warning quotes."""
    score = 0
    signals: list[str] = []
    warning_quotes: list[str] = []

    # Layer 1: Audience reviews from Google Maps (if present)
    gmaps = record.get("gmaps") if isinstance(record.get("gmaps"), dict) else {}
    all_reviews = list(gmaps.get("negative_reviews") or []) + list(gmaps.get("positive_reviews") or [])
    seen_quotes: set[str] = set()

    for rev in all_reviews:
        txt = str(rev.get("text") or "").strip()
        low = txt.lower()
        if not low:
            continue
        high_hits = [p for p in HIGH_SCAM_REVIEW_PHRASES if p in low]
        caution_hits = [p for p in CAUTION_REVIEW_PHRASES if p in low]
        if high_hits:
            score += 60
            signals.append(f"Ulasan Google Maps menyebut: {', '.join(high_hits[:3])}")
            if txt not in seen_quotes:
                seen_quotes.add(txt)
                warning_quotes.append(txt[:220])
        elif caution_hits:
            score += 30
            signals.append(f"Peringatan penghuni di ulasan: {', '.join(caution_hits[:3])}")
            if txt not in seen_quotes:
                seen_quotes.add(txt)
                warning_quotes.append(txt[:220])

    rating = gmaps.get("rating")
    rev_count = gmaps.get("review_count")
    if isinstance(rating, (int, float)) and rating < 3.0 and (rev_count is None or rev_count >= 3):
        score += 25
        signals.append(f"Rating Google Maps rendah ({rating:.1f})")

    # Layer 2: Listing-level anomaly signals (runs even without Google Maps reviews)
    desc = str(record.get("deskripsi") or "")
    desc_low = desc.lower()
    dp_hits = [p for p in DP_PRESSURE_PATTERNS if p in desc_low]
    if dp_hits:
        score += 45
        signals.append(f"Deskripsi meminta transfer/DP awal ({dp_hits[0]})")

    seller_nums = {
        _normalize_digits(str(record.get(k) or ""))
        for k in ("telp", "hp", "wa")
        if record.get(k)
    }
    seller_nums.discard("")
    if seller_nums and desc:
        desc_nums = {_normalize_digits(m) for m in _PHONE_IN_DESC_RE.findall(desc)}
        mismatched = [n for n in desc_nums if len(n) >= 10 and n not in seller_nums]
        if mismatched:
            score += 30
            signals.append("Nomor kontak di deskripsi berbeda dengan profil pengiklan")

    price = record.get("price")
    fac_blob = f"{record.get('fasilitas') or ''} {desc}".lower()
    has_ac_km = "ac" in fac_blob and "kamar mandi dalam" in fac_blob
    if record.get("price_suspect"):
        score += 20
        signals.append("Harga tidak tercantum jelas / mencurigakan")
    elif isinstance(price, int) and price < 400_000 and has_ac_km:
        score += 35
        signals.append("Harga sangat tidak wajar untuk fasilitas AC + kamar mandi dalam")

    dedup_signals = list(dict.fromkeys(signals))
    if score >= 55:
        level = "high"
    elif score >= 25:
        level = "medium"
    else:
        level = "low"

    return {
        "level": level,
        "score": min(score, 100),
        "signals": dedup_signals[:6],
        "warning_quotes": warning_quotes[:4],
    }


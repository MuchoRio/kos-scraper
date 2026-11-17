"""Indonesian kos review sentiment classifier, theme aggregator, and price-clue extractor."""

from __future__ import annotations

import re
from statistics import median
from typing import Any

from .models import format_idr

POSITIVE_KEYWORDS: dict[str, tuple[str, ...]] = {
    "Bersih & Rapi": ("bersih", "rapi", "terawat", "kinclong", "wangi", "higienis"),
    "Nyaman & Tenang": ("nyaman", "tenang", "betah", "enak", "adem", "asri", "cozy", "homey"),
    "Lokasi Strategis": ("strategis", "dekat", "akses mudah", "akses gampang", "mrt", "halte", "kampus"),
    "Aman & Ramah": ("aman", "ramah", "baik", "sopan", "penjaga", "satpam", "cctv", "helpful"),
    "Fasilitas Oke": ("lengkap", "wifi kencang", "wifi lancar", "ac dingin", "parkir luas", "dapur"),
}

NEGATIVE_KEYWORDS: dict[str, tuple[str, ...]] = {
    "Bau / Kebersihan": ("kotor", "bau", "apek", "jorok", "berdebu", "kecoa", "tikus", "semut", "nyamuk", "lembab"),
    "Bocor / Rusak": ("bocor", "rembes", "rusak", "pecah", "mampet", "jelek", "kumuh", "panas"),
    "Bising / Berisik": ("berisik", "bising", "iseng", "ramai", "kedap suara kurang", "ganggu"),
    "Parkir Terbatas": ("parkir sempit", "parkir susah", "tidak ada parkir", "susah parkir", "gang sempit"),
    "Air / Listrik": ("air mati", "air kecil", "air bau", "listrik mati", "token mahal", "mati lampu"),
    "Harga / Layanan": ("mahal", "overprice", "galak", "jutek", "kurang ramah", "kecewa", "deposit susah"),
}

_PRICE_PATTERNS = [
    re.compile(r"rp\.?\s*(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?)\s*(?:jt|juta|rb|ribu|k)?\b", re.I),
    re.compile(r"\b(\d+(?:[.,]\d+)?)\s*(?:jt|juta|jutaan)\b", re.I),
    re.compile(r"\b(\d{3,4})\s*(?:rb|ribu|ribuan|k)\b", re.I),
    re.compile(r"\bsejuta(?:an)?\b", re.I),
]
_CONTEXT_HINT_RE = re.compile(
    r"\b(?:harga|sewa|per\s*bulan|sebulan|/bln|/bulan|bayar|tarif|biaya|murah|mahal|mulai|start|range)\b",
    re.I,
)


def extract_review_price_clues(text: str | None) -> list[dict[str, Any]]:
    """Extract plausible monthly kos prices mentioned inside an audience review."""
    if not text:
        return []
    clues: list[dict[str, Any]] = []
    seen_amounts: set[int] = set()

    for pat in _PRICE_PATTERNS:
        for match in pat.finditer(text):
            raw = match.group(0)
            low = raw.lower()
            amount: int | None = None

            if "sejuta" in low:
                amount = 1_000_000
            elif any(u in low for u in ("jt", "juta")):
                num = float(match.group(1).replace(",", "."))
                amount = int(round(num * 1_000_000))
            elif any(u in low for u in ("rb", "ribu", "k")):
                num = float(match.group(1).replace(",", "."))
                amount = int(round(num * 1_000))
            elif low.startswith("rp"):
                digits = re.sub(r"\D", "", match.group(1))
                if digits:
                    val = int(digits)
                    if val < 50:
                        continue
                    amount = val

            if amount is None or not (250_000 <= amount <= 25_000_000):
                continue

            # Guard against unrelated year/phone fragments if written with plain Rp
            window_start = max(0, match.start() - 40)
            window_end = min(len(text), match.end() + 40)
            snippet = text[window_start:window_end].strip()
            if not any(u in low for u in ("jt", "juta", "rb", "ribu", "sejuta")) and not _CONTEXT_HINT_RE.search(snippet):
                if amount < 400_000:
                    continue

            if amount not in seen_amounts:
                seen_amounts.add(amount)
                clues.append({
                    "amount": amount,
                    "formatted": format_idr(amount),
                    "quote": snippet,
                })
    return clues


def _match_themes(text_low: str, mapping: dict[str, tuple[str, ...]]) -> list[str]:
    matched: list[str] = []
    for theme, keywords in mapping.items():
        if any(kw in text_low for kw in keywords):
            matched.append(theme)
    return matched


def classify_review(review: dict[str, Any]) -> dict[str, Any]:
    """Classify a single review into positive, negative, or neutral with matched tags."""
    text = str(review.get("text") or "").strip()
    text_low = text.lower()
    rating_raw = review.get("rating")
    rating = float(rating_raw) if isinstance(rating_raw, (int, float)) else None

    pos_tags = _match_themes(text_low, POSITIVE_KEYWORDS)
    neg_tags = _match_themes(text_low, NEGATIVE_KEYWORDS)
    price_clues = extract_review_price_clues(text)

    if rating is not None:
        if rating <= 2.5 or (rating <= 3.5 and len(neg_tags) > len(pos_tags)):
            sentiment = "negative"
        elif rating >= 4.0 and len(neg_tags) == 0:
            sentiment = "positive"
        elif rating >= 4.0 and len(neg_tags) > 0:
            sentiment = "mixed"
        elif len(pos_tags) > len(neg_tags):
            sentiment = "positive"
        else:
            sentiment = "neutral"
    else:
        if len(neg_tags) > len(pos_tags):
            sentiment = "negative"
        elif len(pos_tags) > 0:
            sentiment = "positive"
        else:
            sentiment = "neutral"

    return {
        "author": review.get("author") or "Pengulas Google",
        "rating": rating,
        "relative_time": review.get("relative_time") or "",
        "text": text,
        "sentiment": sentiment,
        "pos_tags": pos_tags,
        "neg_tags": neg_tags,
        "price_clues": price_clues,
    }


def analyze_reviews(reviews: list[dict[str, Any]]) -> dict[str, Any]:
    """Summarize positive/negative comments, evaluation tags, and price estimates."""
    classified = [classify_review(r) for r in reviews if (r.get("text") or r.get("rating"))]
    positive_reviews = [r for r in classified if r["sentiment"] in {"positive", "mixed"} and r["text"]]
    negative_reviews = [r for r in classified if r["sentiment"] in {"negative", "mixed"} and r["text"]]

    pos_counts: dict[str, int] = {}
    neg_counts: dict[str, int] = {}
    all_clues: list[dict[str, Any]] = []

    for item in classified:
        for tag in item["pos_tags"]:
            pos_counts[tag] = pos_counts.get(tag, 0) + 1
        for tag in item["neg_tags"]:
            neg_counts[tag] = neg_counts.get(tag, 0) + 1
        for clue in item["price_clues"]:
            all_clues.append({**clue, "author": item["author"], "rating": item["rating"]})

    pros_summary = [
        {"tag": k, "count": v}
        for k, v in sorted(pos_counts.items(), key=lambda kv: (-kv[1], kv[0]))[:5]
    ]
    cons_summary = [
        {"tag": k, "count": v}
        for k, v in sorted(neg_counts.items(), key=lambda kv: (-kv[1], kv[0]))[:5]
    ]

    estimate_val: int | None = None
    if all_clues:
        estimate_val = int(round(median(c["amount"] for c in all_clues)))

    return {
        "positive_reviews": positive_reviews[:8],
        "negative_reviews": negative_reviews[:8],
        "pros_summary": pros_summary,
        "cons_summary": cons_summary,
        "price_clues": all_clues[:6],
        "review_price_estimate": estimate_val,
        "review_price_estimate_text": format_idr(estimate_val) if estimate_val else None,
    }


"""Semantic Indonesian kos attribute extractor (Texas, Pet, Pasutri, Transum, Facilities)."""

from __future__ import annotations

import re
from typing import Any


def _build_blob(item: dict[str, Any]) -> str:
    parts = [
        str(item.get("title") or ""),
        str(item.get("nama_kost") or ""),
        str(item.get("jenis") or ""),
        str(item.get("alamat") or ""),
        str(item.get("deskripsi") or ""),
        str(item.get("fasilitas") or ""),
        " ".join(str(x) for x in (item.get("fasilitas_list") or [])),
        " ".join(str(x) for x in (item.get("peraturan") or [])),
    ]
    return " ".join(parts).lower()


def extract_kos_attributes(item: dict[str, Any]) -> dict[str, Any]:
    """Infer normalized lifestyle, rule, transit, and facility attributes from listing data."""
    blob = _build_blob(item)
    rules_blob = " ".join(str(x) for x in (item.get("peraturan") or [])).lower()

    # 1. Kebebasan / Texas vs Bebas Sopan
    has_texas = bool(
        re.search(
            r"\b(?:texas|akses\s*24\s*jam|24\s*jam|bebas\s*(?:24|keluar\s*masuk|jam\s*malam)|tanpa\s*jam\s*malam|jam\s*malam\s*:\s*tidak)\b",
            blob,
        )
    )
    has_non_texas = bool(
        re.search(
            r"\b(?:bebas\s*sopan|non[\s-]*texas|syariah|muslim(?:ah)?|jam\s*malam\s*:\s*ya|ada\s*jam\s*malam|dilarang\s*tamu|tamu\s*menginap\s*dilarang)\b",
            blob,
        )
    )
    if has_non_texas and not has_texas:
        freedom = "non_texas"
    elif has_texas:
        freedom = "texas"
    else:
        freedom = "unknown"

    # 2. Pet Friendly (negation guard first)
    no_pet = bool(
        re.search(
            r"\b(?:dilarang\s*(?:bawa\s*|pelihara\s*)?(?:hewan|binatang|kucing|anjing)|tidak\s*boleh\s*(?:bawa\s*|pelihara\s*)?(?:hewan|kucing|anjing)|no\s*pets?)\b",
            blob,
        )
    )
    cat_hit = bool(re.search(r"\b(?:cat\s*only|cat\s*friendly|boleh\s*(?:bawa\s*)?kucing|khusus\s*kucing)\b", blob))
    dog_hit = bool(re.search(r"\b(?:dog\s*friendly|boleh\s*(?:bawa\s*)?anjing)\b", blob))
    general_pet = bool(
        re.search(r"\b(?:pet\s*friendly|boleh\s*(?:bawa\s*|pelihara\s*)?(?:hewan|binatang\s*peliharaan))\b", blob)
    )
    if no_pet:
        pet = "no_pet"
    elif cat_hit and not dog_hit and not general_pet:
        pet = "cat_only"
    elif dog_hit or general_pet or (cat_hit and dog_hit):
        pet = "all_pets"
    else:
        pet = "unknown"

    # 3. Pasutri vs Non-Pasutri
    no_pasutri = bool(
        re.search(r"\b(?:pasutri\s*:\s*tidak|tidak\s*(?:boleh\s*)?pasutri|bukan\s*pasutri|non[\s-]*pasutri|khusus\s*lajang|1\s*org|max\s*1\s*orang)\b", blob)
    )
    yes_pasutri = bool(
        re.search(r"\b(?:pasutri\s*:\s*ya|kost?\s*pasutri|boleh\s*pasutri|bisa\s*pasutri|terima\s*pasutri|pasangan\s*suami\s*istri)\b", blob)
    ) and not no_pasutri
    if yes_pasutri:
        pasutri = "pasutri"
    elif no_pasutri or "putri" in str(item.get("jenis") or "").lower() or "putra" in str(item.get("jenis") or "").lower():
        pasutri = "non_pasutri"
    else:
        pasutri = "unknown"

    # 4. Transum Friendly
    transum = bool(
        re.search(
            r"\b(?:mrt|lrt|krl|commuter\s*line|stasiun|transjakarta|busway|halte|jaklingko|tj|terminal)\b",
            blob,
        )
    )

    # 5. Kamar Mandi Dalam / Luar
    km_dalam = bool(
        re.search(r"\b(?:kamar\s*mandi\s*dalam|k\.?\s*mandi\s*dalam|km\s*dalam|private\s*bath(?:room)?)\b", blob)
    )
    km_luar = bool(
        re.search(r"\b(?:kamar\s*mandi\s*luar|k\.?\s*mandi\s*luar|km\s*luar|share\s*bath(?:room)?|kamar\s*mandi\s*bersama)\b", blob)
    )
    if km_dalam and not km_luar:
        bathroom = "dalam"
    elif km_luar and not km_dalam:
        bathroom = "luar"
    elif km_dalam:
        bathroom = "dalam"
    else:
        bathroom = "unknown"

    # 6. Dapur Bersama / Tidak
    no_kitchen = bool(re.search(r"\b(?:tidak\s*ada\s*dapur|tanpa\s*dapur)\b", blob))
    has_kitchen = bool(re.search(r"\b(?:dapur|kompor|kitchen|pantry)\b", blob)) and not no_kitchen
    kitchen = "yes" if has_kitchen else ("no" if no_kitchen else "unknown")

    # 7. Price Tier (Under Sejuta vs Mid vs Exclusive)
    price = item.get("price")
    is_valid_price = isinstance(price, int) and not item.get("price_suspect") and price >= 100_000
    is_excl_label = bool(re.search(r"\b(?:eksklusif|exclusive|kostel|coliving|vip|luxury)\b", blob))
    if is_valid_price and price <= 1_000_000:
        price_tier = "under_1m"
    elif is_valid_price and price > 2_500_000 or is_excl_label:
        price_tier = "exclusive"
    elif is_valid_price:
        price_tier = "mid"
    else:
        price_tier = "unknown"

    # 8. Core quick facilities
    wifi = bool(re.search(r"\b(?:wi-?fi|internet)\b", blob)) and not bool(re.search(r"\bfree\s*wifi\s*tidak\b", blob))
    ac = bool(re.search(r"\b(?:ac|aircon|pendingin)\b", blob)) and not bool(re.search(r"\bnon[\s-]*ac\b", blob))
    rules_note = rules_blob.strip()

    return {
        "freedom": freedom,
        "pet": pet,
        "pasutri": pasutri,
        "transum": transum,
        "bathroom": bathroom,
        "kitchen": kitchen,
        "price_tier": price_tier,
        "wifi": wifi,
        "ac": ac,
        "has_rules": bool(rules_note),
    }


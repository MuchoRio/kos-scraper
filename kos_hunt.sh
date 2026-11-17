#!/usr/bin/env bash
# Cross-platform compatible wrapper around `python3 -m scraper.runner hunt`
# Usage: ./kos_hunt.sh "kemang,blok m,cipete,mampang" 1000000 jakarta-selatan [sewakost,rukita]
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KEYWORDS="${1:-kemang,blok m,melawai,bulungan,cipete,fatmawati,kebayoran,mampang,bangka,senopati,petogogan,pulo raya,ampera,pejaten}"
MAXPRICE="${2:-1000000}"
AREA="${3:-jakarta-selatan}"
SOURCES="${4:-sewakost}"
OUTDIR="${OUTDIR:-$ROOT_DIR/hasil}"

PYTHON_BIN="${PYTHON_BIN:-python3}"
if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
  PYTHON_BIN="python"
fi

echo "[kos-hunt] Menjalankan hunt ($SOURCES | $AREA | <= Rp$MAXPRICE)..."
"$PYTHON_BIN" "$ROOT_DIR/kos_scraper.py" hunt \
  --sources "$SOURCES" \
  --area "$AREA" \
  --max-price "$MAXPRICE" \
  --keyword "$KEYWORDS" \
  --out-dir "$OUTDIR"

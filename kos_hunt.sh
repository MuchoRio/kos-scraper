#!/bin/bash
# kos-hunt workflow: scrape -> filter area -> detail -> CSV report
# Usage: ./kos_hunt.sh "kemang,blok m,cipete,mampang" 1000000 jakarta-selatan
set -e
KEYWORDS="${1:-kemang,blok m,melawai,bulungan,cipete,fatmawati,kebayoran,mampang,bangka,senopati,petogogan,pulo raya,ampera,pejaten}"
MAXPRICE="${2:-1000000}"
AREA="${3:-jakarta-selatan}"
OUTDIR="${OUTDIR:-./hasil}"
mkdir -p "$OUTDIR"
STAMP=$(date +%Y%m%d_%H%M)
LIST="$OUTDIR/list_${AREA}_${STAMP}.json"
DETAIL="$OUTDIR/detail_${AREA}_${STAMP}.json"
CSV="$OUTDIR/hasil_kos_${STAMP}.csv"

echo "[1/4] scraping list harga <= Rp$MAXPRICE ($AREA)..."
python3 "$(dirname "$0")/kos_scraper.py" list --area "$AREA" --max-price "$MAXPRICE" --max-pages 5 > "$LIST"
echo "      $(python3 -c "import json;print(json.load(open('$LIST'))['count'])") listing"

echo "[2/4] filter keyword area: $KEYWORDS"
python3 - "$LIST" "$KEYWORDS" <<'EOF' > /tmp/kos_hunt_urls.txt
import json, sys
d = json.load(open(sys.argv[1]))
kws = [k.strip() for k in sys.argv[2].split(",")]
def hit(x):
    blob = (x['title']+' '+x['slug']).lower().replace('-',' ')
    return [k for k in kws if k in blob]
hits = [x for x in d['items'] if hit(x)]
print(f"{len(hits)} match", file=sys.stderr)
print("\n".join(h['url'] for h in hits))
EOF

N=$(wc -l < /tmp/kos_hunt_urls.txt)
echo "      $N match area"
[ "$N" -eq 0 ] && { echo "ga ada yg match bray, cek $LIST"; exit 1; }

echo "[3/4] ambil detail ($N iklan, ~1.5 dtk/iklan)..."
python3 "$(dirname "$0")/kos_scraper.py" detail $(cat /tmp/kos_hunt_urls.txt | tr '\n' ' ') > "$DETAIL"

echo "[4/4] tulis CSV: $CSV"
python3 - "$DETAIL" "$CSV" <<'EOF'
import json, sys, csv
d = json.load(open(sys.argv[1]))
rows = []
for x in d:
    p = x.get('price')
    rows.append({
        "nama": x.get('title',''), "harga_min": p or '',
        "tipe": x.get('jenis',''), "kecamatan": x.get('kecamatan',''),
        "kelurahan": x.get('kelurahan',''), "alamat": x.get('alamat',''),
        "fasilitas": (x.get('fasilitas') or '')[:200], "kontak": ",".join(x.get('kontak') or []),
        "link": x.get('url',''),
    })
rows.sort(key=lambda r: (r['harga_min'] or 10**12))
with open(sys.argv[2], 'w', newline='') as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
print(f"{len(rows)} baris", file=sys.stderr)
EOF
echo "DONE bray: $CSV"

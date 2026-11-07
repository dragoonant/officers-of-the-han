#!/bin/sh
# Downloads Wikipedia raw wikitext for each officer into docs/sources/bio/<id>.wiki. Input lines: id|Title
# Usage: tools/data/verify/fetch-bios.sh names.txt
OUT="$(dirname "$0")/../../../docs/sources/bio"
mkdir -p "$OUT"
cat "$1" | xargs -P 8 -I{} sh -c 'id=$(echo "{}" | cut -d"|" -f1); t=$(echo "{}" | cut -d"|" -f2 | sed "s/ /_/g"); [ -s "'"$OUT"'/$id.wiki" ] || curl -sS -m 60 -G "https://en.wikipedia.org/w/index.php" --data-urlencode "title=$t" --data-urlencode "action=raw" -o "'"$OUT"'/$id.wiki"'

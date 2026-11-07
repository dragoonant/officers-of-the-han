#!/bin/sh
# Downloads extra Wikipedia pages (topics, commanderies, cities) as raw wikitext into docs/sources/pages/. Usage: fetch-pages.sh "Title One" "Title Two" ...
OUT="$(dirname "$0")/../../../docs/sources/pages"
mkdir -p "$OUT"
for t in "$@"; do
  f="$OUT/$(echo "$t" | tr ' /()' '____').wiki"
  [ -s "$f" ] && continue
  for n in 1 2 3; do
    curl -sS -m 60 -G "https://en.wikipedia.org/w/index.php" --data-urlencode "title=$t" --data-urlencode "action=raw" -o "$f"
    head -c 9 "$f" | grep -q '<!DOCTYPE' || break
    sleep $((n * 3))
  done
done

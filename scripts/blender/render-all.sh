#!/usr/bin/env bash
# Renders every residence room as a cubemap with Cycles.
#
# Writes to a staging directory, never over the live assets: a run takes
# hours, and a half-replaced set would leave the site serving some rooms
# from one renderer and some from another. Swap only when the set is
# complete and checked.
set -u
SCENE="${SCENE:-/tmp/claude-0/villa.json}"
OUT="${OUT:-/tmp/claude-0/pano-cycles}"
SIZE="${SIZE:-1024}"
SAMPLES="${SAMPLES:-64}"
ROOMS="${ROOMS:-foyer living dining kitchen study guest stair upperLounge master dressing masterBath bedroom2 library}"

mkdir -p "$OUT"
for room in $ROOMS; do
  if [ -f "$OUT/$room/nz.jpg" ]; then
    echo "skip $room (already rendered)"
    continue
  fi
  echo "=== $room ==="
  start=$(date +%s)
  PANO_CUBE=1 python3 scripts/blender/render-villa.py \
    "$SCENE" "$room" "$OUT/$room" "$SAMPLES" "$SIZE" 2>&1 \
    | grep -E "^  face|wrote 6|Error|Traceback"
  echo "  $room done in $(( $(date +%s) - start ))s"
done
echo "ALL ROOMS COMPLETE"

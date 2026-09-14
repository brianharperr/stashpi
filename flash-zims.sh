#!/usr/bin/env bash
# Rewrite the ZIMDATA partition of an StashPi card so it contains only a
# chosen subset of ZIMs - e.g. to match one customer's web store order -
# instead of the full library. Never touches the OS/boot partitions.
#
# The card must already have a ZIMDATA partition. For a brand-new card,
# run init-flash.sh first (pass --no-copy so it doesn't bother copying
# the full library, since this script populates it instead):
#
#   sudo ./init-flash.sh rpi4 /dev/sdd --no-copy
#   sudo ./flash-zims.sh /dev/sdd --zims wikipedia,maps,mdwiki
#
# For a card that already has a library on it, just run this directly -
# it replaces ZIMDATA's contents with the new selection.
#
# Usage:
#   ./flash-zims.sh --list
#   sudo ./flash-zims.sh <device> --zims <id1,id2,...> [-y]
#   sudo ./flash-zims.sh <device> --all [-y]
#
# chess.zim is always included at no charge, matching the web store.
#
# What it does, in order, stopping immediately on any failure:
#   1. Validates the requested ids against the local zims/ directory
#   2. Sanity-checks the device and finds its existing ZIMDATA partition
#   3. Prompts for confirmation (unless -y is passed)
#   4. Syncs exactly the selected ZIMs onto ZIMDATA, deleting anything
#      else that was there
#   5. Writes a library.xml containing only the selected books, filtered
#      from the master zims/library.xml so titles/icons/ids are untouched

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ZIMS_DIR="$SCRIPT_DIR/zims"
MASTER_LIBRARY="$ZIMS_DIR/library.xml"
SCRATCH_MOUNT=""
ASSUME_YES=0

step() { printf '\n\033[1;36m==> %s\033[0m\n' "$1"; }
info() { printf '    %s\n' "$1"; }
die()  { printf '\033[1;31mERROR: %s\033[0m\n' "$1" >&2; exit 1; }

cleanup() {
  if [ -n "$SCRATCH_MOUNT" ] && mountpoint -q "$SCRATCH_MOUNT" 2>/dev/null; then
    umount "$SCRATCH_MOUNT" 2>/dev/null || true
  fi
  [ -n "$SCRATCH_MOUNT" ] && rmdir "$SCRATCH_MOUNT" 2>/dev/null || true
}
trap cleanup EXIT

# ---- zim id -> filename catalog ----
# Keep these ids and filenames in sync with web/config.js's ZIM_GROUPS -
# the web store and this script should always offer the same selection.
declare -A ZIM_FILES=(
  [maps]="maps_world.zim"
  [wikipedia]="wikipedia_2026-02.zim"
  [mdwiki]="mdwiki.zim"
  [gutenberg]="gutenberg_en_all_2025-11.zim"
  [recipes]="based.cooking_en_all_2026-08.zim"
  [food-preppers]="zimgit-food-preparation_en_2025-04.zim"
  [usda-canning]="usda-2015_en_2025-04.zim"
  [medicines]="medicines_2025-12.zim"
  [medical-library]="zimgit-medicine_en_2024-08.zim"
  [wikisource]="wikisource_en_all_nopic_2026-08.zim"
  [wikispecies]="wikispecies_en_all_maxi_2026-07.zim"
  [cheatsheets]="cheatography.com_en_all_2025-07.zim"
)
ALWAYS_INCLUDED=(chess.zim)

list_catalog() {
  step "Available ZIM selections"
  printf '    %-16s %8s   %s\n' "ID" "SIZE" "FILE"
  while IFS= read -r id; do
    file="${ZIM_FILES[$id]}"
    path="$ZIMS_DIR/$file"
    size="missing"
    [ -f "$path" ] && size="$(du -h "$path" | cut -f1)"
    printf '    %-16s %8s   %s\n' "$id" "$size" "$file"
  done < <(printf '%s\n' "${!ZIM_FILES[@]}" | sort)
  echo
  info "chess.zim is always included at no charge and isn't listed as an id."
  info "example: sudo ./flash-zims.sh /dev/sdd --zims wikipedia,maps,mdwiki"
}

# ---- args ----

if [ "${1:-}" = "--list" ] || [ "${1:-}" = "" ]; then
  [ -d "$ZIMS_DIR" ] || die "zims/ directory not found at $ZIMS_DIR"
  list_catalog
  exit 0
fi

DEVICE="$1"
shift

SELECT_ALL=0
ZIM_IDS_RAW=""
while [ $# -gt 0 ]; do
  case "$1" in
    --zims) ZIM_IDS_RAW="${2:-}"; shift 2 ;;
    --zims=*) ZIM_IDS_RAW="${1#--zims=}"; shift ;;
    --all) SELECT_ALL=1; shift ;;
    -y) ASSUME_YES=1; shift ;;
    *) die "unknown option '$1'" ;;
  esac
done

[ "$SELECT_ALL" -eq 1 ] && [ -n "$ZIM_IDS_RAW" ] && die "pass either --zims or --all, not both"
[ "$SELECT_ALL" -eq 0 ] && [ -z "$ZIM_IDS_RAW" ] && die "must pass --zims <id1,id2,...> or --all (see --list for valid ids)"

[ "$EUID" -eq 0 ] || die "must be run as root (sudo ./flash-zims.sh $DEVICE ...)"
[ -d "$ZIMS_DIR" ] || die "zims/ directory not found at $ZIMS_DIR"
[ -f "$MASTER_LIBRARY" ] || die "master library.xml not found at $MASTER_LIBRARY"

# ---- resolve selection to filenames ----

step "Resolving ZIM selection"

SELECTED_IDS=()
if [ "$SELECT_ALL" -eq 1 ]; then
  while IFS= read -r id; do SELECTED_IDS+=("$id"); done < <(printf '%s\n' "${!ZIM_FILES[@]}" | sort)
else
  IFS=',' read -r -a SELECTED_IDS <<< "$ZIM_IDS_RAW"
fi

SELECTED_FILES=()
for raw_id in "${SELECTED_IDS[@]}"; do
  id="$(echo "$raw_id" | xargs)"
  [ -z "$id" ] && continue
  file="${ZIM_FILES[$id]:-}"
  [ -z "$file" ] && die "unknown zim id '$id' - run './flash-zims.sh --list' to see valid ids"
  [ -f "$ZIMS_DIR/$file" ] || die "'$file' (id '$id') not found in $ZIMS_DIR"
  SELECTED_FILES+=("$file")
done
for f in "${ALWAYS_INCLUDED[@]}"; do
  [ -f "$ZIMS_DIR/$f" ] || die "'$f' (always bundled) not found in $ZIMS_DIR"
  SELECTED_FILES+=("$f")
done
SELECTED_FILES=($(printf '%s\n' "${SELECTED_FILES[@]}" | sort -u))

[ "${#SELECTED_FILES[@]}" -gt 0 ] || die "no ZIMs selected"
info "selected: ${SELECTED_FILES[*]}"

# ---- device checks ----

step "Checking device"

[ -b "$DEVICE" ] || die "$DEVICE is not a block device"

DEVNAME="$(basename "$DEVICE")"
REMOVABLE_FILE="/sys/block/$DEVNAME/removable"
if [ -f "$REMOVABLE_FILE" ] && [ "$(cat "$REMOVABLE_FILE")" != "1" ]; then
  die "$DEVICE does not report as removable - refusing to touch what looks like a fixed disk."
fi

ROOT_DISK="$(findmnt -n -o SOURCE / | sed -E 's/p?[0-9]+$//')"
[ "$DEVICE" = "$ROOT_DISK" ] && die "$DEVICE appears to be this machine's own root disk. Refusing."

case "$DEVNAME" in
  mmcblk*|nvme*) PART_SUFFIX="p" ;;
  *) PART_SUFFIX="" ;;
esac
ZIMDATA_PART="${DEVICE}${PART_SUFFIX}3"

[ -b "$ZIMDATA_PART" ] || die "$ZIMDATA_PART doesn't exist - this card doesn't look initialized yet. Run init-flash.sh first (pass --no-copy, since this script populates the library instead)."

EXISTING_LABEL="$(lsblk -no LABEL "$ZIMDATA_PART" 2>/dev/null || true)"
[ "$EXISTING_LABEL" = "ZIMDATA" ] || die "$ZIMDATA_PART is not labeled ZIMDATA - refusing to touch a partition that doesn't look like the StashPi data partition."

info "device: $DEVICE, ZIMDATA partition: $ZIMDATA_PART"

# ---- size check ----

TOTAL_SIZE=0
for f in "${SELECTED_FILES[@]}"; do
  sz=$(stat -c%s "$ZIMS_DIR/$f")
  TOTAL_SIZE=$((TOTAL_SIZE + sz))
done

PART_SIZE=$(blockdev --getsize64 "$ZIMDATA_PART")
REQUIRED=$((TOTAL_SIZE + 200*1024*1024))
[ "$PART_SIZE" -gt "$REQUIRED" ] || die "$ZIMDATA_PART ($(numfmt --to=iec "$PART_SIZE")) is too small for the selected ZIMs ($(numfmt --to=iec "$TOTAL_SIZE")). Pick a smaller selection or a bigger card."

info "total selection size: $(numfmt --to=iec "$TOTAL_SIZE") (partition: $(numfmt --to=iec "$PART_SIZE"))"

# ---- unmount if currently mounted ----

if mountpoint -q "$ZIMDATA_PART" 2>/dev/null || findmnt -rn "$ZIMDATA_PART" >/dev/null 2>&1; then
  step "Unmounting $ZIMDATA_PART"
  umount "$ZIMDATA_PART" || die "failed to unmount $ZIMDATA_PART - close whatever has it open and retry"
fi

# ---- confirm ----

step "Ready to rewrite $ZIMDATA_PART"
info "this REPLACES the current contents of $ZIMDATA_PART - anything not in"
info "this selection will be deleted."
for f in "${SELECTED_FILES[@]}"; do info "  - $f"; done

if [ "$ASSUME_YES" -ne 1 ]; then
  read -r -p "Type the device path ($DEVICE) to confirm and continue: " CONFIRM
  [ "$CONFIRM" = "$DEVICE" ] || die "confirmation did not match, aborting"
fi

# ---- sync selected zims ----

step "Mounting $ZIMDATA_PART"
SCRATCH_MOUNT="$(mktemp -d)"
mount "$ZIMDATA_PART" "$SCRATCH_MOUNT"

step "Syncing selected ZIMs onto $ZIMDATA_PART"
RSYNC_ARGS=(-a --info=progress2 --delete --delete-excluded)
for f in "${SELECTED_FILES[@]}"; do
  RSYNC_ARGS+=(--include="$f")
done
RSYNC_ARGS+=(--exclude='library.xml' --exclude='*')
rsync "${RSYNC_ARGS[@]}" "$ZIMS_DIR/" "$SCRATCH_MOUNT/"

# ---- write a library.xml scoped to the selection ----

step "Writing library.xml for the selected books"
python3 - "$MASTER_LIBRARY" "$SCRATCH_MOUNT/library.xml" "${SELECTED_FILES[@]}" <<'PYEOF'
import sys
import xml.etree.ElementTree as ET

master_path, out_path, *selected = sys.argv[1:]
selected = set(selected)

tree = ET.parse(master_path)
root = tree.getroot()
for book in list(root.findall('book')):
    if book.get('path') not in selected:
        root.remove(book)

kept = {b.get('path') for b in root.findall('book')}
missing = selected - kept
if missing:
    sys.exit("library.xml is missing entries for: " + ", ".join(sorted(missing)))

tree.write(out_path, encoding='UTF-8', xml_declaration=False)
PYEOF

step "Unmounting $ZIMDATA_PART"
umount "$SCRATCH_MOUNT"
rmdir "$SCRATCH_MOUNT"
SCRATCH_MOUNT=""

step "Done"
info "$ZIMDATA_PART now contains exactly: ${SELECTED_FILES[*]}"
info "Put the card in the Pi and power it on."

#!/usr/bin/env bash
# Set up a brand-new (blank) microSD card for StashPi: writes the OS
# image, creates and formats the ZIMDATA partition, and copies the
# local ZIM library onto it.
#
# This is for a card that has never had StashPi on it. To reflash a
# card that already has a library on it, use reflash.sh instead - that
# one preserves the existing ZIMDATA partition instead of wiping it.
#
# Usage:
#   sudo ./init-flash.sh <rpi3|rpi4|rpi5> <device> [-y] [--no-copy]
#
# Example:
#   sudo ./init-flash.sh rpi4 /dev/sdd
#
# What it does, in order, stopping immediately on any failure:
#   1. Sanity-checks the board, image, and device (refuses non-removable
#      or too-small devices, and refuses a card that already looks like
#      an existing StashPi card)
#   2. Prompts for confirmation (unless -y is passed)
#   3. Writes the new sdcard.img with dd
#   4. Creates a 3rd partition spanning the rest of the card (capped at
#      470GB) and formats it ext4, labeled ZIMDATA
#   5. Copies zims/ onto it (unless --no-copy is passed)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ZIMS_DIR="$SCRIPT_DIR/zims"
SCRATCH_MOUNT=""
ASSUME_YES=0
COPY_ZIMS=1
# ZIMDATA is capped at 470GB even on bigger cards - see S41zimdata for
# why (kept in sync with that script's MAX_ZIMDATA_BYTES).
MAX_ZIMDATA_BYTES=$((470 * 1000 * 1000 * 1000))

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

# ---- args ----

BOARD="${1:-}"
DEVICE="${2:-}"
shift 2 2>/dev/null || true
for arg in "$@"; do
  case "$arg" in
    -y) ASSUME_YES=1 ;;
    --no-copy) COPY_ZIMS=0 ;;
    *) die "unknown option '$arg'" ;;
  esac
done

if [ -z "$BOARD" ] || [ -z "$DEVICE" ]; then
  die "usage: sudo ./init-flash.sh <rpi3|rpi4|rpi5> <device> [-y] [--no-copy]"
fi

case "$BOARD" in
  rpi3|rpi4|rpi5) ;;
  *) die "unknown board '$BOARD' (expected rpi3, rpi4, or rpi5)" ;;
esac

[ "$EUID" -eq 0 ] || die "must be run as root (sudo ./init-flash.sh $BOARD $DEVICE)"

IMAGE="$SCRIPT_DIR/buildroot/output-$BOARD/images/sdcard.img"

# ---- sanity checks ----

step "Checking image and device"

[ -f "$IMAGE" ] || die "image not found: $IMAGE (build it first with ./build.sh $BOARD)"
info "image: $IMAGE ($(du -h "$IMAGE" | cut -f1))"

[ -b "$DEVICE" ] || die "$DEVICE is not a block device"

DEVNAME="$(basename "$DEVICE")"
REMOVABLE_FILE="/sys/block/$DEVNAME/removable"
if [ -f "$REMOVABLE_FILE" ] && [ "$(cat "$REMOVABLE_FILE")" != "1" ]; then
  die "$DEVICE does not report as removable - refusing to touch what looks like a fixed disk."
fi

ROOT_DISK="$(findmnt -n -o SOURCE / | sed -E 's/p?[0-9]+$//')"
[ "$DEVICE" = "$ROOT_DISK" ] && die "$DEVICE appears to be this machine's own root disk. Refusing."

DEVICE_SIZE=$(blockdev --getsize64 "$DEVICE")
IMAGE_SIZE=$(stat -c%s "$IMAGE")
[ "$DEVICE_SIZE" -gt "$IMAGE_SIZE" ] || die "$DEVICE ($DEVICE_SIZE bytes) is smaller than the image ($IMAGE_SIZE bytes)"
info "device: $DEVICE ($(numfmt --to=iec "$DEVICE_SIZE")), removable, not the root disk"

case "$DEVNAME" in
  mmcblk*|nvme*) PART_SUFFIX="p" ;;
  *) PART_SUFFIX="" ;;
esac
part_path() { echo "${DEVICE}${PART_SUFFIX}${1}"; }

if [ "$COPY_ZIMS" -eq 1 ]; then
  [ -d "$ZIMS_DIR" ] || die "zims/ directory not found at $ZIMS_DIR (pass --no-copy to skip copying the library now and do it separately)"
  ZIMS_SIZE=$(du -sb "$ZIMS_DIR" | cut -f1)
  REQUIRED=$((IMAGE_SIZE + ZIMS_SIZE + 100*1024*1024))
  [ "$DEVICE_SIZE" -gt "$REQUIRED" ] || die "$DEVICE is too small for the OS image plus the ZIM library ($(numfmt --to=iec "$ZIMS_SIZE")). Use --no-copy and copy it separately, or use a bigger card."

  # The check above only rules out a card too small to hold the raw bytes.
  # ZIMDATA itself is capped at MAX_ZIMDATA_BYTES regardless of card size,
  # and ext4 formatting eats a further ~1.8% to metadata (measured by
  # actually formatting a 470GB image and reading its superblock) - without
  # this check a library that's fine by the raw-size check above can still
  # fail partway through the rsync below with a bare "no space left on
  # device". Reserve 3% for that overhead plus rounding.
  AVAILABLE_AFTER_OS=$((DEVICE_SIZE - IMAGE_SIZE))
  if [ "$AVAILABLE_AFTER_OS" -gt "$MAX_ZIMDATA_BYTES" ]; then
    EXPECTED_ZIMDATA_BYTES=$MAX_ZIMDATA_BYTES
  else
    EXPECTED_ZIMDATA_BYTES=$AVAILABLE_AFTER_OS
  fi
  USABLE_ZIMDATA_BYTES=$((EXPECTED_ZIMDATA_BYTES * 97 / 100))
  [ "$ZIMS_SIZE" -le "$USABLE_ZIMDATA_BYTES" ] || die "the ZIM library ($(numfmt --to=iec "$ZIMS_SIZE")) won't fit on the ZIMDATA partition this card will get. ZIMDATA is capped at $(numfmt --to=iec "$MAX_ZIMDATA_BYTES") even on bigger cards, and ext4 formatting leaves roughly $(numfmt --to=iec "$USABLE_ZIMDATA_BYTES") usable here - a bigger card will not help beyond that cap. Trim the library instead (see flash-zims.sh for copying a subset)."

  info "will copy $(numfmt --to=iec "$ZIMS_SIZE") of ZIMs from $ZIMS_DIR after flashing ($(numfmt --to=iec "$USABLE_ZIMDATA_BYTES") usable on ZIMDATA)"
else
  info "--no-copy passed, will not copy the library"
fi

# ---- refuse to clobber a card that already looks like an StashPi card ----

step "Checking this isn't already an StashPi card"

EXISTING_LABEL="$(lsblk -no LABEL "$(part_path 3)" 2>/dev/null || true)"
if [ "$EXISTING_LABEL" = "ZIMDATA" ]; then
  die "$(part_path 3) is already labeled ZIMDATA - this looks like a card that already has a library on it. Use reflash.sh instead, which preserves it."
fi
info "no existing ZIMDATA partition found - safe to initialize"

unmount_device_partitions() {
  for part in $(lsblk -no NAME -p "$DEVICE" | tail -n +2); do
    if mountpoint -q "$part" 2>/dev/null || findmnt -rn "$part" >/dev/null 2>&1; then
      info "unmounting $part"
      umount "$part" || die "failed to unmount $part - close whatever has it open and retry"
    fi
  done
}

step "Unmounting any mounted partitions of $DEVICE"
unmount_device_partitions

# ---- confirm ----

step "Ready to initialize"
info "board:  $BOARD"
info "image:  $IMAGE"
info "device: $DEVICE"
info "This will ERASE EVERYTHING currently on $DEVICE."

if [ "$ASSUME_YES" -ne 1 ]; then
  read -r -p "Type the device path ($DEVICE) to confirm and continue: " CONFIRM
  [ "$CONFIRM" = "$DEVICE" ] || die "confirmation did not match, aborting"
fi

# ---- flash OS image ----

step "Writing OS image to $DEVICE"
dd if="$IMAGE" of="$DEVICE" bs=4M status=progress conv=fsync
sync

# Automount daemons notice the new partition table right away and can
# grab the new boot partition before we get to it - settle and
# unmount once more before partitioning further.
udevadm settle --timeout=5 2>/dev/null || true
sleep 1
unmount_device_partitions

# ---- create ZIMDATA partition ----

step "Creating ZIMDATA partition (rest of the card, capped at $(numfmt --to=iec "$MAX_ZIMDATA_BYTES"))"
FREE_BYTES=$(sfdisk -F --bytes "$DEVICE" | head -1 | sed -n 's/.*, \([0-9]*\) bytes,.*/\1/p')
if [ -n "$FREE_BYTES" ] && [ "$FREE_BYTES" -gt "$MAX_ZIMDATA_BYTES" ]; then
  info "$(numfmt --to=iec "$FREE_BYTES") available - capping ZIMDATA at $(numfmt --to=iec "$MAX_ZIMDATA_BYTES")"
  echo ",$((MAX_ZIMDATA_BYTES / 512)),83" | sfdisk --force --append "$DEVICE"
else
  echo ',,83' | sfdisk --force --append "$DEVICE"
fi

i=0
until partprobe "$DEVICE" 2>/dev/null; do
  i=$((i + 1))
  [ "$i" -ge 5 ] && break
  unmount_device_partitions
  sleep 1
done

ZIMDATA_PART="$(part_path 3)"
i=0
while [ ! -b "$ZIMDATA_PART" ] && [ "$i" -lt 10 ]; do
  sleep 1
  i=$((i + 1))
done

if [ ! -b "$ZIMDATA_PART" ]; then
  die "$ZIMDATA_PART didn't appear after creating it. This machine's kernel may be holding a stale view of $DEVICE (a known quirk with USB card readers after repeated partitioning this session) - unplug and reinsert the card reader, then run: sudo mkfs.ext4 -F -L ZIMDATA $ZIMDATA_PART"
fi

step "Formatting $ZIMDATA_PART as ext4 (label ZIMDATA)"
mkfs.ext4 -q -F -L ZIMDATA "$ZIMDATA_PART"

# ---- copy the library ----

if [ "$COPY_ZIMS" -eq 1 ]; then
  step "Copying ZIM library onto $ZIMDATA_PART"
  SCRATCH_MOUNT="$(mktemp -d)"
  mount "$ZIMDATA_PART" "$SCRATCH_MOUNT"
  rsync -a --info=progress2 "$ZIMS_DIR/" "$SCRATCH_MOUNT/"
  umount "$SCRATCH_MOUNT"
  rmdir "$SCRATCH_MOUNT"
  SCRATCH_MOUNT=""
  info "library copied"
else
  step "Skipped copying the library"
  info "copy it later with:"
  info "  sudo mount $ZIMDATA_PART /mnt && sudo rsync -a --info=progress2 zims/ /mnt/ && sudo umount /mnt"
fi

step "Done"
info "Card is ready for $BOARD. Put it in the Pi and power it on."

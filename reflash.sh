#!/usr/bin/env bash
# Reflash an StashPi SD card with a freshly built OS image, preserving
# the ZIMDATA partition (the library) if one already exists on the card.
#
# Usage:
#   sudo ./reflash.sh <rpi3|rpi4|rpi5> <device> [-y]
#
# Example:
#   sudo ./reflash.sh rpi4 /dev/sdd
#
# What it does, in order, stopping immediately on any failure:
#   1. Sanity-checks the board, image, and device (refuses non-removable
#      or too-small devices unless the device is explicitly removable)
#   2. Unmounts anything currently mounted from the device
#   3. Backs up the current partition table (if any) to a timestamped file
#   4. If a ZIMDATA partition (3rd partition) already exists, mounts it
#      and reports what's on it, as a last sanity check before wiping
#      the boot/rootfs region
#   5. Prompts for confirmation (unless -y is passed)
#   6. Writes the new sdcard.img with dd
#   7. Restores the partition table, so ZIMDATA (if any existed) reappears
#      pointing at the same, untouched data - no reformat, no data loss
#   8. Re-mounts ZIMDATA and verifies it's still readable

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Running under sudo, $HOME is root's, not the invoking user's - land
# backups somewhere the actual user can read without another sudo.
REAL_HOME="$HOME"
if [ -n "${SUDO_USER:-}" ]; then
  REAL_HOME="$(getent passwd "$SUDO_USER" | cut -d: -f6)"
fi
BACKUP_DIR="$REAL_HOME/stashpi-backups"
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

# ---- args ----

BOARD="${1:-}"
DEVICE="${2:-}"
[ "${3:-}" = "-y" ] && ASSUME_YES=1

if [ -z "$BOARD" ] || [ -z "$DEVICE" ]; then
  die "usage: sudo ./reflash.sh <rpi3|rpi4|rpi5> <device> [-y]"
fi

case "$BOARD" in
  rpi3|rpi4|rpi5) ;;
  *) die "unknown board '$BOARD' (expected rpi3, rpi4, or rpi5)" ;;
esac

[ "$EUID" -eq 0 ] || die "must be run as root (sudo ./reflash.sh $BOARD $DEVICE)"

IMAGE="$SCRIPT_DIR/buildroot/output-$BOARD/images/sdcard.img"

# ---- sanity checks ----

step "Checking image and device"

[ -f "$IMAGE" ] || die "image not found: $IMAGE (build it first with ./build.sh $BOARD)"
info "image: $IMAGE ($(du -h "$IMAGE" | cut -f1))"

[ -b "$DEVICE" ] || die "$DEVICE is not a block device"

DEVNAME="$(basename "$DEVICE")"
REMOVABLE_FILE="/sys/block/$DEVNAME/removable"
if [ -f "$REMOVABLE_FILE" ] && [ "$(cat "$REMOVABLE_FILE")" != "1" ]; then
  die "$DEVICE does not report as removable - refusing to touch what looks like a fixed disk. If this is really the SD card reader, check /sys/block/$DEVNAME/removable manually before overriding this check."
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

# ---- unmount anything currently mounted from this device ----

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

# ---- back up partition table ----

step "Backing up current partition table"

mkdir -p "$BACKUP_DIR"
[ -n "${SUDO_USER:-}" ] && chown "$SUDO_USER" "$BACKUP_DIR" 2>/dev/null || true
BACKUP_FILE="$BACKUP_DIR/${DEVNAME}-$(date +%Y%m%d-%H%M%S).sfdisk"
if sfdisk -d "$DEVICE" > "$BACKUP_FILE" 2>/dev/null; then
  [ -n "${SUDO_USER:-}" ] && chown "$SUDO_USER" "$BACKUP_FILE" 2>/dev/null || true
  info "saved to $BACKUP_FILE"
  cat "$BACKUP_FILE" | sed 's/^/    /'
else
  info "no existing partition table found (blank card) - nothing to back up"
  rm -f "$BACKUP_FILE"
  BACKUP_FILE=""
fi

# ---- verify existing ZIMDATA, if present, before wiping anything ----

ZIMDATA_PART=""
# Whether ZIMDATA exists is decided from the backup file's actual
# content (the real on-disk partition table), not from whether the
# kernel currently exposes a /dev node for it - that can be stale
# (e.g. left over from a previous run whose restore step failed),
# which would otherwise make us back up and "restore" an incomplete
# table without any indication something was wrong.
if [ -n "$BACKUP_FILE" ] && grep -qE "^${DEVICE}${PART_SUFFIX}3[[:space:]]*:" "$BACKUP_FILE"; then
  ZIMDATA_PART="$(part_path 3)"
  step "Checking existing ZIMDATA partition ($ZIMDATA_PART)"
  if [ -b "$ZIMDATA_PART" ]; then
    SCRATCH_MOUNT="$(mktemp -d)"
    if mount -o ro "$ZIMDATA_PART" "$SCRATCH_MOUNT" 2>/dev/null; then
      info "contents:"
      ls -la "$SCRATCH_MOUNT" | sed 's/^/    /'
      info "usage: $(df -h "$SCRATCH_MOUNT" | tail -1 | awk '{print $3" used / "$2" total"}')"
      umount "$SCRATCH_MOUNT"
    else
      info "could not mount $ZIMDATA_PART (unrecognized filesystem) - will still restore its partition table entry"
    fi
    rmdir "$SCRATCH_MOUNT"
    SCRATCH_MOUNT=""
  else
    info "partition table lists a 3rd partition but the kernel doesn't see it yet - will restore its entry anyway"
  fi
fi

# ---- confirm ----

step "Ready to flash"
info "board:  $BOARD"
info "image:  $IMAGE"
info "device: $DEVICE"
if [ -n "$ZIMDATA_PART" ]; then
  info "ZIMDATA partition ($ZIMDATA_PART) will be preserved (partition table restored after flashing)"
else
  info "no existing ZIMDATA partition detected - card will need it provisioned on first boot"
fi

if [ "$ASSUME_YES" -ne 1 ]; then
  read -r -p "Type the device path ($DEVICE) to confirm and continue: " CONFIRM
  [ "$CONFIRM" = "$DEVICE" ] || die "confirmation did not match, aborting"
fi

# ---- flash ----

step "Writing image to $DEVICE"
dd if="$IMAGE" of="$DEVICE" bs=4M status=progress conv=fsync
sync

# The kernel/automount daemons notice the freshly-written partition
# table right away and can auto-mount the new boot partition before we
# get a chance to touch the disk again - settle and unmount once more
# or sfdisk will refuse to run against a disk "in use".
udevadm settle --timeout=5 2>/dev/null || true
sleep 1
unmount_device_partitions

# ---- restore partition table ----

KERNEL_STALE=0
if [ -n "$BACKUP_FILE" ]; then
  step "Restoring partition table (recreates ZIMDATA over the untouched data)"
  sfdisk --no-reread "$DEVICE" < "$BACKUP_FILE"

  # Confirm the write itself succeeded by re-reading the actual on-disk
  # bytes directly - independent of whether the kernel's live view of
  # the device has caught up yet, which is checked separately below.
  if [ -n "$ZIMDATA_PART" ] && ! sfdisk -d "$DEVICE" 2>/dev/null | grep -qE "^${DEVICE}${PART_SUFFIX}3[[:space:]]*:"; then
    die "partition table write appears to have failed - ${DEVICE}${PART_SUFFIX}3's entry is missing from the on-disk table. Do NOT put this card in the Pi. Investigate with 'sudo sfdisk -d $DEVICE' before retrying."
  fi

  step "Asking the kernel to notice the new partition table"
  i=0
  until partprobe "$DEVICE" 2>/dev/null; do
    i=$((i + 1))
    [ "$i" -ge 5 ] && break
    unmount_device_partitions
    sleep 1
  done

  if [ -n "$ZIMDATA_PART" ]; then
    i=0
    while [ ! -b "$ZIMDATA_PART" ] && [ "$i" -lt 10 ]; do
      sleep 1
      i=$((i + 1))
    done
    [ -b "$ZIMDATA_PART" ] || KERNEL_STALE=1
  fi
fi

# ---- verify ----

if [ -n "$ZIMDATA_PART" ]; then
  if [ "$KERNEL_STALE" -eq 1 ]; then
    step "Partition table written; kernel view is stale"
    info "The partition table on the card is confirmed correct (verified by"
    info "re-reading it directly), but this machine's kernel is still holding"
    info "an old view of the device - a common quirk with USB card readers"
    info "and desktop automount services, not a problem with the card."
    info "Unplug and reinsert the card reader (or just put the card straight"
    info "in the Pi) and $ZIMDATA_PART will be there."
  else
    step "Verifying ZIMDATA survived"
    SCRATCH_MOUNT="$(mktemp -d)"
    if mount -o ro "$ZIMDATA_PART" "$SCRATCH_MOUNT" 2>/dev/null; then
      ls -la "$SCRATCH_MOUNT" | sed 's/^/    /'
      umount "$SCRATCH_MOUNT"
      info "ZIMDATA OK"
    else
      info "WARNING: could not mount $ZIMDATA_PART after restoring the partition table - check it manually"
    fi
    rmdir "$SCRATCH_MOUNT"
    SCRATCH_MOUNT=""
  fi
fi

step "Done"
info "Flashed $BOARD to $DEVICE successfully."

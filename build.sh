#!/usr/bin/env bash
# Build the StashPi appliance image for one board.
#
# Usage:
#   ./build.sh rpi4                  # configure (if needed) + build everything
#   ./build.sh rpi4 menuconfig       # open the Buildroot config UI
#   ./build.sh rpi4 libkiwix-stashpi-rebuild   # rebuild just one package
set -euo pipefail
cd "$(dirname "$0")"

BOARD="${1:?usage: build.sh <rpi3|rpi4|rpi5> [make-target...]}"
shift || true

case "$BOARD" in
  rpi3|rpi4|rpi5) ;;
  *) echo "unknown board '$BOARD' (expected rpi3, rpi4, or rpi5)" >&2; exit 1 ;;
esac

BR2_EXTERNAL_PATH="$(pwd)/br2-external/stashpi"
OUTPUT_DIR="$(pwd)/buildroot/output-${BOARD}"
mkdir -p "$OUTPUT_DIR"

# Buildroot's dependency check rejects uutils' `install` (rust coreutils),
# which is the default /usr/bin/install on this machine. Rather than touch
# system-wide update-alternatives, shim a GNU `install` onto PATH just for
# this build.
TOOLBIN="$(pwd)/.buildtools"
mkdir -p "$TOOLBIN"
[ -L "$TOOLBIN/install" ] || ln -sf /usr/bin/gnuinstall "$TOOLBIN/install" 2>/dev/null || true
export PATH="$TOOLBIN:$PATH"

if [ ! -f "$OUTPUT_DIR/.config" ]; then
	make -C buildroot O="$OUTPUT_DIR" BR2_EXTERNAL="$BR2_EXTERNAL_PATH" "stashpi_${BOARD}_defconfig"
fi

if [ "$#" -eq 0 ]; then
	make -C buildroot O="$OUTPUT_DIR" BR2_EXTERNAL="$BR2_EXTERNAL_PATH"
else
	make -C buildroot O="$OUTPUT_DIR" BR2_EXTERNAL="$BR2_EXTERNAL_PATH" "$@"
fi

# StashPi — building and deploying

StashPi is a minimal Buildroot-based Linux image for Raspberry Pi 3B+/4/5
that boots straight into `kiwix-serve`, serving the ZIM library from
`zims/` on port 80.

## Building

```sh
cd /home/brian/Work/StashPi
./build.sh rpi4          # or rpi3 / rpi5
```

This configures (first run only) and builds everything: cross toolchain,
kernel, rootfs, and our three custom packages (`libzim-stashpi`,
`libkiwix-stashpi` from the fork in `libkiwix_stashpi/`, and
`kiwix-tools-stashpi`, which produces `kiwix-serve`). Expect this to take
well over an hour on first run per board — most of it is the toolchain,
kernel, ICU, and Xapian.

Output image: `buildroot/output-<board>/images/sdcard.img`.

Useful follow-up commands:
```sh
./build.sh rpi4 menuconfig                    # tweak the Buildroot config
./build.sh rpi4 libkiwix-stashpi-rebuild       # rebuild just libkiwix after local edits
./build.sh rpi4 kiwix-tools-stashpi-reconfigure  # after changing meson options
```

`libzim-stashpi`, `libkiwix-stashpi`, and `kiwix-tools-stashpi` all build
directly from the checkouts at `deps/libzim`, `libkiwix_stashpi`, and
`kiwix-tools` respectively (via Buildroot's `OVERRIDE_SRCDIR`, not a
downloaded tarball) — edit those trees and rebuild the corresponding
`-rebuild` target to pick up changes.

**Known quirk**: after editing `libkiwix_stashpi`, a plain `./build.sh
<board>` has repeatedly picked up the source change for whichever board
was built/rebuilt first, but *not* for the other two run afterward (they
silently reused the stale library). If you're building all three boards
after a `libkiwix_stashpi` change, explicitly force it on all three
first:
```sh
for b in rpi4 rpi5 rpi3; do ./build.sh $b libkiwix-stashpi-rebuild; done
for b in rpi4 rpi5 rpi3; do ./build.sh $b; done
```
Verify with `strings buildroot/output-<board>/target/usr/lib/libkiwix.so.14.2.1 | grep <something-you-just-changed>` before trusting an image.

## Flashing

Two scripts, for two different situations — both refuse non-removable
devices and this machine's own root disk, require typing the device path
back to confirm, and stop immediately (`set -euo pipefail`) on any
unexpected failure.

**A brand-new card that's never had StashPi on it** — writes the OS
image, creates and formats the `ZIMDATA` partition, and copies `zims/`
onto it in one go:
```sh
sudo ./init-flash.sh rpi4 /dev/sdX
```
Pass `--no-copy` to skip copying the library (e.g. you'll do it over the
network instead), and `-y` to skip the confirmation prompt. It refuses to
run if the card already looks like it has a library on it (a partition
labeled `ZIMDATA`) — use `reflash.sh` for that case instead.

**A card that already has a library on it** (updating the OS without
losing the ~434GB you already copied over):
```sh
sudo ./reflash.sh rpi4 /dev/sdX
```
It backs up the partition table first, verifies the library before *and*
after flashing, and restores the partition table afterward so the
existing library survives without needing to be recopied.

Both scripts create the `ZIMDATA` partition the same way: appending a
partition to the rest of the card (capped at 470GB even on bigger cards)
and formatting ext4. If `sfdisk`
refuses with "device or resource busy," or the new partition doesn't
show up afterward, that's a known quirk with USB card readers holding a
stale kernel view after repeated partitioning in the same session —
physically unplug and reinsert the reader, then retry; both scripts also
tell you this and give the exact follow-up command if it happens.

If you'd rather do either by hand, see the scripts themselves — they're
straight-line bash with no cleverness hidden in functions you can't read.

`kiwix-serve` looks for `/zims/library.xml`, so once the ZIM files and
`library.xml` (already present in `zims/`, listing all 18 books) are on
`ZIMDATA`, `S99kiwix` will find it on the next boot and start serving.
For a card set up without `init-flash.sh`'s copy step, do it manually:
```sh
sudo mkdir -p /mnt/zimdata
sudo mount /dev/sdX3 /mnt/zimdata
sudo rsync -a --info=progress2 zims/ /mnt/zimdata/
sudo umount /mnt/zimdata
```
Or over the network after first boot, using the dropbear SSH server that
ships on the image (slow for ~434GB over anything less than a fast wired
LAN):
```sh
rsync -a --info=progress2 -e ssh zims/ root@<pi-ip-or-hostname>:/zims/
```

## Flashing a custom ZIM selection (per-order builds)

`init-flash.sh` and `reflash.sh` both work off the full `zims/` directory.
For a web-store order that only includes a subset of libraries, use
`flash-zims.sh` instead — it only ever touches the `ZIMDATA` partition
(never the OS/boot partitions) and rewrites it to contain exactly the
requested ZIMs, regenerating a matching `library.xml` filtered from the
master copy (so ids/titles/icons/display order are untouched).

See what's available:
```sh
./flash-zims.sh --list
```

Brand-new card, custom order:
```sh
sudo ./init-flash.sh rpi4 /dev/sdX --no-copy
sudo ./flash-zims.sh /dev/sdX --zims wikipedia,maps,mdwiki
```

Card that already has a library on it and needs a different selection:
```sh
sudo ./flash-zims.sh /dev/sdX --zims wikipedia,maps,gutenberg,recipes
```

Or everything:
```sh
sudo ./flash-zims.sh /dev/sdX --all
```

`chess.zim` is always included at no charge, matching the web store's
"bundled" behavior — it's never listed as a selectable id. The ids
(`maps`, `wikipedia`, `mdwiki`, `gutenberg`, `recipes`, `food-preppers`,
`usda-canning`, `medicines`, `medical-library`, `wikisource`,
`wikispecies`, `cheatsheets`) match `web/config.js`'s `ZIM_GROUPS` ids
one-to-one — if a ZIM is ever added or renamed, update both the
`ZIM_FILES` map at the top of `flash-zims.sh` and `web/config.js`
together.

## First boot / accessing the library

The Pi runs its own WiFi access point — no router or existing network
needed:

- **Network name (SSID): `StashPi`**, open (no password).
- Connect any phone/laptop/tablet to it, then browse to
  `http://1.1.1.1/` — `kiwix-serve` listens there on port 80.
- The network has no internet uplink, so phones will correctly show it as
  "no internet" — that's expected, not a bug. (An earlier version of this
  image tried to redirect every DNS query to the Pi so any URL would land
  on the library, but that just made iOS's captive-portal popup show a
  dead-end 404 instead of anything useful — removed in favor of just
  browsing to the IP directly.)
- Ethernet (`eth0`) is still DHCP-enabled in parallel, for wired
  admin/debug access if you have a router/switch handy — it's independent
  of the WiFi AP.
- SSH is available via dropbear on either interface. **Change the default
  root password** (`stashpi`, set in the defconfig's
  `BR2_TARGET_GENERIC_ROOT_PASSWD`) before deploying anywhere untrusted —
  either edit the defconfig and rebuild, or `passwd` over SSH/console on
  the running image.
- To change the SSID/security, edit
  `br2-external/stashpi/rootfs-overlay/etc/hostapd.conf` and rebuild (see
  `hostapd.conf(5)` for WPA2 options — add `wpa=2`, `wpa_passphrase=...`,
  `wpa_key_mgmt=WPA-PSK`, `rsn_pairwise=CCMP` to switch from open to
  password-protected).
- WiFi AP mode depends on the Pi's onboard chip and firmware
  (`brcmfmac` + `linux-firmware` blobs) initializing correctly — this
  could only be verified by build inspection here, not on real hardware,
  so if `http://1.1.1.1/` doesn't come up, check `dmesg | grep brcmfmac`
  and `/var/log/hostapd.log`-equivalent (`hostapd_cli status` if needed)
  over a wired/SSH or serial console first.

## Adding/updating ZIMs later

Copy new `.zim` files into `/zims` (same rsync approach as above), then
regenerate `library.xml` with `kiwix-manage` (also on the image) and
restart the service:
```sh
kiwix-manage /zims/library.xml add /zims/newbook.zim
/etc/init.d/S99kiwix restart
```

**Note**: `kiwix-manage add` sometimes writes the path with a leading
`../` (seen when adding `chess.zim`) instead of the plain filename every
other entry uses. Check `library.xml` after adding and fix the `path="`
attribute by hand if needed — a `../`-prefixed path resolves one
directory above `/zims` on the real device and will fail to load.

## Adding a mini web-app as its own "book"

ZIM files don't have to be reference content — a self-contained static
web app (HTML/CSS/JS, no build step, no network calls since the device
has no internet uplink) packages into a ZIM just as well and shows up as
a normal tile on the library home page. `chess.zim` (a playable chess
game, vs. a built-in AI or 2-player pass-and-play) was built exactly
this way — see `apps/chess/` for a working example, including how a
third-party JS dependency (`chess.js`, BSD-2-Clause) is vendored
alongside its license file.

`tools/dir2zim` is a compiled binary and isn't tracked in the repo (see
`docs/VENDORED_DEPENDENCIES.md`) — build it once from source after a
fresh clone:
```sh
g++ -std=c++17 -O2 -I local/include -L local/lib/x86_64-linux-gnu \
    -Wl,-rpath,local/lib/x86_64-linux-gnu \
    tools/dir2zim.cpp -lzim -o tools/dir2zim
```

```sh
export LD_LIBRARY_PATH=local/lib/x86_64-linux-gnu   # host build of libzim
./tools/dir2zim apps/<name> zims/<name>.zim index.html "<Title>" eng
kiwix-manage zims/library.xml add --zimPathToSave=<name>.zim zims/<name>.zim
```

`tools/dir2zim.cpp` is a small generic packager (built against libzim's
`Creator` API) that walks a directory and adds every file to a new ZIM,
guessing MIME types by extension — reusable for any future app, not
specific to chess. Since ZIMs live on the `ZIMDATA` partition rather than
being baked into the OS image, adding one doesn't require touching
Buildroot or rebuilding `sdcard.img` at all — it just needs to be in
`zims/` before the next `init-flash.sh`/rsync/`reflash.sh`, or copied
onto an already-deployed card the same way as any other ZIM (above).

## Browsing a USB drive plugged into the Pi

Plug a USB drive (FAT32, exFAT, NTFS, or ext4) into any of the Pi's USB
ports. Within a few seconds `S46usbdrive` auto-mounts it read-only at
`/mnt/usb`, and the "USB Drive" tile on the kiwix library home page
(`http://1.1.1.1/`) will let you browse and preview its files - images,
PDFs, text files, and small audio/video clips render inline; anything
else offers a direct download link. This works from any browser
(including Safari/iOS), since it's served over plain HTTP by
`kiwix-serve` itself (`/usbdrive` endpoints in `libkiwix_stashpi`) rather
than relying on the browser's local File System Access API.

The drive is mounted **read-only** - this can't write to or modify
anything on it - and file previews are capped at 64MB (it's meant for
quick previews, not bulk downloads). Only one drive is supported at a
time; unplugging it is detected automatically and the panel will show
"no USB drive" until one is reconnected.

## Troubleshooting

- `/var/log/kiwix-serve.log` — kiwix-serve's stdout/stderr.
- `/var/log/zimdata-partition.log` — output from the first-boot partition
  creation (`sfdisk`), if the ZIMDATA partition didn't appear as expected.
- `/etc/init.d/S41zimdata start` / `/etc/init.d/S99kiwix start` — rerun
  either step manually from a console if something didn't come up.

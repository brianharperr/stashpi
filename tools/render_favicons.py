import os
import gi
gi.require_version('Rsvg', '2.0')
gi.require_version('GdkPixbuf', '2.0')
from gi.repository import Rsvg, GdkPixbuf

def render(svg_path, size, out_path):
    handle = Rsvg.Handle.new_from_file(svg_path)
    pixbuf = handle.get_pixbuf_and_error()
    if pixbuf.get_width() != size or pixbuf.get_height() != size:
        pixbuf = pixbuf.scale_simple(size, size, GdkPixbuf.InterpType.BILINEAR)
    pixbuf.savev(out_path, "png", [], [])
    print(f"wrote {out_path} ({size}x{size})")

KIT = "/home/brian/Downloads/StashPi_SVG_Logo_Kit_v8"
DEV_FAV = "/home/brian/Work/StashPi/libkiwix_stashpi/static/skin/favicon"
WEB_FAV = "/home/brian/Work/StashPi/web/assets/favicon"
os.makedirs(WEB_FAV, exist_ok=True)

# Device favicon set (filenames must match what index.html already references)
render(f"{KIT}/stashpi-icon-32.svg", 16, f"{DEV_FAV}/favicon-16x16.png")
render(f"{KIT}/stashpi-icon-32.svg", 32, f"{DEV_FAV}/favicon-32x32.png")
render(f"{KIT}/stashpi-icon-180.svg", 180, f"{DEV_FAV}/apple-touch-icon.png")
render(f"{KIT}/stashpi-icon-192.svg", 192, f"{DEV_FAV}/android-chrome-192x192.png")
render(f"{KIT}/stashpi-icon-512.svg", 512, f"{DEV_FAV}/android-chrome-512x512.png")
render(f"{KIT}/stashpi-icon-512.svg", 128, f"{DEV_FAV}/mstile-70x70.png")
render(f"{KIT}/stashpi-icon-512.svg", 144, f"{DEV_FAV}/mstile-144x144.png")
render(f"{KIT}/stashpi-icon-512.svg", 270, f"{DEV_FAV}/mstile-150x150.png")
render(f"{KIT}/stashpi-icon-512.svg", 558, f"{DEV_FAV}/mstile-310x150.png")
render(f"{KIT}/stashpi-icon-512.svg", 558, f"{DEV_FAV}/mstile-310x310.png")

# Web favicon set
render(f"{KIT}/stashpi-icon-32.svg", 16, f"{WEB_FAV}/favicon-16x16.png")
render(f"{KIT}/stashpi-icon-32.svg", 32, f"{WEB_FAV}/favicon-32x32.png")
render(f"{KIT}/stashpi-icon-180.svg", 180, f"{WEB_FAV}/apple-touch-icon.png")
render(f"{KIT}/stashpi-icon-192.svg", 192, f"{WEB_FAV}/android-chrome-192x192.png")
render(f"{KIT}/stashpi-icon-512.svg", 512, f"{WEB_FAV}/android-chrome-512x512.png")

print("done")

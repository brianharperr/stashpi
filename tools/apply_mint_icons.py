import base64
import re
import xml.etree.ElementTree as ET

MINT = "#62E6C4"
ICONS_SRC = "/home/brian/Work/StashPi/apps/icons/src"
LIBRARY_PATH = "/home/brian/Work/StashPi/zims/library.xml"

def load_outline(name):
    with open(f"{ICONS_SRC}/{name}.svg") as f:
        content = f.read()
    content = re.sub(r"<!--.*?-->\s*", "", content, flags=re.DOTALL)
    content = content.replace('stroke="currentColor"', f'stroke="{MINT}"')
    return content.strip()

def load_asclepius():
    with open(f"{ICONS_SRC}/asclepius.svg") as f:
        content = f.read()
    content = content.replace("fill:#000", f"fill:{MINT}")
    return content.strip()

ICONS = {
    "globe": load_outline("world"),
    "jar": load_outline("bottle"),
    "document": load_outline("file-text"),
    "bird": load_outline("bird"),
    "asclepius": load_asclepius(),
    "pill": load_outline("pill"),
    "pot": load_outline("chef-hat"),
    "pawn": load_outline("chess"),
    "almanac": load_outline("almanac"),
    "calculator": load_outline("calculator"),
    "cpr-timer": load_outline("cpr-timer"),
    "kitchen-calc": load_outline("kitchen-calc"),
    "puzzles": load_outline("puzzles"),
    "system-info": load_outline("system-info"),
}

BOOK_ICON = {
    "maps_world.zim": "globe",
    "zimgit-food-preparation_en_2025-04.zim": "jar",
    "wikisource_en_all_nopic_2026-08.zim": "document",
    "wikispecies_en_all_maxi_2026-07.zim": "bird",
    "mdwiki.zim": "asclepius",
    "medicines_2025-12.zim": "pill",
    "based.cooking_en_all_2026-08.zim": "pot",
    "usda-2015_en_2025-04.zim": "jar",
    "zimgit-medicine_en_2024-08.zim": "asclepius",
    "cheatography.com_en_all_2025-07.zim": "document",
    "chess.zim": "pawn",
    "almanac.zim": "almanac",
    "calculator.zim": "calculator",
    "cpr-timer.zim": "cpr-timer",
    "kitchen-calc.zim": "kitchen-calc",
    "puzzles.zim": "puzzles",
    "system-info.zim": "system-info",
}

tree = ET.parse(LIBRARY_PATH)
root = tree.getroot()

changed = []
for book in root.findall("book"):
    path = book.get("path")
    if path not in BOOK_ICON:
        continue
    icon_name = BOOK_ICON[path]
    svg_data = ICONS[icon_name]
    b64 = base64.b64encode(svg_data.encode("utf-8")).decode("ascii")
    book.set("faviconMimeType", "image/svg+xml")
    book.set("favicon", b64)
    changed.append((path, icon_name))

tree.write(LIBRARY_PATH, encoding="unicode", xml_declaration=False)

print(f"updated {len(changed)} books:")
for p, i in changed:
    print(f"  {p}: icon={i}")

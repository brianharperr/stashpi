import re

MINT = "#62E6C4"
ICONS_SRC = "/home/brian/Work/StashPi/apps/icons/src"
OUT_DIR = "/home/brian/Work/StashPi/web/assets/tile-icons"

def load_outline(name):
    with open(f"{ICONS_SRC}/{name}.svg") as f:
        content = f.read()
    content = re.sub(r"<!--.*?-->\s*", "", content, flags=re.DOTALL)
    content = content.replace('stroke="currentColor"', f'stroke="{MINT}"')
    return content.strip()

def load_asclepius():
    with open(f"{ICONS_SRC}/asclepius.svg") as f:
        content = f.read()
    return content.replace("fill:#000", f"fill:{MINT}").strip()

FILES = {
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

for name, svg in FILES.items():
    with open(f"{OUT_DIR}/{name}.svg", "w") as f:
        f.write(svg)
    print(f"wrote {name}.svg")

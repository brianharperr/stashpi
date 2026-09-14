# Regenerates docs/ZIM_LIBRARY.md from zims/library.xml. Run this any
# time the library changes (a ZIM added/removed/updated) so the
# human-readable reference doc doesn't drift from the actual library.
# The repo doesn't track the ZIM files themselves (see
# docs/VENDORED_DEPENDENCIES.md and .gitignore) — this table plus
# zims/library.xml are what's kept for reference instead.
import datetime
import xml.etree.ElementTree as ET

LIBRARY_PATH = "/home/brian/Work/StashPi/zims/library.xml"
OUT_PATH = "/home/brian/Work/StashPi/docs/ZIM_LIBRARY.md"

tree = ET.parse(LIBRARY_PATH)
root = tree.getroot()

books = []
for b in root.findall("book"):
    size_kb = float(b.get("size") or 0)
    books.append({
        "title": b.get("title") or "",
        "date": b.get("date") or "",
        "lang": b.get("language") or "",
        "desc": b.get("description") or "",
        "articles": int(b.get("articleCount") or 0),
        "gb": size_kb / (1024 * 1024),
        "path": b.get("path") or "",
    })
books.sort(key=lambda x: -x["gb"])
total_gb = sum(b["gb"] for b in books)


def size_str(gb):
    if gb >= 1:
        return f"{gb:.1f} GB"
    mb = gb * 1024
    return f"{mb:.1f} MB" if mb >= 1 else f"{mb * 1024:.0f} KB"


lines = [
    "# ZIM library reference",
    "",
    "The ZIM files themselves aren't tracked in this repo (400+ GB — see "
    "`docs/VENDORED_DEPENDENCIES.md`), but this table and the raw "
    f"`zims/library.xml` manifest it's generated from are, for reference. "
    f"Regenerate with `python3 tools/generate_zim_library_doc.py` after "
    "changing the library.",
    "",
    f"**{len(books)} books, {total_gb:.1f} GB total.**",
    "",
    "| Title | Size | Content date | Language | Articles | ZIM file |",
    "|---|---|---|---|---|---|",
]
for b in books:
    lines.append(
        f"| {b['title']} | {size_str(b['gb'])} | {b['date']} | {b['lang']} "
        f"| {b['articles']:,} | `{b['path']}` |"
    )

lines += [
    "",
    "## Descriptions",
    "",
]
for b in books:
    lines.append(f"- **{b['title']}** — {b['desc']}")

lines += [
    "",
    f"_Generated {datetime.date.today().isoformat()} from `zims/library.xml`._",
    "",
]

with open(OUT_PATH, "w") as f:
    f.write("\n".join(lines))
print(f"wrote {OUT_PATH} ({len(books)} books)")

#!/usr/bin/env python3
"""Bundle Pop Piano Atlas into one self-contained HTML file (dist/pop-piano-atlas.html)."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
html = (ROOT / "index.html").read_text(encoding="utf-8")

# inline the stylesheet
css = (ROOT / "css/styles.css").read_text(encoding="utf-8")
html = re.sub(
    r'<link rel="stylesheet" href="css/styles.css" />',
    "<style>\n" + css + "\n</style>",
    html,
)

# inline the scripts, preserving order
def inline_script(match):
    src = match.group(1)
    js = (ROOT / src).read_text(encoding="utf-8")
    return "<script>\n" + js + "\n</script>"

html = re.sub(r'<script src="(js/[a-z]+\.js)"></script>', inline_script, html)

assert "src=" not in html.split("<body>")[1], "unresolved script tag left in bundle"
assert 'href="css' not in html, "unresolved stylesheet link left in bundle"

out = ROOT / "dist" / "pop-piano-atlas.html"
out.parent.mkdir(exist_ok=True)
out.write_text(html, encoding="utf-8")
print(f"wrote {out} ({out.stat().st_size:,} bytes)")

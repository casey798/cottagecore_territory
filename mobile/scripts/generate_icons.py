"""
generate_icons.py
Generates all Android launcher and notification icons for GroveWars.
Run from any directory; paths are resolved relative to this script's location.
"""

import os
import sys
from pathlib import Path

try:
    from PIL import Image, ImageChops
except ImportError:
    print("Pillow not found — installing...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow"])
    from PIL import Image, ImageChops

# ── Resolve paths ────────────────────────────────────────────────────────────

SCRIPT_DIR   = Path(__file__).resolve().parent          # mobile/scripts/
MOBILE_DIR   = SCRIPT_DIR.parent                        # mobile/
PROJECT_ROOT = MOBILE_DIR.parent                        # project root
ANDROID_RES  = PROJECT_ROOT / "android" / "app" / "src" / "main" / "res"

LOGO_PATH = MOBILE_DIR / "docs" / "logo.png"
ICON_PATH = MOBILE_DIR / "docs" / "icon.png"

assert LOGO_PATH.exists(), f"logo.png not found at {LOGO_PATH}"
assert ICON_PATH.exists(), f"icon.png not found at {ICON_PATH}"

print(f"logo : {LOGO_PATH}")
print(f"icon : {ICON_PATH}")
print()

written: list[str] = []


def save(img: Image.Image, path: Path) -> None:
    """Create parent dirs, save image, record result."""
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(str(path), "PNG")
    w, h = img.size
    written.append(f"  {path.relative_to(PROJECT_ROOT)}  ({w}×{h})")


# ── Load source images ───────────────────────────────────────────────────────

logo_src = Image.open(LOGO_PATH).convert("RGBA")
icon_src = Image.open(ICON_PATH).convert("RGBA")

# ── 1. LEGACY LAUNCHER ICON (ic_launcher.png) ────────────────────────────────

launcher_sizes = {
    "mipmap-mdpi":    48,
    "mipmap-hdpi":    72,
    "mipmap-xhdpi":   96,
    "mipmap-xxhdpi":  144,
    "mipmap-xxxhdpi": 192,
}

print("Step 1 — Legacy launcher icons (ic_launcher.png)")
for folder, size in launcher_sizes.items():
    img = logo_src.resize((size, size), Image.LANCZOS)
    save(img, ANDROID_RES / folder / "ic_launcher.png")

# ── 2. ADAPTIVE FOREGROUND (ic_launcher_foreground.png) ─────────────────────
# Logo is resized to 66% of the canvas, then centered on a transparent canvas.

foreground_sizes = {
    "mipmap-mdpi":    108,
    "mipmap-hdpi":    162,
    "mipmap-xhdpi":   216,
    "mipmap-xxhdpi":  324,
    "mipmap-xxxhdpi": 432,
}

# Pre-computed logo sizes (floor of canvas * 0.66, matching spec exactly).
foreground_logo_sizes = {
    "mipmap-mdpi":     71,
    "mipmap-hdpi":    107,
    "mipmap-xhdpi":   143,
    "mipmap-xxhdpi":  214,
    "mipmap-xxxhdpi": 285,
}

print("Step 2 — Adaptive foreground icons (ic_launcher_foreground.png)")
for folder, canvas_size in foreground_sizes.items():
    logo_size = foreground_logo_sizes[folder]
    # Resize logo to 66% of canvas using LANCZOS
    logo_resized = logo_src.resize((logo_size, logo_size), Image.LANCZOS)
    # Create transparent canvas at full canvas size
    canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    # Center the logo on the canvas
    offset = ((canvas_size - logo_size) // 2, (canvas_size - logo_size) // 2)
    canvas.paste(logo_resized, offset, logo_resized)
    save(canvas, ANDROID_RES / folder / "ic_launcher_foreground.png")

# ── 3. ADAPTIVE BACKGROUND (ic_launcher_background.png) ─────────────────────

print("Step 3 — Adaptive background icons (ic_launcher_background.png)")
for folder, size in foreground_sizes.items():
    img = logo_src.resize((size, size), Image.LANCZOS)
    save(img, ANDROID_RES / folder / "ic_launcher_background.png")

# ── 4. ADAPTIVE ICON XML ─────────────────────────────────────────────────────

print("Step 4 — Adaptive icon XML files")

ANYDPI_DIR = ANDROID_RES / "mipmap-anydpi-v26"
ANYDPI_DIR.mkdir(parents=True, exist_ok=True)

ADAPTIVE_XML = """\
<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
"""

for xml_name in ("ic_launcher.xml", "ic_launcher_round.xml"):
    xml_path = ANYDPI_DIR / xml_name
    xml_path.write_text(ADAPTIVE_XML, encoding="utf-8")
    written.append(f"  {xml_path.relative_to(PROJECT_ROOT)}  (XML)")

# ── 5. NOTIFICATION ICON (ic_notification.png) ───────────────────────────────

print("Step 5 — Notification icons (ic_notification.png)")

# Convert black background to transparent:
# For every pixel where R<30, G<30, B<30, set alpha=0.
# Use pixel-access object to avoid deprecated getdata().
pa = icon_src.load()
notification_src = Image.new("RGBA", icon_src.size)
na = notification_src.load()
w_ic, h_ic = icon_src.size
for y in range(h_ic):
    for x in range(w_ic):
        rv, gv, bv, av = pa[x, y]
        na[x, y] = (rv, gv, bv, 0) if (rv < 30 and gv < 30 and bv < 30) else (rv, gv, bv, av)

notification_sizes = {
    "drawable-mdpi":    24,
    "drawable-hdpi":    36,
    "drawable-xhdpi":   48,
    "drawable-xxhdpi":  72,
    "drawable-xxxhdpi": 96,
}

for folder, size in notification_sizes.items():
    img = notification_src.resize((size, size), Image.LANCZOS)
    save(img, ANDROID_RES / folder / "ic_notification.png")

# ── Summary ──────────────────────────────────────────────────────────────────

print()
print(f"Done — {len(written)} files written:")
for line in written:
    print(line)

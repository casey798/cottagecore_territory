"""
generate_icons.py
Generates all Android launcher and notification icons for GroveWars.
Run from any directory; paths are resolved relative to this script's location.
"""

import os
import sys
import glob as globmod
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("Pillow not found — installing...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow"])
    from PIL import Image

# ── Resolve paths ────────────────────────────────────────────────────────────

SCRIPT_DIR   = Path(__file__).resolve().parent          # mobile/scripts/
MOBILE_DIR   = SCRIPT_DIR.parent                        # mobile/
PROJECT_ROOT = MOBILE_DIR.parent                        # project root
ANDROID_RES  = MOBILE_DIR / "android" / "app" / "src" / "main" / "res"

LOGO_PATH = MOBILE_DIR / "docs" / "logo_grove.png"
ICON_PATH = MOBILE_DIR / "docs" / "icon_grove.png"

assert LOGO_PATH.exists(), f"logo_grove.png not found at {LOGO_PATH}"
assert ICON_PATH.exists(), f"icon_grove.png not found at {ICON_PATH}"

print(f"logo : {LOGO_PATH}")
print(f"icon : {ICON_PATH}")
print()

written: list[str] = []


def save(img: Image.Image, path: Path) -> None:
    """Create parent dirs, save image, record result."""
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(str(path), "PNG")
    w, h = img.size
    written.append(f"  {path.relative_to(PROJECT_ROOT)}  ({w}x{h})")


def write_text(path: Path, content: str) -> None:
    """Create parent dirs, write text file, record result."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    written.append(f"  {path.relative_to(PROJECT_ROOT)}  (XML)")


# ── STEP 1: Delete all existing icon files ───────────────────────────────────

print("Step 1 — Deleting existing icon files")

delete_patterns = [
    "mipmap-mdpi/ic_launcher*.png",
    "mipmap-hdpi/ic_launcher*.png",
    "mipmap-xhdpi/ic_launcher*.png",
    "mipmap-xxhdpi/ic_launcher*.png",
    "mipmap-xxxhdpi/ic_launcher*.png",
    "mipmap-anydpi-v26/ic_launcher*.xml",
    "drawable*/ic_notification*.png",
    "values/ic_launcher_background.xml",
]

deleted_count = 0
for pattern in delete_patterns:
    full_pattern = str(ANDROID_RES / pattern)
    for match in globmod.glob(full_pattern):
        p = Path(match)
        if p.is_file():
            p.unlink()
            print(f"  Deleted {p.relative_to(PROJECT_ROOT)}")
            deleted_count += 1

print(f"  ({deleted_count} files deleted)")
print()

# ── Load source images ───────────────────────────────────────────────────────

logo_src = Image.open(LOGO_PATH).convert("RGBA")
icon_src = Image.open(ICON_PATH).convert("RGBA")

# ── STEP 2: Legacy launcher icons ────────────────────────────────────────────

print("Step 2 — Legacy launcher icons (ic_launcher.png + ic_launcher_round.png)")

launcher_sizes = {
    "mipmap-mdpi":    48,
    "mipmap-hdpi":    72,
    "mipmap-xhdpi":   96,
    "mipmap-xxhdpi":  144,
    "mipmap-xxxhdpi": 192,
}

for folder, size in launcher_sizes.items():
    img = logo_src.resize((size, size), Image.LANCZOS)
    out_dir = ANDROID_RES / folder
    save(img, out_dir / "ic_launcher.png")
    save(img, out_dir / "ic_launcher_round.png")

# ── STEP 3: Adaptive foreground ──────────────────────────────────────────────

print("Step 3 — Adaptive foreground (ic_launcher_foreground.png)")

# canvas_size, logo_size, offset
adaptive_sizes = {
    "mipmap-mdpi":    (108, 72,  18),
    "mipmap-hdpi":    (162, 108, 27),
    "mipmap-xhdpi":   (216, 144, 36),
    "mipmap-xxhdpi":  (324, 216, 54),
    "mipmap-xxxhdpi": (432, 288, 72),
}

for folder, (canvas, logo_sz, offset) in adaptive_sizes.items():
    canvas_img = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    logo_scaled = logo_src.resize((logo_sz, logo_sz), Image.LANCZOS)
    canvas_img.paste(logo_scaled, (offset, offset), logo_scaled)
    save(canvas_img, ANDROID_RES / folder / "ic_launcher_foreground.png")

# ── STEP 4: Background color XML ─────────────────────────────────────────────

print("Step 4 — Background color XML")

bg_xml = '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#000000</color>\n</resources>\n'
write_text(ANDROID_RES / "values" / "ic_launcher_background.xml", bg_xml)

# ── STEP 5: Adaptive icon XML ────────────────────────────────────────────────

print("Step 5 — Adaptive icon XML (mipmap-anydpi-v26)")

adaptive_xml = '<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n    <background android:drawable="@color/ic_launcher_background"/>\n    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n</adaptive-icon>\n'

anydpi_dir = ANDROID_RES / "mipmap-anydpi-v26"
write_text(anydpi_dir / "ic_launcher.xml", adaptive_xml)
write_text(anydpi_dir / "ic_launcher_round.xml", adaptive_xml)

# ── STEP 6: Notification icons ───────────────────────────────────────────────

print("Step 6 — Notification icons (ic_notification.png)")

notification_sizes = {
    "drawable-mdpi":    24,
    "drawable-hdpi":    36,
    "drawable-xhdpi":   48,
    "drawable-xxhdpi":  72,
    "drawable-xxxhdpi": 96,
}

for folder, size in notification_sizes.items():
    img = icon_src.resize((size, size), Image.LANCZOS)
    save(img, ANDROID_RES / folder / "ic_notification.png")

# ── Summary ──────────────────────────────────────────────────────────────────

print()
print(f"Done — {len(written)} files written:")
for line in written:
    print(line)

print()
print("Next steps:")
print("  adb uninstall com.grovewars")
print("  cd mobile/android && .\\gradlew clean && cd ..")
print("  npx react-native run-android")

#!/usr/bin/env python3
"""Sinh icon launcher (mipmap PNG cho Android < 26) và ảnh splash từ icon gốc 512px.

Chạy trong GitHub Actions trước khi build (repo chỉ lưu file chữ; icon gốc để ở
dạng base64 tại tools/icon-512.png.b64). Cũng chạy được ở máy local:
    pip install pillow && python3 tools/gen_icons.py
"""
import base64
import io
import os

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES = os.path.join(ROOT, "android", "app", "src", "main", "res")


def load_icon() -> Image.Image:
    with open(os.path.join(ROOT, "tools", "icon-512.png.b64"), "rb") as f:
        data = base64.b64decode(f.read())
    return Image.open(io.BytesIO(data)).convert("RGBA")


def main() -> None:
    icon = load_icon()
    # --- Launcher icons theo mật độ ---
    sizes = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
    for dpi, px in sizes.items():
        folder = os.path.join(RES, f"mipmap-{dpi}")
        os.makedirs(folder, exist_ok=True)
        img = icon.resize((px, px), Image.LANCZOS)
        img.save(os.path.join(folder, "ic_launcher.png"))
        mask = Image.new("L", (px, px), 0)
        ImageDraw.Draw(mask).ellipse((0, 0, px, px), fill=255)
        rnd = Image.new("RGBA", (px, px), (0, 0, 0, 0))
        rnd.paste(img, (0, 0), mask)
        rnd.save(os.path.join(folder, "ic_launcher_round.png"))
    # --- Splash: logo giữa nền trắng, kích thước theo mẫu Capacitor ---
    splash_sizes = {
        "drawable": (480, 320),
        "drawable-land-mdpi": (480, 320),
        "drawable-land-hdpi": (800, 480),
        "drawable-land-xhdpi": (1280, 720),
        "drawable-land-xxhdpi": (1600, 960),
        "drawable-land-xxxhdpi": (1920, 1280),
        "drawable-port-mdpi": (320, 480),
        "drawable-port-hdpi": (480, 800),
        "drawable-port-xhdpi": (720, 1280),
        "drawable-port-xxhdpi": (960, 1600),
        "drawable-port-xxxhdpi": (1280, 1920),
    }
    for folder_name, (w, h) in splash_sizes.items():
        folder = os.path.join(RES, folder_name)
        os.makedirs(folder, exist_ok=True)
        canvas = Image.new("RGBA", (w, h), (255, 255, 255, 255))
        side = int(min(w, h) * 0.34)
        logo = icon.resize((side, side), Image.LANCZOS)
        canvas.paste(logo, ((w - side) // 2, (h - side) // 2), logo)
        canvas.convert("RGB").save(os.path.join(folder, "splash.png"))
    print("gen_icons: done")


if __name__ == "__main__":
    main()

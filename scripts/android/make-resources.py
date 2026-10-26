#!/usr/bin/env python3
"""从上游 public/icon-512.png 生成 Android 图标与启动图。

产物放在 android-port/resources/，由 scripts/android/patch-native.mjs 在
`npx cap add android` 之后拷进原生工程的 res/ 目录。

设计约束（Android 自适应图标规范）：
- 前景图 108dp 画布，实际可见安全区只有中间 66dp，所以图形缩到 60% 居中；
  超出安全区的部分会被各种形状的遮罩裁掉，绝不能把方图整张塞进去。
"""
from pathlib import Path
import os

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]          # android-port/
SRC = Path(os.environ.get("ATLAS_ICON", ROOT.parent / "public/icon-512.png"))  # 上游图标
OUT = ROOT / "resources"

BG = (17, 24, 46, 255)          # 与 index.html 的 theme-color #0D1120 同族，取自图标底色
SAFE = 0.60                     # 自适应图标安全区比例


def artwork() -> Image.Image:
    """裁出指南针本体（去掉深色底），保持正方形与透明背景。"""
    im = Image.open(SRC).convert("RGBA")
    w, h = im.size
    bg = im.getpixel((2, 2))
    px = im.load()

    # 找出与底色差异明显的像素包围盒 —— 就是那圈米色表盘
    minx, miny, maxx, maxy = w, h, 0, 0
    for y in range(h):
        for x in range(w):
            r, g, b, _ = px[x, y]
            if abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2]) > 60:
                minx, miny = min(minx, x), min(miny, y)
                maxx, maxy = max(maxx, x), max(maxy, y)
    side = max(maxx - minx, maxy - miny) + 1
    cx, cy = (minx + maxx) // 2, (miny + maxy) // 2
    box = (cx - side // 2, cy - side // 2, cx + side // 2, cy + side // 2)
    crop = im.crop(box)

    # 底色调回透明：把接近底色的像素设为全透明
    cp = crop.load()
    cw, ch = crop.size
    for y in range(ch):
        for x in range(cw):
            r, g, b, a = cp[x, y]
            if abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2]) < 24:
                cp[x, y] = (r, g, b, 0)
    return crop


def place(canvas_px: int, art: Image.Image, ratio: float) -> Image.Image:
    canvas = Image.new("RGBA", (canvas_px, canvas_px), (0, 0, 0, 0))
    side = int(canvas_px * ratio)
    scaled = art.resize((side, side), Image.LANCZOS)
    off = (canvas_px - side) // 2
    canvas.alpha_composite(scaled, (off, off))
    return canvas


def flat_icon(canvas_px: int, art: Image.Image, circle: bool) -> Image.Image:
    """传统图标：深色底 + 居中图形，可选圆形遮罩。"""
    base = Image.new("RGBA", (canvas_px, canvas_px), BG)
    inner = place(canvas_px, art, 0.72)
    base.alpha_composite(inner)
    if circle:
        mask = Image.new("L", (canvas_px, canvas_px), 0)
        ImageDraw.Draw(mask).ellipse((0, 0, canvas_px - 1, canvas_px - 1), fill=255)
        out = Image.new("RGBA", (canvas_px, canvas_px), (0, 0, 0, 0))
        out.paste(base, (0, 0), mask)
        return out
    return base


def splash(w: int, h: int, art: Image.Image) -> Image.Image:
    img = Image.new("RGBA", (w, h), BG)
    side = int(min(w, h) * 0.30)
    scaled = art.resize((side, side), Image.LANCZOS)
    img.alpha_composite(scaled, ((w - side) // 2, (h - side) // 2))
    return img


def main() -> None:
    if not SRC.exists():
        raise SystemExit(f"找不到图标源文件：{SRC}")
    art = artwork()

    densities = {"mdpi": 1.0, "hdpi": 1.5, "xhdpi": 2.0, "xxhdpi": 3.0, "xxxhdpi": 4.0}
    for name, factor in densities.items():
        d = OUT / "icon" / f"mipmap-{name}"
        d.mkdir(parents=True, exist_ok=True)
        launcher = int(48 * factor)
        fg = int(108 * factor)
        flat_icon(launcher, art, circle=False).save(d / "ic_launcher.png")
        flat_icon(launcher, art, circle=True).save(d / "ic_launcher_round.png")
        place(fg, art, SAFE).save(d / "ic_launcher_foreground.png")

    # 自适应图标描述文件
    anydpi = OUT / "icon" / "mipmap-anydpi-v26"
    anydpi.mkdir(parents=True, exist_ok=True)
    adaptive = (
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
        '    <background android:drawable="@color/ic_launcher_background" />\n'
        '    <foreground android:drawable="@mipmap/ic_launcher_foreground" />\n'
        '    <monochrome android:drawable="@mipmap/ic_launcher_foreground" />\n'
        "</adaptive-icon>\n"
    )
    for f in ("ic_launcher.xml", "ic_launcher_round.xml"):
        (anydpi / f).write_text(adaptive, encoding="utf-8")

    colors = OUT / "icon" / "values"
    colors.mkdir(parents=True, exist_ok=True)
    # 注意：文件名必须与 Capacitor 模板里的 values/ic_launcher_background.xml 同名，
    # 直接覆盖它。另起一个文件名会得到两个同名 <color>，aapt2 报 Duplicate resources。
    (colors / "ic_launcher_background.xml").write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
        '    <color name="ic_launcher_background">#11172E</color>\n'
        "</resources>\n",
        encoding="utf-8",
    )

    # 启动图：Android 12 以下才真正用到，12+ 由系统 SplashScreen API 接管
    base = {"mdpi": (320, 480), "hdpi": (480, 800), "xhdpi": (720, 1280), "xxhdpi": (960, 1600), "xxxhdpi": (1280, 1920)}
    for name, (w, h) in base.items():
        for orientation, size in (("port", (w, h)), ("land", (h, w))):
            d = OUT / "splash" / f"drawable-{orientation}-{name}"
            d.mkdir(parents=True, exist_ok=True)
            splash(*size, art).save(d / "splash.png")
        d = OUT / "splash" / f"drawable-{name}"
        d.mkdir(parents=True, exist_ok=True)
        splash(720, 1280, art).save(d / "splash.png")

    print(f"✓ 图标与启动图已生成：{OUT}")


if __name__ == "__main__":
    main()

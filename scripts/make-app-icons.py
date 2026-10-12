#!/usr/bin/env python3
"""
Generates every WorkNest app icon and splash logo from the brand logo (the silver ribbon "W").

    python3 scripts/make-app-icons.py                       # source: public/Logo.png (same file as the CMS logo)
    python3 scripts/make-app-icons.py --source path/to/Logo.png
    python3 scripts/make-app-icons.py --preview out.png     # also writes a contact sheet to check the result

Design: the silver W centred on the brand navy #0F172A (the CMS sidebar colour).

Writes (paths relative to the repo root):
  android/app/src/main/res/
    mipmap-<density>/ic_launcher_foreground.png   adaptive icon foreground, 108dp canvas, W inside the 66dp safe zone
    mipmap-<density>/ic_launcher_monochrome.png   white W silhouette, Android 13+ themed icons
    mipmap-<density>/ic_launcher.png              legacy icon (Android 7.x), W on a navy rounded square, 48dp
    mipmap-<density>/ic_launcher_round.png        legacy round icon, W on a navy circle, 48dp
    drawable-<density>/splash_icon.png            Android 12+ splash icon, 288dp canvas, W inside the 192dp circle
    ic_launcher-web.png                           512x512 Play Store icon (full-bleed square, Play rounds the corners)
  src/assets/brand/worknest-w.png (+ @2x, @3x)    the W tightly cropped, for <BrandLogo> in the app

The adaptive icon XML (mipmap-anydpi-v26) and the navy colour (values/ic_launcher_background.xml) are plain
resource files next to these and are not generated.

Quality: every bitmap is resampled once from the full-size source with LANCZOS in premultiplied alpha (no dark
fringes), and the navy shapes are drawn 8x larger and reduced, so edges are anti-aliased without blur.
Requires Pillow only.
"""

import argparse
import math
import os
import sys

from PIL import Image, ImageDraw

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
RES = os.path.join(ROOT, "android", "app", "src", "main", "res")
JS_ASSETS = os.path.join(ROOT, "src", "assets", "brand")

NAVY = (0x0F, 0x17, 0x2A, 255)  # palette.slate[900], theme `headerBg` (light), CMS sidebar

DENSITIES = {"mdpi": 1.0, "hdpi": 1.5, "xhdpi": 2.0, "xxhdpi": 3.0, "xxxhdpi": 4.0}

# Pixels with less alpha than this are ignored when measuring the W (soft edge noise in the source).
ALPHA_THRESHOLD = 24

# How far the farthest W pixel may be from the icon centre, per output (dp unless noted).
ADAPTIVE_CANVAS_DP = 108
ADAPTIVE_W_RADIUS_DP = 31.0  # safe zone is a 66dp circle (radius 33); 2dp of breathing room
LEGACY_SIZE_DP = 48
LEGACY_INSET_DP = 2.0  # transparent margin around the legacy square / circle
LEGACY_CORNER_RATIO = 0.22  # corner radius of the legacy rounded square, relative to its side
LEGACY_W_RADIUS_RATIO = 0.80  # W radius relative to half the legacy shape
SPLASH_CANVAS_DP = 288
SPLASH_W_RADIUS_DP = 64.0  # the splash clips the icon to a 192dp circle (radius 96); keep the W well inside
PLAY_SIZE_PX = 512
PLAY_W_RADIUS_RATIO = 0.62  # W radius relative to half the Play icon (Play masks the square with rounded corners)
JS_BASE_WIDTH_DP = 160  # @1x width of src/assets/brand/worknest-w.png (@2x, @3x are 2x and 3x)


def load_logo(path):
    img = Image.open(path).convert("RGBA")
    alpha = img.getchannel("A")
    px = alpha.load()
    w, h = img.size

    # Bounding box and alpha-weighted centroid of the visible W.
    x0, y0, x1, y1 = w, h, -1, -1
    total = sx = sy = 0.0
    for y in range(h):
        for x in range(w):
            a = px[x, y]
            if a >= ALPHA_THRESHOLD:
                if x < x0:
                    x0 = x
                if x > x1:
                    x1 = x
                if y < y0:
                    y0 = y
                if y > y1:
                    y1 = y
                total += a
                sx += a * (x + 0.5)
                sy += a * (y + 0.5)
    if x1 < 0:
        sys.exit("The logo has no visible pixels")
    bbox = (x0, y0, x1 + 1, y1 + 1)
    centroid = (sx / total, sy / total)
    box_centre = ((bbox[0] + bbox[2]) / 2.0, (bbox[1] + bbox[3]) / 2.0)

    # Optical centre: halfway between the geometric centre and the centre of mass. The W's right arm is a thin
    # diagonal, so the box centre alone makes the logo look pushed to the left; the mass centre alone overcorrects.
    anchor = ((box_centre[0] + centroid[0]) / 2.0, (box_centre[1] + centroid[1]) / 2.0)

    # Farthest visible pixel corner from the anchor: scaling this to a radius keeps the W inside a circle.
    radius = 0.0
    for y in range(bbox[1], bbox[3]):
        for x in range(bbox[0], bbox[2]):
            if px[x, y] >= ALPHA_THRESHOLD:
                dx = max(abs(x - anchor[0]), abs(x + 1 - anchor[0]))
                dy = max(abs(y - anchor[1]), abs(y + 1 - anchor[1]))
                d = math.hypot(dx, dy)
                if d > radius:
                    radius = d

    # Premultiplied copy with a transparent margin, so resize boxes may extend past the logo's edges.
    margin = max(w, h)
    padded = Image.new("RGBA", (w + 2 * margin, h + 2 * margin), (0, 0, 0, 0))
    padded.paste(img, (margin, margin))
    return {
        "image": padded.convert("RGBa"),
        "margin": margin,
        "bbox": bbox,
        "anchor": anchor,
        "radius": radius,
        "size": (w, h),
    }


def render_w(logo, canvas, w_radius, centre=None):
    """The W on a transparent `canvas` (w, h) px with its farthest pixel `w_radius` px from `centre`."""
    cw, ch = canvas
    cx, cy = centre if centre else (cw / 2.0, ch / 2.0)
    scale = w_radius / logo["radius"]
    m = logo["margin"]
    ax, ay = logo["anchor"][0] + m, logo["anchor"][1] + m
    box = (ax - cx / scale, ay - cy / scale, ax + (cw - cx) / scale, ay + (ch - cy) / scale)
    pw, ph = logo["image"].size
    if box[0] < 0 or box[1] < 0 or box[2] > pw or box[3] > ph:
        sys.exit("Internal error: resize box outside the padded logo")
    return logo["image"].resize((cw, ch), Image.LANCZOS, box=box).convert("RGBA")


def shape(size, kind, inset, corner_ratio=0.0, fill=NAVY, ss=8):
    """Anti-aliased navy square / rounded square / circle on a transparent `size` px canvas."""
    big = size * ss
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    i = inset * ss
    rect = (i, i, big - i - 1, big - i - 1)
    if kind == "circle":
        d.ellipse(rect, fill=fill)
    elif kind == "rounded":
        d.rounded_rectangle(rect, radius=(big - 2 * i) * corner_ratio, fill=fill)
    else:
        d.rectangle(rect, fill=fill)
    return img.convert("RGBa").resize((size, size), Image.LANCZOS).convert("RGBA")


def white_silhouette(img):
    out = Image.new("RGBA", img.size, (255, 255, 255, 0))
    out.putalpha(img.getchannel("A"))
    return out


def save(img, path, written):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, "PNG", optimize=True)
    written.append(path)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--source", default=os.path.join(ROOT, "public", "Logo.png"))
    parser.add_argument("--preview", help="write a contact sheet PNG of the results here")
    args = parser.parse_args()

    logo = load_logo(args.source)
    written = []

    for name, k in DENSITIES.items():
        # Adaptive icon foreground + monochrome (108dp canvas).
        size = round(ADAPTIVE_CANVAS_DP * k)
        fg = render_w(logo, (size, size), ADAPTIVE_W_RADIUS_DP * k)
        save(fg, os.path.join(RES, f"mipmap-{name}", "ic_launcher_foreground.png"), written)
        save(white_silhouette(fg), os.path.join(RES, f"mipmap-{name}", "ic_launcher_monochrome.png"), written)

        # Legacy square and round icons (48dp).
        size = round(LEGACY_SIZE_DP * k)
        inset = LEGACY_INSET_DP * k
        half = size / 2.0 - inset
        w_layer = render_w(logo, (size, size), half * LEGACY_W_RADIUS_RATIO)
        for kind, filename in (("rounded", "ic_launcher.png"), ("circle", "ic_launcher_round.png")):
            icon = shape(size, kind, inset, LEGACY_CORNER_RATIO)
            icon.alpha_composite(w_layer)
            save(icon, os.path.join(RES, f"mipmap-{name}", filename), written)

        # Android 12+ splash icon (288dp canvas, no icon background).
        size = round(SPLASH_CANVAS_DP * k)
        splash = render_w(logo, (size, size), SPLASH_W_RADIUS_DP * k)
        save(splash, os.path.join(RES, f"drawable-{name}", "splash_icon.png"), written)

    # Play Store icon: full-bleed navy square (no rounded corners or shadow; Play applies its own mask).
    play = shape(PLAY_SIZE_PX, "square", 0)
    play.alpha_composite(render_w(logo, (PLAY_SIZE_PX, PLAY_SIZE_PX), PLAY_SIZE_PX / 2.0 * PLAY_W_RADIUS_RATIO))
    save(play.convert("RGB"), os.path.join(RES, "ic_launcher-web.png"), written)

    # The W for the JS <BrandLogo>: tight crop of the logo, @1x / @2x / @3x.
    x0, y0, x1, y1 = logo["bbox"]
    m = logo["margin"]
    src_w, src_h = x1 - x0, y1 - y0
    for suffix, k in (("", 1), ("@2x", 2), ("@3x", 3)):
        width = JS_BASE_WIDTH_DP * k
        height = round(width * src_h / src_w)
        if width > src_w:
            sys.exit(f"JS asset {suffix or '@1x'} would upscale the logo ({width} > {src_w}px)")
        crop = logo["image"].resize((width, height), Image.LANCZOS, box=(x0 + m, y0 + m, x1 + m, y1 + m))
        save(crop.convert("RGBA"), os.path.join(JS_ASSETS, f"worknest-w{suffix}.png"), written)

    for path in written:
        print(os.path.relpath(path, ROOT))
    print(
        f"W: bbox {logo['bbox']} in {logo['size']}, optical centre "
        f"({logo['anchor'][0]:.1f}, {logo['anchor'][1]:.1f}), radius {logo['radius']:.1f}px; "
        f"JS aspect ratio {src_w}:{src_h} = {src_w / src_h:.4f}"
    )
    width_dp = lambda r: src_w * r / logo["radius"]  # noqa: E731
    print(
        f"W width: adaptive {width_dp(ADAPTIVE_W_RADIUS_DP):.1f}dp of {ADAPTIVE_CANVAS_DP}dp, "
        f"splash {width_dp(SPLASH_W_RADIUS_DP):.1f}dp of {SPLASH_CANVAS_DP}dp"
    )

    if args.preview:
        write_preview(args.preview)


def write_preview(path):
    """Contact sheet: adaptive icon under circle / squircle masks, themed icon, legacy, splash, Play icon."""
    k = 4
    tiles = []
    fg = Image.open(os.path.join(RES, "mipmap-xxxhdpi", "ic_launcher_foreground.png"))
    mono = Image.open(os.path.join(RES, "mipmap-xxxhdpi", "ic_launcher_monochrome.png"))
    full = Image.new("RGBA", fg.size, NAVY)
    full.alpha_composite(fg)
    visible = round(72 * k)
    off = (fg.size[0] - visible) // 2
    view = full.crop((off, off, off + visible, off + visible))
    for kind in ("circle", "rounded"):
        mask = shape(visible, kind, 0, 0.3, fill=(255, 255, 255, 255)).getchannel("A")
        t = Image.new("RGBA", view.size, (0, 0, 0, 0))
        t.paste(view, (0, 0), mask)
        tiles.append(t)
    # Themed icon (Android 13+): light tint on a dark tonal circle.
    themed = Image.new("RGBA", fg.size, (0x2B, 0x3A, 0x55, 255))
    tint = Image.new("RGBA", fg.size, (0xD6, 0xE3, 0xFF, 255))
    tint.putalpha(mono.getchannel("A"))
    themed.alpha_composite(tint)
    themed = themed.crop((off, off, off + visible, off + visible))
    t = Image.new("RGBA", themed.size, (0, 0, 0, 0))
    t.paste(themed, (0, 0), shape(visible, "circle", 0, fill=(255, 255, 255, 255)).getchannel("A"))
    tiles.append(t)
    tiles.append(Image.open(os.path.join(RES, "mipmap-xxxhdpi", "ic_launcher.png")).convert("RGBA"))
    tiles.append(Image.open(os.path.join(RES, "mipmap-xxxhdpi", "ic_launcher_round.png")).convert("RGBA"))
    splash = Image.new("RGBA", (288 * 2, 288 * 2), NAVY)
    s = Image.open(os.path.join(RES, "drawable-xhdpi", "splash_icon.png")).convert("RGBA")
    splash.alpha_composite(s)
    d = ImageDraw.Draw(splash)
    d.ellipse((96, 96, 480, 480), outline=(255, 80, 80, 255), width=2)  # 192dp splash clip circle
    tiles.append(splash)
    tiles.append(Image.open(os.path.join(RES, "ic_launcher-web.png")).convert("RGBA"))

    pad = 24
    height = max(t.size[1] for t in tiles) + 2 * pad
    width = sum(t.size[0] for t in tiles) + pad * (len(tiles) + 1)
    sheet = Image.new("RGBA", (width, height), (236, 239, 244, 255))
    x = pad
    for t in tiles:
        sheet.alpha_composite(t, (x, (height - t.size[1]) // 2))
        x += t.size[0] + pad
    sheet.convert("RGB").save(path)
    print(f"preview: {path}")


if __name__ == "__main__":
    main()

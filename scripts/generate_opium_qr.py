from __future__ import annotations

from pathlib import Path

import cv2
from PIL import Image, ImageDraw, ImageFilter
import qrcode


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "output"
TEMP_DIR = ROOT / "tmp"
LOGO_PATH = Path("/Users/zeyangwen/Downloads/Copy of Untitled-Artwork.png")
URL = "https://www.opiumbartoronto.com/dinner-menu"

BASE_QR = TEMP_DIR / "opium_qr_base.png"
FINAL_QR = OUTPUT_DIR / "opium-dinner-menu-art-qr.png"
ALT_QR = OUTPUT_DIR / "opium-dinner-menu-art-qr-clean.png"
BIG_LOGO_QR = OUTPUT_DIR / "opium-dinner-menu-art-qr-big-logo.png"
FLOWER_QR = OUTPUT_DIR / "opium-dinner-menu-art-qr-flower.png"
TRANSLUCENT_QR = OUTPUT_DIR / "opium-dinner-menu-art-qr-translucent.png"
GIANT_QR = OUTPUT_DIR / "opium-dinner-menu-art-qr-giant.png"
FULL_LOGO_QR = OUTPUT_DIR / "opium-dinner-menu-art-qr-full-logo.png"

SIZE = 1600
MARGIN = 150
BG = (255, 255, 255, 255)
PAPER = (248, 243, 236, 255)
DARK = (20, 18, 18, 255)
ACCENT = (255, 99, 109, 255)
ACCENT_2 = (233, 132, 72, 255)


def generate_base_qr() -> None:
    TEMP_DIR.mkdir(exist_ok=True)
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=30,
        border=4,
    )
    qr.add_data(URL)
    qr.make(fit=True)
    image = qr.make_image(fill_color="black", back_color="white").convert("RGBA")
    image.save(BASE_QR)


def load_matrix(image: Image.Image) -> tuple[list[list[bool]], int]:
    gray = image.convert("L")
    px = gray.load()
    width, height = gray.size

    run = 0
    first = px[0, height // 2] < 128
    for x in range(width):
        if (px[x, height // 2] < 128) == first:
            run += 1
        else:
            break
    quiet = run

    module = None
    count = 0
    for x in range(quiet, width):
        value = px[x, height // 2] < 128
        if value:
            count += 1
        elif count:
            module = count
            break
    if not module:
        raise RuntimeError("Could not determine module size")

    n = (width - 2 * quiet) // module
    matrix: list[list[bool]] = []
    for row in range(n):
        items: list[bool] = []
        for col in range(n):
            cx = quiet + col * module + module // 2
            cy = quiet + row * module + module // 2
            items.append(px[cx, cy] < 128)
        matrix.append(items)
    return matrix, n


def in_finder(row: int, col: int, n: int) -> bool:
    blocks = [(0, 0), (0, n - 7), (n - 7, 0)]
    for r0, c0 in blocks:
        if r0 <= row < r0 + 7 and c0 <= col < c0 + 7:
            return True
        if r0 - 1 <= row < r0 + 8 and c0 - 1 <= col < c0 + 8:
            return True
    return False


def add_background(draw: ImageDraw.ImageDraw, size: int) -> None:
    draw.rectangle((0, 0, size, size), fill=PAPER)
    inset = MARGIN - 35
    draw.rounded_rectangle((inset, inset, size - inset, size - inset), radius=36, fill=BG)
    blur = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    bdraw = ImageDraw.Draw(blur)
    for i, color in enumerate((ACCENT_2, ACCENT)):
        ring = 72 + i * 88
        bdraw.ellipse((ring, ring, size - ring, size - ring), outline=color[:3] + (42,), width=24)
    blur = blur.filter(ImageFilter.GaussianBlur(8))
    draw.bitmap((0, 0), blur, fill=None)


def draw_finder(draw: ImageDraw.ImageDraw, x: float, y: float, cell: float, outer: tuple[int, ...]) -> None:
    draw.rectangle((x, y, x + 7 * cell, y + 7 * cell), fill=DARK)
    draw.rectangle((x + cell, y + cell, x + 6 * cell, y + 6 * cell), fill=BG)
    draw.rectangle((x + 2 * cell, y + 2 * cell, x + 5 * cell, y + 5 * cell), fill=DARK)
    draw.ellipse((x - cell * 1.1, y - cell * 1.1, x - cell * 0.2, y - cell * 0.2), fill=BG, outline=outer, width=max(4, int(cell * 0.35)))
    draw.ellipse((x + 7.2 * cell, y - cell * 1.1, x + 8.1 * cell, y - cell * 0.2), fill=BG, outline=outer, width=max(4, int(cell * 0.35)))
    draw.ellipse((x - cell * 1.1, y + 7.2 * cell, x - cell * 0.2, y + 8.1 * cell), fill=BG, outline=outer, width=max(4, int(cell * 0.35)))


def fit_logo(max_size: int, mode: str = "full", logo_alpha: int = 255, plate_alpha: int = 255) -> Image.Image:
    logo = Image.open(LOGO_PATH).convert("RGBA")
    if mode == "flower":
        logo = logo.crop((150, 220, 695, 575))
        px = logo.load()
        for y in range(logo.height):
            for x in range(logo.width):
                r, g, b, a = px[x, y]
                if r < 45 and g < 45 and b < 45:
                    px[x, y] = (0, 0, 0, 0)
    elif mode == "no-black":
        px = logo.load()
        for y in range(logo.height):
            for x in range(logo.width):
                r, g, b, a = px[x, y]
                if a == 0:
                    continue
                if r < 45 and g < 45 and b < 45:
                    px[x, y] = (0, 0, 0, 0)
    scale = min(max_size / logo.width, max_size / logo.height)
    logo = logo.resize((int(logo.width * scale), int(logo.height * scale)), Image.LANCZOS)
    if logo_alpha < 255:
        alpha = logo.getchannel("A").point(lambda v: int(v * logo_alpha / 255))
        logo.putalpha(alpha)

    pad = int(max(40, max_size * 0.12))
    plate = Image.new("RGBA", (logo.width + pad * 2, logo.height + pad * 2), BG[:3] + (0,))
    mask = Image.new("L", plate.size, 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle((0, 0, plate.width - 1, plate.height - 1), radius=pad // 2, fill=255)
    shadow = Image.new("RGBA", plate.size, (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(shadow)
    sdraw.rounded_rectangle((10, 14, plate.width - 10, plate.height - 6), radius=pad // 2, fill=(0, 0, 0, 30))
    shadow = shadow.filter(ImageFilter.GaussianBlur(10))
    combined = Image.new("RGBA", plate.size, (0, 0, 0, 0))
    combined.alpha_composite(shadow)
    plate_fill = Image.new("RGBA", plate.size, BG[:3] + (plate_alpha,))
    combined.paste(plate_fill, mask=mask)
    combined.alpha_composite(logo, ((plate.width - logo.width) // 2, (plate.height - logo.height) // 2))
    return combined


def tint_logo(image: Image.Image, color: tuple[int, int, int]) -> Image.Image:
    tinted = image.copy()
    px = tinted.load()
    for y in range(tinted.height):
        for x in range(tinted.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if r > 150 and g < 170 and b < 170:
                px[x, y] = (color[0], color[1], color[2], a)
    return tinted


def draw_qr(
    matrix: list[list[bool]],
    n: int,
    path: Path,
    logo_mode: str,
    logo_ratio: float,
    clear_logo_area: bool = True,
    logo_alpha: int = 255,
    plate_alpha: int = 255,
    tint_color: tuple[int, int, int] | None = None,
) -> None:
    cell = (SIZE - 2 * MARGIN) // n
    qr_size = cell * n
    start_x = (SIZE - qr_size) // 2
    start_y = (SIZE - qr_size) // 2
    image = Image.new("RGBA", (SIZE, SIZE), BG)
    draw = ImageDraw.Draw(image)
    add_background(draw, SIZE)

    logo_size = int(SIZE * logo_ratio)
    logo = fit_logo(logo_size, mode=logo_mode, logo_alpha=logo_alpha, plate_alpha=plate_alpha)
    if tint_color is not None:
        logo = tint_logo(logo, tint_color)
    logo_box = (
        (SIZE - logo.width) // 2,
        (SIZE - logo.height) // 2,
        (SIZE + logo.width) // 2,
        (SIZE + logo.height) // 2,
    )

    for row in range(n):
        for col in range(n):
            if not matrix[row][col]:
                continue
            if in_finder(row, col, n):
                continue
            x = start_x + col * cell
            y = start_y + row * cell
            inset = max(4, int(cell * 0.22))
            box = (x + inset, y + inset, x + cell - inset, y + cell - inset)
            center_x = (box[0] + box[2]) / 2
            center_y = (box[1] + box[3]) / 2

            if clear_logo_area and logo_box[0] - cell * 1.0 < center_x < logo_box[2] + cell * 1.0 and logo_box[1] - cell * 1.0 < center_y < logo_box[3] + cell * 1.0:
                continue

            radius = int(cell * 0.26)
            draw.rounded_rectangle(box, radius=radius, fill=DARK)

    draw_finder(draw, start_x, start_y, cell, DARK)
    draw_finder(draw, start_x + (n - 7) * cell, start_y, cell, ACCENT)
    draw_finder(draw, start_x, start_y + (n - 7) * cell, cell, ACCENT_2)

    for ox, oy, color in (
        (70, 70, ACCENT),
        (SIZE - 120, 82, DARK),
        (84, SIZE - 128, ACCENT_2),
    ):
        draw.ellipse((ox, oy, ox + 46, oy + 46), fill=BG, outline=color, width=10)
        draw.ellipse((ox + 14, oy + 14, ox + 32, oy + 32), fill=color)

    image.alpha_composite(logo, (logo_box[0], logo_box[1]))
    path.parent.mkdir(exist_ok=True)
    image.save(path)


def draw_full_logo_qr(matrix: list[list[bool]], n: int, path: Path, logo_ratio: float, logo_alpha: int) -> None:
    cell = (SIZE - 2 * MARGIN) // n
    qr_size = cell * n
    start_x = (SIZE - qr_size) // 2
    start_y = (SIZE - qr_size) // 2
    image = Image.new("RGBA", (SIZE, SIZE), BG)
    draw = ImageDraw.Draw(image)
    add_background(draw, SIZE)

    logo = fit_logo(int(SIZE * logo_ratio), mode="full", logo_alpha=logo_alpha, plate_alpha=0)
    image.alpha_composite(logo, ((SIZE - logo.width) // 2, (SIZE - logo.height) // 2))

    draw = ImageDraw.Draw(image)
    for row in range(n):
        for col in range(n):
            if not matrix[row][col] or in_finder(row, col, n):
                continue
            x = start_x + col * cell
            y = start_y + row * cell
            inset = max(4, int(cell * 0.22))
            box = (x + inset, y + inset, x + cell - inset, y + cell - inset)
            draw.rounded_rectangle(box, radius=int(cell * 0.26), fill=DARK)

    draw_finder(draw, start_x, start_y, cell, DARK)
    draw_finder(draw, start_x + (n - 7) * cell, start_y, cell, ACCENT)
    draw_finder(draw, start_x, start_y + (n - 7) * cell, cell, ACCENT_2)
    path.parent.mkdir(exist_ok=True)
    image.save(path)


def validate(path: Path) -> str:
    detector = cv2.QRCodeDetector()
    image = cv2.imread(str(path))
    if image is None:
        return ""
    text, points, _ = detector.detectAndDecode(image)
    return text if points is not None else ""


def main() -> None:
    print("Generating base QR...", flush=True)
    generate_base_qr()
    print("Reading module matrix...", flush=True)
    matrix, n = load_matrix(Image.open(BASE_QR))
    print(f"Matrix size: {n}x{n}", flush=True)
    print("Drawing art versions...", flush=True)
    draw_qr(matrix, n, FINAL_QR, logo_mode="full", logo_ratio=0.20)
    draw_qr(matrix, n, ALT_QR, logo_mode="full", logo_ratio=0.18)
    draw_qr(matrix, n, BIG_LOGO_QR, logo_mode="full", logo_ratio=0.24)
    draw_qr(matrix, n, FLOWER_QR, logo_mode="flower", logo_ratio=0.28)
    draw_qr(matrix, n, TRANSLUCENT_QR, logo_mode="full", logo_ratio=0.28, clear_logo_area=False, logo_alpha=220, plate_alpha=170)
    draw_full_logo_qr(matrix, n, FULL_LOGO_QR, logo_ratio=0.95, logo_alpha=50)
    draw_qr(
        matrix,
        n,
        GIANT_QR,
        logo_mode="no-black",
        logo_ratio=0.95,
        clear_logo_area=False,
        logo_alpha=35,
        plate_alpha=0,
        tint_color=(240, 48, 64),
    )

    for path in (FINAL_QR, ALT_QR, BIG_LOGO_QR, FLOWER_QR, TRANSLUCENT_QR, FULL_LOGO_QR, GIANT_QR):
        print(f"Validating {path.name}...", flush=True)
        decoded = validate(path)
        if decoded != URL:
            raise RuntimeError(f"Validation failed for {path.name}: {decoded!r}")
        print(path)


if __name__ == "__main__":
    main()

from __future__ import annotations

from pathlib import Path

import cv2
from PIL import Image, ImageDraw
import qrcode


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "output"

URL = "https://www.opiumbartoronto.com/_files/ugd/874fcb_7026042e7fd548049df49c7aeb27eba7.pdf"
PNG_PATH = OUTPUT_DIR / "opium-pdf-qr-small-dots.png"
TRANSPARENT_PNG_PATH = OUTPUT_DIR / "opium-pdf-qr-small-dots-transparent.png"

CELL_SIZE = 30
DOT_INSET = 10
BACKGROUND = (255, 255, 255, 255)
TRANSPARENT = (255, 255, 255, 0)
FOREGROUND = (0, 0, 0, 255)


def build_matrix() -> list[list[bool]]:
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=4,
    )
    qr.add_data(URL)
    qr.make(fit=True)
    return qr.get_matrix()


def in_finder(row: int, col: int, n: int) -> bool:
    for r0, c0 in ((4, 4), (4, n - 11), (n - 11, 4)):
        if r0 <= row < r0 + 7 and c0 <= col < c0 + 7:
            return True
    return False


def draw_finder(draw: ImageDraw.ImageDraw, x: int, y: int, cell: int, background: tuple[int, int, int, int]) -> None:
    draw.rectangle((x, y, x + 7 * cell - 1, y + 7 * cell - 1), fill=FOREGROUND)
    draw.rectangle((x + cell, y + cell, x + 6 * cell - 1, y + 6 * cell - 1), fill=background)
    draw.rectangle((x + 2 * cell, y + 2 * cell, x + 5 * cell - 1, y + 5 * cell - 1), fill=FOREGROUND)


def draw_qr(background: tuple[int, int, int, int], path: Path) -> None:
    matrix = build_matrix()
    n = len(matrix)
    size = n * CELL_SIZE

    image = Image.new("RGBA", (size, size), background)
    draw = ImageDraw.Draw(image)

    for row in range(n):
        for col in range(n):
            if not matrix[row][col]:
                continue
            if in_finder(row, col, n):
                continue

            x = col * CELL_SIZE
            y = row * CELL_SIZE

            # Keep the data modules noticeably smaller for a lighter look.
            inset = DOT_INSET
            draw.ellipse(
                (x + inset, y + inset, x + CELL_SIZE - inset - 1, y + CELL_SIZE - inset - 1),
                fill=FOREGROUND,
            )

    draw_finder(draw, 4 * CELL_SIZE, 4 * CELL_SIZE, CELL_SIZE, background)
    draw_finder(draw, (n - 11) * CELL_SIZE, 4 * CELL_SIZE, CELL_SIZE, background)
    draw_finder(draw, 4 * CELL_SIZE, (n - 11) * CELL_SIZE, CELL_SIZE, background)

    path.parent.mkdir(exist_ok=True)
    image.save(path)


def validate(path: Path) -> str:
    image = cv2.imread(str(path), cv2.IMREAD_UNCHANGED)
    if image is None:
        return ""

    if image.shape[-1] == 4:
        alpha = image[:, :, 3] / 255.0
        white = 255 * (1 - alpha)
        bgr = image[:, :, :3].astype("float32")
        composite = (bgr * alpha[:, :, None] + white[:, :, None]).astype("uint8")
    else:
        composite = image

    text, points, _ = cv2.QRCodeDetector().detectAndDecode(composite)
    return text if points is not None else ""


def main() -> None:
    draw_qr(BACKGROUND, PNG_PATH)
    draw_qr(TRANSPARENT, TRANSPARENT_PNG_PATH)

    for path in (PNG_PATH, TRANSPARENT_PNG_PATH):
        decoded = validate(path)
        if decoded != URL:
            raise RuntimeError(f"Validation failed for {path.name}: {decoded!r}")
        print(path)


if __name__ == "__main__":
    main()

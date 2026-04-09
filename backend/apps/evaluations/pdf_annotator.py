"""
pdf_annotator.py
~~~~~~~~~~~~~~~~
Opens an original answer-sheet PDF and overlays every teacher-placed
mark label (stored as percentage coordinates) as a red bold number,
then saves the result as a NEW file (leaving the original untouched).

Dependencies: pypdf, reportlab  (both already installed)
"""
import io
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from reportlab.lib.colors import red, white, HexColor
from reportlab.pdfgen import canvas as rl_canvas


def _build_overlay_page(marks_on_page: list, page_width: float, page_height: float) -> bytes:
    """
    Create a single-page PDF overlay (in memory) that contains all the
    red mark labels for one page of the answer sheet.

    mark entry format:
        { "value": 4, "x": 45.2, "y": 32.1, "page": 1 }

    PDF coordinate system: origin = bottom-left; y increases upward.
    Browser coordinate system: origin = top-left; y increases downward.
    → We INVERT y: pdf_y = page_height − (y_pct / 100) * page_height
    """
    buf = io.BytesIO()
    c = rl_canvas.Canvas(buf, pagesize=(page_width, page_height))

    font_name = "Helvetica-Bold"
    font_size = 14

    for mark in marks_on_page:
        value = mark.get("value")
        if value is None or str(value).strip() == "":
            continue

        try:
            float_val = float(value)
        except (TypeError, ValueError):
            continue

        x_pct = float(mark.get("x", 50))
        y_pct = float(mark.get("y", 50))

        # Convert percentage to PDF points
        x_pt = (x_pct / 100.0) * page_width
        # Invert y: PDF y-axis is bottom-up; browser is top-down
        y_pt = page_height - (y_pct / 100.0) * page_height

        # Format label: int if whole number, else float
        label = str(int(float_val)) if float_val == int(float_val) else str(float_val)

        c.setFont(font_name, font_size)
        text_width = c.stringWidth(label, font_name, font_size)
        pad_x = 5
        pad_y = 3
        box_w = text_width + pad_x * 2
        box_h = font_size + pad_y * 2
        box_x = x_pt - pad_x
        box_y = y_pt - pad_y  # reportlab draws rect upward from this y

        # 1. White filled background (solid — avoid alpha compat issues)
        c.setFillColor(white)
        c.setStrokeColor(red)
        c.setLineWidth(1.2)
        c.roundRect(box_x, box_y, box_w, box_h, radius=3, stroke=1, fill=1)

        # 2. Red bold text
        c.setFillColor(red)
        c.drawString(x_pt, y_pt, label)

    c.save()
    buf.seek(0)
    return buf.read()


def annotate_pdf(
    original_pdf_path: Path,
    output_pdf_path: Path,
    mark_positions: dict,
) -> None:
    """
    Read `original_pdf_path`, overlay mark labels from `mark_positions`,
    write annotated result to `output_pdf_path`.

    mark_positions schema (from frontend):
        {
          "section_A_q1": { "value": 4,  "x": 45.2, "y": 32.1, "page": 1 },
          "section_A_q2": { "value": 12, "x": 50.0, "y": 45.5, "page": 2 },
          ...
        }

    If "page" is missing, defaults to page 1.
    Raises on error — callers must catch and handle gracefully.
    """
    if not original_pdf_path.exists():
        raise FileNotFoundError(f"Original PDF not found: {original_pdf_path}")

    reader = PdfReader(str(original_pdf_path))
    writer = PdfWriter()

    # Group marks by 1-indexed page number, skip blank values
    marks_by_page: dict[int, list] = {}
    for key, pos in mark_positions.items():
        v = pos.get("value")
        if v is None or str(v).strip() == "":
            continue
        page_num = int(pos.get("page", 1))
        marks_by_page.setdefault(page_num, []).append(pos)

    for page_index in range(len(reader.pages)):
        page = reader.pages[page_index]
        page_num = page_index + 1  # convert to 1-indexed

        # Real page dimensions from the PDF mediabox
        media_box  = page.mediabox
        page_width  = float(media_box.width)
        page_height = float(media_box.height)

        marks_for_this_page = marks_by_page.get(page_num, [])

        if marks_for_this_page:
            overlay_bytes  = _build_overlay_page(marks_for_this_page, page_width, page_height)
            overlay_reader = PdfReader(io.BytesIO(overlay_bytes))
            overlay_page   = overlay_reader.pages[0]
            page.merge_page(overlay_page)

        writer.add_page(page)

    # Ensure output directory exists
    output_pdf_path.parent.mkdir(parents=True, exist_ok=True)

    with open(str(output_pdf_path), "wb") as f:
        writer.write(f)

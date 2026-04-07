import img2pdf
from pathlib import Path


def compile_images_to_pdf(image_paths: list[Path], output_pdf_path: Path) -> None:
    """
    Compiles an ordered list of images into a single PDF file.
    Creates parent directories as needed.
    Raises an exception on failure — caller should handle this as HTTP 500.
    """
    output_pdf_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_pdf_path, "wb") as f:
        f.write(img2pdf.convert([str(p) for p in image_paths]))

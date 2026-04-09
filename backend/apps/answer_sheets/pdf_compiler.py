from pathlib import Path
from PIL import Image

def compile_images_to_pdf(image_paths: list[Path], output_pdf_path: Path) -> None:
    """
    Compiles an ordered list of images into a single PDF file using Pillow.
    Creates parent directories as needed.
    Raises an exception on failure — caller should handle this as HTTP 500.
    """
    if not image_paths:
        raise ValueError("No images provided to compile.")

    output_pdf_path.parent.mkdir(parents=True, exist_ok=True)
    
    images = []
    for p in image_paths:
        img = Image.open(p)
        # Force convert to RGB to prevent AlphaChannel or Palette errors in PDF creation
        if img.mode != "RGB":
            img = img.convert("RGB")
        images.append(img)
    
    # Save the first image as PDF, and append the rest
    images[0].save(
        output_pdf_path,
        "PDF",
        resolution=100.0,
        save_all=True,
        append_images=images[1:]
    )

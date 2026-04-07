"""
Barcode detection using OpenCV's built-in QR and barcode detectors.
Falls back to pyzbar if available (requires libzbar DLL on Windows).
No external C libraries required for the primary detection path.
"""
import cv2
from PIL import Image
import numpy as np


def detect_barcode(image_file) -> str | None:
    """
    Attempts to detect and decode a barcode/QR code from the provided image file.
    Returns the decoded roll number string, or None if no barcode found.

    Uses OpenCV's built-in detectors (no external DLL needed on Windows).
    Falls back to pyzbar if available.
    """
    try:
        img = Image.open(image_file).convert('RGB')
        img_np = np.array(img)
        img_cv = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR)
        img_gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)

        # ── Method 1: OpenCV QR Code Detector ──────────────────────────
        qr_detector = cv2.QRCodeDetector()
        data, _, _ = qr_detector.detectAndDecode(img_gray)
        if data and data.strip():
            return data.strip()

        # ── Method 2: OpenCV Barcode Detector (1D barcodes) ───────────
        # Available in OpenCV 4.5.3+
        try:
            barcode_detector = cv2.barcode.BarcodeDetector()
            ok, decoded_info, decoded_type, _ = barcode_detector.detectAndDecodeWithPoints(img_gray)
            if ok and decoded_info:
                for info in decoded_info:
                    if info and info.strip():
                        return info.strip()
        except AttributeError:
            # cv2.barcode not available in this OpenCV build — skip
            pass

        # ── Method 3: Preprocessing + retry QR detection ──────────────
        # Try with adaptive threshold to improve detection on poor scans
        blurred = cv2.GaussianBlur(img_gray, (5, 5), 0)
        _, thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        data, _, _ = qr_detector.detectAndDecode(thresh)
        if data and data.strip():
            return data.strip()

        # ── Method 4: pyzbar fallback (if DLL is installed) ──────────
        try:
            from pyzbar.pyzbar import decode as pyzbar_decode
            image_file.seek(0)
            img_pil = Image.open(image_file).convert('RGB')
            decoded = pyzbar_decode(img_pil)
            for obj in decoded:
                text = obj.data.decode('utf-8').strip()
                if text:
                    return text
        except (ImportError, Exception):
            # pyzbar not available or failed — that's fine
            pass

        return None

    except Exception:
        return None

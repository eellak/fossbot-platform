"""Decode and normalize CMS images before storing public website assets."""
from io import BytesIO
import warnings
from threading import BoundedSemaphore

from fastapi import HTTPException
from PIL import Image, ImageOps, UnidentifiedImageError

MAX_IMAGE_BYTES = 5 * 1024 * 1024
MAX_IMAGE_PIXELS = 20_000_000
MAX_IMAGE_SIDE = 8192
_IMAGE_SLOTS = BoundedSemaphore(2)
FORMATS = {'PNG': 'image/png', 'JPEG': 'image/jpeg', 'WEBP': 'image/webp'}


def normalize_website_image(raw):
    if not _IMAGE_SLOTS.acquire(blocking=False):
        raise HTTPException(429, 'Other images are being processed. Please retry shortly')
    try:
        return _normalize_website_image(raw)
    finally:
        _IMAGE_SLOTS.release()


def _normalize_website_image(raw):
    if not raw or len(raw) > MAX_IMAGE_BYTES:
        raise HTTPException(422, 'Upload PNG, JPEG or WebP, up to 5 MB')
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            with Image.open(BytesIO(raw), formats=list(FORMATS)) as image:
                kind = image.format
                width, height = image.size
                if width > MAX_IMAGE_SIDE or height > MAX_IMAGE_SIDE or width * height > MAX_IMAGE_PIXELS:
                    raise HTTPException(422, 'Image must be at most 8192 pixels per side and 20 megapixels')
                if getattr(image, 'n_frames', 1) != 1:
                    raise HTTPException(422, 'Upload a still image, not an animated image')
                image.verify()
            with Image.open(BytesIO(raw), formats=list(FORMATS)) as image:
                image.load()
                oriented = ImageOps.exif_transpose(image)
                mode = 'RGBA' if kind != 'JPEG' and ('A' in oriented.getbands() or 'transparency' in oriented.info) else 'RGB'
                converted = oriented.convert(mode)
                # Fresh pixels exclude EXIF, scripts appended to a valid file and other metadata.
                clean = Image.frombytes(mode, converted.size, converted.tobytes())
                target = BytesIO()
                clean.save(target, format=kind, **({'quality': 90} if kind in ('JPEG', 'WEBP') else {}))
                normalized = target.getvalue()
    except (UnidentifiedImageError, OSError, ValueError, SyntaxError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise HTTPException(422, 'Invalid or damaged image. Upload PNG, JPEG or WebP')
    if len(normalized) > MAX_IMAGE_BYTES:
        raise HTTPException(422, 'Normalized image exceeds 5 MB. Resize it before uploading')
    return normalized, FORMATS[kind]

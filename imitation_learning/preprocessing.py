"""Shared image preprocessing for training and inference."""

from __future__ import annotations

from io import BytesIO
from pathlib import Path

import numpy as np
from PIL import Image

IMAGE_WIDTH = 200
IMAGE_HEIGHT = 66
COLOR_CHANNELS = {"rgb": 3, "yuv": 3, "cmyk": 4}


def open_image(source: str | Path | bytes) -> Image.Image:
    if isinstance(source, bytes):
        return Image.open(BytesIO(source)).convert("RGB")
    return Image.open(source).convert("RGB")


def preprocess_image(
    image: Image.Image,
    color_space: str = "yuv",
    crop_top: float = 0.35,
    crop_bottom: float = 0.05,
) -> np.ndarray:
    color_space = color_space.lower()
    if color_space not in COLOR_CHANNELS:
        raise ValueError(f"Unsupported color space: {color_space}")
    if not 0 <= crop_top < 1 or not 0 <= crop_bottom < 1:
        raise ValueError("Crop values must be ratios between 0 and 1")
    if crop_top + crop_bottom >= 0.9:
        raise ValueError("The crop removes too much of the image")

    width, height = image.size
    top = round(height * crop_top)
    bottom = round(height * (1 - crop_bottom))
    image = image.crop((0, top, width, bottom))
    image = image.resize((IMAGE_WIDTH, IMAGE_HEIGHT), Image.Resampling.BILINEAR)

    if color_space == "yuv":
        # PIL's YCbCr representation is the digital-image equivalent used here
        # for the YUV-plane preprocessing described by PilotNet.
        image = image.convert("YCbCr")
    elif color_space == "cmyk":
        image = image.convert("CMYK")
    else:
        image = image.convert("RGB")

    array = np.asarray(image, dtype=np.float32)
    array = array / 127.5 - 1.0
    return np.transpose(array, (2, 0, 1)).copy()

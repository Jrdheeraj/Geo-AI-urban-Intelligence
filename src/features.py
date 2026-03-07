import rasterio
import numpy as np
import os

def read_band(path):
    with rasterio.open(path) as src:
        band = src.read(1).astype("float32")
        meta = src.meta
    return band, meta


def compute_ndvi(nir, red):
    ndvi = (nir - red) / (nir + red + 1e-6)
    return ndvi


def compute_ndbi(swir, nir):
    ndbi = (swir - nir) / (swir + nir + 1e-6)
    return ndbi


def compute_ndwi(green, nir):
    ndwi = (green - nir) / (green + nir + 1e-6)
    return ndwi


def save_index(index, meta, out_path):
    meta.update(dtype="float32", count=1)

    with rasterio.open(out_path, "w", **meta) as dst:
        dst.write(index, 1)

    print(f"✅ Saved index: {out_path}")

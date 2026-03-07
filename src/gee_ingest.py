import rasterio

def load_geotiff(path):
    """
    Load a single-band GeoTIFF and return data, transform, CRS
    """
    with rasterio.open(path) as src:
        data = src.read(1)
        transform = src.transform
        crs = src.crs
    return data, transform, crs

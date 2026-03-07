import rasterio
from rasterio.mask import mask
import geopandas as gpd
import os

def clip_raster_to_boundary(raster_path, shapefile_path, output_path):
    boundary = gpd.read_file(shapefile_path)

    with rasterio.open(raster_path) as src:
        boundary = boundary.to_crs(src.crs)
        geoms = boundary.geometry.values

        clipped_image, clipped_transform = mask(src, geoms, crop=True)

        meta = src.meta.copy()
        meta.update({
            "height": clipped_image.shape[1],
            "width": clipped_image.shape[2],
            "transform": clipped_transform
        })

    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    with rasterio.open(output_path, "w", **meta) as dst:
        dst.write(clipped_image)

    print(f"✅ Clipped and saved: {output_path}")
if __name__ == "__main__":
    clip_raster_to_boundary(
        raster_path="data/raw/B8.tif",
        shapefile_path="data/boundary/Tirupati.shp",
        output_path="data/processed/B8_clipped.tif"
    )

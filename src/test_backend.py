from src.gee_ingest import load_geotiff
from src.analytics_gee import area_stats, change_stats

# Load GeoTIFFs
lulc_2018, _, _ = load_geotiff(
    "data/gee_outputs/lulc/Tirupati_LULC_2018.tif"
)

lulc_2025, _, _ = load_geotiff(
    "data/gee_outputs/lulc/Tirupati_LULC_2025.tif"
)

# Area stats
print("LULC 2018 Area (hectares):")
print(area_stats(lulc_2018))

print("\nLULC 2025 Area (hectares):")
print(area_stats(lulc_2025))

# Change stats
print("\nLULC Change 2018 → 2025 (hectares):")
print(change_stats(lulc_2018, lulc_2025))

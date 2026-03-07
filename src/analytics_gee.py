import numpy as np

LULC_CLASSES = {
    1: "Forest",
    2: "Water",
    3: "Agriculture",
    4: "Barren",
    5: "Built-up"
}

def area_stats(lulc_array, pixel_size=10):
    """
    Calculate area (hectares) for each LULC class
    """
    pixel_area_ha = (pixel_size * pixel_size) / 10000
    stats = {}

    for cls, name in LULC_CLASSES.items():
        area = np.sum(lulc_array == cls) * pixel_area_ha
        stats[name] = round(float(area), 2)

    return stats


def change_stats(lulc_old, lulc_new, pixel_size=10):
    """
    Calculate LULC transition matrix (area in hectares)
    """
    pixel_area_ha = (pixel_size * pixel_size) / 10000
    transitions = {}

    for i, from_name in LULC_CLASSES.items():
        for j, to_name in LULC_CLASSES.items():
            mask = (lulc_old == i) & (lulc_new == j)
            area = np.sum(mask) * pixel_area_ha
            key = f"{from_name} → {to_name}"
            transitions[key] = round(float(area), 2)

    return transitions

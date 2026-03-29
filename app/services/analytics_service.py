import logging

import numpy as np


logger = logging.getLogger(__name__)

# Canonical class order used by analytics responses.
CLASS_NAMES = ("Forest", "Water Bodies", "Agriculture", "Barren Land", "Built-up")
ZERO_BASED_CLASS_IDS = np.array([0, 1, 2, 3, 4], dtype=np.uint8)
ONE_BASED_CLASS_IDS = np.array([1, 2, 3, 4, 5], dtype=np.uint8)


def _ensure_same_shape(old_lulc, new_lulc):
    if old_lulc.shape != new_lulc.shape:
        raise ValueError(
            f"Raster shape mismatch: old={old_lulc.shape}, new={new_lulc.shape}. "
            "Both rasters must have identical dimensions."
        )


def _detect_class_schema(unique_classes: np.ndarray) -> str:
    zero_overlap = int(np.isin(unique_classes, ZERO_BASED_CLASS_IDS).sum())
    one_overlap = int(np.isin(unique_classes, ONE_BASED_CLASS_IDS).sum())
    if one_overlap > zero_overlap:
        return "one_based"
    if zero_overlap > one_overlap:
        return "zero_based"
    if (unique_classes == 5).any():
        return "one_based"
    if (unique_classes == 0).any():
        return "zero_based"
    return "zero_based"


def _normalize_lulc_classes(lulc_array: np.ndarray):
    data = np.asarray(lulc_array)
    if data.ndim != 2:
        raise ValueError(f"Expected single-band 2D raster. Got shape={data.shape}")

    # Use a small sample to detect schema instead of scanning the whole massive array twice
    sample = data[::10, ::10].flatten() if data.size > 10000 else data.flatten()
    unique_classes = np.unique(sample.astype(np.int16))
    schema = _detect_class_schema(unique_classes)

    # Use uint8 for normalized data (1/2 the size of int16, 1/4 of int32/float32)
    normalized = np.full(data.shape, fill_value=255, dtype=np.uint8)
    if schema == "one_based":
        valid_mask = np.isin(data, ONE_BASED_CLASS_IDS)
        normalized[valid_mask] = (data[valid_mask] - 1).astype(np.uint8)
    else:
        valid_mask = np.isin(data, ZERO_BASED_CLASS_IDS)
        normalized[valid_mask] = data[valid_mask].astype(np.uint8)

    return normalized, valid_mask, unique_classes.tolist(), schema


def _class_pixel_counts(normalized: np.ndarray) -> list[int]:
    return [int((normalized == idx).sum()) for idx in range(len(CLASS_NAMES))]


def _log_class_validation(context: str, total_pixels: int, unique_classes: list[int], schema: str, class_counts: list[int]):
    logger.info(
        "%s raster validation | total_pixels=%s unique_classes=%s schema=%s class_counts=%s",
        context,
        total_pixels,
        unique_classes,
        schema,
        {
            "forest": class_counts[0],
            "water": class_counts[1],
            "agriculture": class_counts[2],
            "barren": class_counts[3],
            "builtup": class_counts[4],
        },
    )
    if class_counts[4] == 0:
        logger.warning(
            "%s raster validation | built-up class missing in classified raster. "
            "Retrain RF with better built-up samples if this is unexpected.",
            context,
        )


def area_stats(lulc_array, pixel_size=10):
    pixel_area_ha = (pixel_size * pixel_size) / 10000
    normalized, valid_mask, unique_classes, schema = _normalize_lulc_classes(lulc_array)
    valid_pixels = int(valid_mask.sum())
    class_counts = _class_pixel_counts(normalized)
    _log_class_validation("LULC Distribution", valid_pixels, unique_classes, schema, class_counts)

    if valid_pixels == 0:
        return {
            "total_area_ha": 0,
            "stats": [{"class_name": name, "area_ha": 0, "percentage": 0} for name in CLASS_NAMES],
        }

    total_area = valid_pixels * pixel_area_ha
    stats = []

    for idx, name in enumerate(CLASS_NAMES):
        pixel_count = class_counts[idx]
        area = pixel_count * pixel_area_ha
        percentage = (pixel_count / valid_pixels) * 100 if valid_pixels > 0 else 0

        stats.append({
            "class_name": name,
            "area_ha": round(area, 2),
            "percentage": round(percentage, 2)
        })

    return {
        "total_area_ha": round(total_area, 2),
        "stats": stats
    }


def change_stats(old_lulc, new_lulc, pixel_size=10):
    _ensure_same_shape(old_lulc, new_lulc)
    pixel_area_ha = (pixel_size * pixel_size) / 10000

    old_norm, old_valid, _, _ = _normalize_lulc_classes(old_lulc)
    new_norm, new_valid, _, _ = _normalize_lulc_classes(new_lulc)
    valid_mask = old_valid & new_valid

    # Optimization: count transitions without creating a full N*num_classes mask array
    num_classes = len(CLASS_NAMES)
    matrix_counts = np.zeros((num_classes, num_classes), dtype=float)

    for i in range(num_classes):
        # Filter pixels that started as class i
        from_i_mask = valid_mask & (old_norm == i)
        if not from_i_mask.any():
            continue
        
        # Of those pixels, what did they become?
        dest_classes = new_norm[from_i_mask]
        vals, counts = np.unique(dest_classes, return_counts=True)
        for v, c in zip(vals, counts):
            if v < num_classes:
                matrix_counts[i, v] = float(c)

    breakdown = []
    for i in range(num_classes):
        for j in range(num_classes):
            count = matrix_counts[i, j]
            if count > 0:
                breakdown.append({
                    "from_class": CLASS_NAMES[i],
                    "to_class": CLASS_NAMES[j],
                    "area_ha": round(count * pixel_area_ha, 2)
                })

    matrix_area = matrix_counts * pixel_area_ha
    row_sums = matrix_counts.sum(axis=1)
    with np.errstate(divide='ignore', invalid='ignore'):
        matrix_normalized = (matrix_counts.T / row_sums).T * 100
        matrix_normalized = np.nan_to_num(matrix_normalized)

    return {
        "matrix_area": np.round(matrix_area, 2).tolist(),
        "matrix_percentage": np.round(matrix_normalized, 1).tolist(),
        "breakdown": breakdown
    }


def lulc_distribution(lulc_array):
    normalized, valid_mask, unique_classes, schema = _normalize_lulc_classes(lulc_array)
    class_counts = _class_pixel_counts(normalized)
    total_pixels = int(valid_mask.sum())
    _log_class_validation("Analytics /distribution", total_pixels, unique_classes, schema, class_counts)
    if total_pixels == 0:
        return {
            "forest": 0,
            "water": 0,
            "agriculture": 0,
            "barren": 0,
            "builtup": 0,
        }
    return {
        "forest": round((class_counts[0] / total_pixels) * 100, 2),
        "water": round((class_counts[1] / total_pixels) * 100, 2),
        "agriculture": round((class_counts[2] / total_pixels) * 100, 2),
        "barren": round((class_counts[3] / total_pixels) * 100, 2),
        "builtup": round((class_counts[4] / total_pixels) * 100, 2),
    }


def lulc_analytics_payload(lulc_array, old_lulc, new_lulc, pixel_size=10):
    change = change_stats(old_lulc, new_lulc, pixel_size=pixel_size)
    return {
        "distribution": lulc_distribution(lulc_array),
        "transition_matrix": change["matrix_percentage"],
    }

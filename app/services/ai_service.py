import numpy as np

from app.constants import LULC_CLASSES
from app.services.analytics_service import area_stats


CLASS_IDS = list(LULC_CLASSES.keys())
CLASS_INDEX = {cls_id: idx for idx, cls_id in enumerate(CLASS_IDS)}
SUPPORTED_SCENARIOS = {"trend", "agriculture_protection", "green_zone_enforcement"}


def _ensure_same_shape(old_lulc: np.ndarray, new_lulc: np.ndarray):
    if old_lulc.shape != new_lulc.shape:
        raise ValueError(
            f"Raster shape mismatch: old={old_lulc.shape}, new={new_lulc.shape}. "
            "Both rasters must have identical dimensions."
        )


def transition_probability_matrix(old_lulc: np.ndarray, new_lulc: np.ndarray) -> np.ndarray:
    _ensure_same_shape(old_lulc, new_lulc)
    matrix = np.zeros((len(CLASS_IDS), len(CLASS_IDS)), dtype=float)
    for from_cls in CLASS_IDS:
        from_mask = old_lulc == from_cls
        total = from_mask.sum()
        if total == 0:
            matrix[CLASS_INDEX[from_cls], CLASS_INDEX[from_cls]] = 1.0
            continue
        for to_cls in CLASS_IDS:
            count = np.logical_and(from_mask, new_lulc == to_cls).sum()
            matrix[CLASS_INDEX[from_cls], CLASS_INDEX[to_cls]] = count / total
    return matrix


def _normalize_rows(matrix: np.ndarray) -> np.ndarray:
    row_sums = matrix.sum(axis=1, keepdims=True)
    row_sums[row_sums == 0] = 1.0
    return matrix / row_sums


def apply_policy_scenario(matrix: np.ndarray, scenario: str) -> np.ndarray:
    scenario = scenario.lower()
    if scenario not in SUPPORTED_SCENARIOS:
        raise ValueError(
            f"Unsupported scenario '{scenario}'. "
            f"Supported scenarios: {sorted(SUPPORTED_SCENARIOS)}"
        )
    adjusted = matrix.copy()

    agri = CLASS_INDEX[3]
    forest = CLASS_INDEX[1]
    built = CLASS_INDEX[5]

    if scenario == "agriculture_protection":
        adjusted[agri, built] = min(adjusted[agri, built], 0.05)
        adjusted[agri, agri] += 0.12
    elif scenario == "green_zone_enforcement":
        adjusted[forest, built] = min(adjusted[forest, built], 0.03)
        adjusted[agri, built] = min(adjusted[agri, built], 0.1)
        adjusted[forest, forest] += 0.1
        adjusted[agri, agri] += 0.08
    # default trend keeps matrix as-is
    return _normalize_rows(adjusted)


def simulate_lulc(
    current_lulc: np.ndarray,
    transition_matrix: np.ndarray,
    steps: int,
    seed: int = 42,
) -> np.ndarray:
    if steps <= 0:
        return current_lulc.copy()

    rng = np.random.default_rng(seed)
    simulated = current_lulc.copy()

    for _ in range(steps):
        next_state = simulated.copy()
        for cls_id in CLASS_IDS:
            mask = simulated == cls_id
            count = int(mask.sum())
            if count == 0:
                continue
            probs = transition_matrix[CLASS_INDEX[cls_id]]
            sampled = rng.choice(CLASS_IDS, size=count, p=probs)
            next_state[mask] = sampled
        simulated = next_state

    return simulated


def compute_risk_masks(old_lulc: np.ndarray, new_lulc: np.ndarray):
    _ensure_same_shape(old_lulc, new_lulc)
    forest_to_built = (old_lulc == 1) & (new_lulc == 5)
    agri_to_built = (old_lulc == 3) & (new_lulc == 5)
    water_loss = (old_lulc == 2) & (new_lulc != 2)

    high_risk = forest_to_built | water_loss
    medium_risk = agri_to_built & ~high_risk

    alerts = []
    pixel_area_ha = 0.01
    if forest_to_built.any():
        alerts.append(
            f"High Risk Alert: Forest area converted to built-up zone ({forest_to_built.sum() * pixel_area_ha:.2f} ha)."
        )
    if water_loss.any():
        alerts.append(
            f"High Risk Alert: Water body loss detected ({water_loss.sum() * pixel_area_ha:.2f} ha)."
        )
    if agri_to_built.any():
        alerts.append(
            f"Medium Risk Alert: Agriculture converted to built-up area ({agri_to_built.sum() * pixel_area_ha:.2f} ha)."
        )

    return high_risk, medium_risk, alerts


def _box_mean(binary: np.ndarray, radius: int = 4) -> np.ndarray:
    # Integral-image box mean, avoids extra dependencies.
    binary = binary.astype(float)
    padded = np.pad(binary, ((radius, radius), (radius, radius)), mode="constant")
    integral = padded.cumsum(0).cumsum(1)
    k = 2 * radius + 1
    out = (
        integral[k:, k:]
        - integral[:-k, k:]
        - integral[k:, :-k]
        + integral[:-k, :-k]
    ) / (k * k)
    return out


def urban_growth_hotspot_density(old_lulc: np.ndarray, new_lulc: np.ndarray) -> np.ndarray:
    _ensure_same_shape(old_lulc, new_lulc)
    # Capture overall land-use transition intensity while emphasizing
    # conversions into built-up areas (class 5).
    any_change = (old_lulc != new_lulc).astype(float)
    built_increase = ((old_lulc != 5) & (new_lulc == 5)).astype(float)
    weighted_change = any_change + (1.5 * built_increase)
    return _box_mean(weighted_change, radius=4)


def hotspot_stats(density: np.ndarray) -> dict:
    nonzero = density[density > 0]
    if nonzero.size == 0:
        return {
            "high_pixels": 0,
            "medium_pixels": 0,
            "stable_pixels": 0,
            "coverage_pixels": 0,
        }

    # Adaptive thresholds avoid all-zero bins across cities with different scales.
    medium_thr = float(np.quantile(nonzero, 0.5))
    high_thr = float(np.quantile(nonzero, 0.85))
    high_thr = max(high_thr, medium_thr + 1e-9)

    high = int((density >= high_thr).sum())
    medium = int(((density >= medium_thr) & (density < high_thr)).sum())
    stable = int(((density > 0) & (density < medium_thr)).sum())
    total = high + medium + stable
    return {
        "high_pixels": high,
        "medium_pixels": medium,
        "stable_pixels": stable,
        "coverage_pixels": total,
    }


def insights_engine(start_year: int, end_year: int, old_lulc: np.ndarray, new_lulc: np.ndarray):
    _ensure_same_shape(old_lulc, new_lulc)
    old_stats = area_stats(old_lulc)["stats"]
    new_stats = area_stats(new_lulc)["stats"]
    by_class_old = {item["class_name"]: item for item in old_stats}
    by_class_new = {item["class_name"]: item for item in new_stats}

    built_old = by_class_old.get("Built-up", {}).get("area_ha", 0)
    built_new = by_class_new.get("Built-up", {}).get("area_ha", 0)
    agri_old = by_class_old.get("Agriculture", {}).get("area_ha", 0)
    agri_new = by_class_new.get("Agriculture", {}).get("area_ha", 0)

    built_pct = ((built_new - built_old) / built_old * 100) if built_old > 0 else 0
    agri_pct = ((agri_new - agri_old) / agri_old * 100) if agri_old > 0 else 0

    north_half = new_lulc[: new_lulc.shape[0] // 2, :]
    south_half = new_lulc[new_lulc.shape[0] // 2 :, :]
    north_built = int((north_half == 5).sum())
    south_built = int((south_half == 5).sum())
    dominant_region = "northern region" if north_built >= south_built else "southern region"

    recommendations = [
        "Urban development should prioritize barren land instead of agricultural zones.",
        "Protect high-risk ecological transition zones through stricter zoning control.",
        "Focus infrastructure planning around stable growth corridors to reduce sprawl pressure.",
    ]

    insights = [
        f"Between {start_year} and {end_year} built-up area changed by {built_pct:.1f}%.",
        f"Agricultural land changed by {agri_pct:.1f}%.",
        f"Urban expansion is concentrated in the {dominant_region}.",
    ]

    return {"insights": insights, "recommendations": recommendations}

import numpy as np
from fastapi import APIRouter, HTTPException

from app.constants import LULC_CLASSES
from app.services.raster_service import load_confidence, load_lulc, load_change

router = APIRouter()


def _safe_confidence_stats(year: int, city: str):
    data, _ = load_confidence(year, city=city)
    valid = data[data > 0]
    if valid.size == 0:
        raise HTTPException(status_code=404, detail="No valid confidence pixels found in raster")
    return {
        "year": year,
        "city": city,
        "min": int(valid.min()),
        "max": int(valid.max()),
        "mean": round(float(valid.mean()), 2),
        "median": int(np.median(valid)),
        "valid_pixels": int(valid.size),
        "total_pixels": int(data.size),
        "coverage_percent": round((valid.size / data.size) * 100, 2),
    }


def _confidence_by_lulc(year: int, city: str):
    lulc = load_lulc(year, city=city)
    conf, _ = load_confidence(year, city=city)
    mask = conf > 0

    result = {"year": year, "city": city}
    for class_id, class_name in LULC_CLASSES.items():
        class_mask = (lulc == class_id) & mask
        result[class_name] = {
            "mean_confidence": round(float(conf[class_mask].mean()), 2) if class_mask.any() else None,
            "pixel_count": int(class_mask.sum()),
        }
    return result


def _confidence_by_change(start_year: int, end_year: int, city: str):
    change_data = load_change(start_year, end_year, city=city)
    conf_data, _ = load_confidence(end_year, city=city)

    valid_mask = conf_data > 0
    changed_mask = (change_data != 0) & valid_mask
    unchanged_mask = (change_data == 0) & valid_mask

    changed_conf = conf_data[changed_mask]
    unchanged_conf = conf_data[unchanged_mask]

    return {
        "period": f"{start_year}-{end_year}",
        "city": city,
        "changed": {
            "mean_confidence": round(float(changed_conf.mean()), 2) if changed_conf.size > 0 else None,
            "pixel_count": int(changed_mask.sum()),
        },
        "unchanged": {
            "mean_confidence": round(float(unchanged_conf.mean()), 2) if unchanged_conf.size > 0 else None,
            "pixel_count": int(unchanged_mask.sum()),
        },
    }


@router.get("/{year}")
def confidence_summary(year: int):
    # Backward-compatible default city endpoint
    try:
        return _safe_confidence_stats(year, city="tirupati")
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/lulc/{year}")
def confidence_by_lulc(year: int):
    try:
        return _confidence_by_lulc(year, city="tirupati")
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/lulc/{city}/{year}")
def confidence_by_lulc_city(city: str, year: int):
    try:
        return _confidence_by_lulc(year, city=city)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/change/{start_year}/{end_year}")
def confidence_by_change(start_year: int, end_year: int):
    if end_year <= start_year:
        raise HTTPException(status_code=400, detail="end_year must be greater than start_year")
    try:
        return _confidence_by_change(start_year, end_year, city="tirupati")
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/change/{city}/{start_year}/{end_year}")
def confidence_by_change_city(city: str, start_year: int, end_year: int):
    if end_year <= start_year:
        raise HTTPException(status_code=400, detail="end_year must be greater than start_year")
    try:
        return _confidence_by_change(start_year, end_year, city=city)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{city}/{year}")
def confidence_summary_by_city(city: str, year: int):
    try:
        return _safe_confidence_stats(year, city=city)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

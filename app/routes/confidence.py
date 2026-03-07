import numpy as np
import logging
from fastapi import APIRouter, HTTPException

from app.constants import LULC_CLASSES
from app.config.cities import resolve_city_id
from app.services.raster_service import (
    load_change,
    load_confidence,
    load_lulc,
    resolve_default_city_for_change_and_confidence,
    resolve_default_city_for_confidence_year,
    resolve_default_city_for_lulc_and_confidence_year,
)

router = APIRouter()
logger = logging.getLogger(__name__)


def _safe_confidence_stats(year: int, city: str):
    data, _ = load_confidence(year, city=city)
    valid = data[data > 0]
    if valid.size == 0:
        return {
            "year": year,
            "city": city,
            "min": 0,
            "max": 0,
            "mean": 0.0,
            "median": 0,
            "valid_pixels": 0,
            "total_pixels": int(data.size),
            "coverage_percent": 0.0,
            "accuracy": 0.0,
            "kappa": 0.0,
        }

    mean_conf = float(valid.mean())
    accuracy = max(0.0, min(1.0, mean_conf / 100.0))
    # Heuristic normalization for a bounded kappa-like score from confidence.
    kappa = max(0.0, min(1.0, (accuracy - 0.5) / 0.5))
    return {
        "year": year,
        "city": city,
        "min": int(valid.min()),
        "max": int(valid.max()),
        "mean": round(mean_conf, 2),
        "median": int(np.median(valid)),
        "valid_pixels": int(valid.size),
        "total_pixels": int(data.size),
        "coverage_percent": round((valid.size / data.size) * 100, 2),
        "accuracy": round(accuracy, 4),
        "kappa": round(kappa, 4),
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
    try:
        city_id = resolve_default_city_for_confidence_year(year)
        logger.info("Confidence summary served for year=%s using city=%s", year, city_id)
        return _safe_confidence_stats(year, city=city_id)
    except FileNotFoundError as e:
        logger.warning("Confidence summary unavailable for year=%s: %s", year, e)
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        logger.warning("Invalid confidence summary request for year=%s: %s", year, e)
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/lulc/{year}")
def confidence_by_lulc(year: int):
    try:
        city_id = resolve_default_city_for_lulc_and_confidence_year(year)
        logger.info("Confidence-by-LULC served for year=%s using city=%s", year, city_id)
        return _confidence_by_lulc(year, city=city_id)
    except FileNotFoundError as e:
        logger.warning("Confidence-by-LULC unavailable for year=%s: %s", year, e)
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        logger.warning("Invalid confidence-by-LULC request for year=%s: %s", year, e)
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/lulc/{city}/{year}")
def confidence_by_lulc_city(city: str, year: int):
    try:
        city_id = resolve_city_id(city)
        return _confidence_by_lulc(year, city=city_id)
    except FileNotFoundError as e:
        logger.warning("Confidence-by-LULC unavailable for city=%s year=%s: %s", city, year, e)
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        logger.warning("Invalid confidence-by-LULC request for city=%s year=%s: %s", city, year, e)
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/change/{start_year}/{end_year}")
def confidence_by_change(start_year: int, end_year: int):
    if end_year <= start_year:
        raise HTTPException(status_code=400, detail="end_year must be greater than start_year")
    try:
        city_id = resolve_default_city_for_change_and_confidence(start_year, end_year)
        logger.info("Confidence-by-change served for %s-%s using city=%s", start_year, end_year, city_id)
        return _confidence_by_change(start_year, end_year, city=city_id)
    except FileNotFoundError as e:
        logger.warning("Confidence-by-change unavailable for %s-%s: %s", start_year, end_year, e)
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        logger.warning("Invalid confidence-by-change request for %s-%s: %s", start_year, end_year, e)
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/change/{city}/{start_year}/{end_year}")
def confidence_by_change_city(city: str, start_year: int, end_year: int):
    if end_year <= start_year:
        raise HTTPException(status_code=400, detail="end_year must be greater than start_year")
    try:
        city_id = resolve_city_id(city)
        return _confidence_by_change(start_year, end_year, city=city_id)
    except FileNotFoundError as e:
        logger.warning("Confidence-by-change unavailable for city=%s %s-%s: %s", city, start_year, end_year, e)
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        logger.warning("Invalid confidence-by-change request for city=%s %s-%s: %s", city, start_year, end_year, e)
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{city}/{year}")
def confidence_summary_by_city(city: str, year: int):
    try:
        city_id = resolve_city_id(city)
        return _safe_confidence_stats(year, city=city_id)
    except FileNotFoundError as e:
        logger.warning("Confidence summary unavailable for city=%s year=%s: %s", city, year, e)
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        logger.warning("Invalid confidence summary request for city=%s year=%s: %s", city, year, e)
        raise HTTPException(status_code=400, detail=str(e))

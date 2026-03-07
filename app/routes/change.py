import logging

from fastapi import APIRouter, HTTPException

from app.config.cities import resolve_city_id
from app.services.analytics_service import area_stats, change_stats
from app.services.raster_service import load_lulc, resolve_default_city_for_change_pair

router = APIRouter()
logger = logging.getLogger(__name__)


def _class_percentage(stats_payload: dict, class_name: str) -> float:
    for row in stats_payload.get("stats", []):
        if str(row.get("class_name", "")).lower() == class_name.lower():
            return float(row.get("percentage", 0.0))
    return 0.0


def _change_summary_fields(old, new, payload: dict, city_id: str, start_year: int, end_year: int) -> dict:
    old_stats = area_stats(old)
    new_stats = area_stats(new)

    old_urban = _class_percentage(old_stats, "Built-up")
    new_urban = _class_percentage(new_stats, "Built-up")
    old_vegetation = _class_percentage(old_stats, "Forest") + _class_percentage(old_stats, "Agriculture")
    new_vegetation = _class_percentage(new_stats, "Forest") + _class_percentage(new_stats, "Agriculture")

    payload = payload.copy()
    payload.update(
        {
            "city": city_id,
            "from_year": start_year,
            "to_year": end_year,
            "urban_growth_percent": round(new_urban - old_urban, 2),
            "vegetation_loss_percent": round(max(0.0, old_vegetation - new_vegetation), 2),
        }
    )
    return payload


@router.get("/{start_year}/{end_year}")
def lulc_change(start_year: int, end_year: int):
    if end_year <= start_year:
        raise HTTPException(status_code=400, detail="end_year must be greater than start_year")
    try:
        city_id = resolve_default_city_for_change_pair(start_year, end_year)
        old = load_lulc(start_year, city=city_id)
        new = load_lulc(end_year, city=city_id)
        logger.info("Change summary served for %s-%s using city=%s", start_year, end_year, city_id)
        payload = change_stats(old, new)
        return _change_summary_fields(old, new, payload, city_id, start_year, end_year)
    except FileNotFoundError as e:
        logger.warning("Change summary unavailable for %s-%s: %s", start_year, end_year, e)
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        logger.warning("Invalid change summary request for %s-%s: %s", start_year, end_year, e)
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{city}/{start_year}/{end_year}")
def lulc_change_by_city(city: str, start_year: int, end_year: int):
    if end_year <= start_year:
        raise HTTPException(status_code=400, detail="end_year must be greater than start_year")
    try:
        city_id = resolve_city_id(city)
        old = load_lulc(start_year, city=city_id)
        new = load_lulc(end_year, city=city_id)
        logger.info("Change summary served for city=%s %s-%s", city_id, start_year, end_year)
        payload = change_stats(old, new)
        return _change_summary_fields(old, new, payload, city_id, start_year, end_year)
    except FileNotFoundError as e:
        logger.warning("Change summary unavailable for city=%s %s-%s: %s", city, start_year, end_year, e)
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        logger.warning("Invalid change request for city=%s %s-%s: %s", city, start_year, end_year, e)
        raise HTTPException(status_code=400, detail=str(e))

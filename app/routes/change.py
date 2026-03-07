import logging

from fastapi import APIRouter, HTTPException

from app.config.cities import resolve_city_id
from app.services.analytics_service import change_stats
from app.services.raster_service import load_lulc, resolve_default_city_for_change_pair

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/{start_year}/{end_year}")
def lulc_change(start_year: int, end_year: int):
    if end_year <= start_year:
        raise HTTPException(status_code=400, detail="end_year must be greater than start_year")
    try:
        city_id = resolve_default_city_for_change_pair(start_year, end_year)
        old = load_lulc(start_year, city=city_id)
        new = load_lulc(end_year, city=city_id)
        logger.info("Change summary served for %s-%s using city=%s", start_year, end_year, city_id)
        return change_stats(old, new)
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
        return change_stats(old, new)
    except FileNotFoundError as e:
        logger.warning("Change summary unavailable for city=%s %s-%s: %s", city, start_year, end_year, e)
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        logger.warning("Invalid change request for city=%s %s-%s: %s", city, start_year, end_year, e)
        raise HTTPException(status_code=400, detail=str(e))

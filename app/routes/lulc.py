import logging
from functools import lru_cache

from fastapi import APIRouter, HTTPException

from app.config.cities import resolve_city_id
from app.services.analytics_service import area_stats
from app.services.raster_service import load_lulc, resolve_default_city_for_lulc_year

router = APIRouter()
logger = logging.getLogger(__name__)


@lru_cache(maxsize=256)
def _cached_lulc_area(city_id: str, year: int):
    lulc = load_lulc(year, city=city_id)
    return area_stats(lulc)


@router.get("/{year}")
def lulc_area(year: int):
    try:
        city_id = resolve_default_city_for_lulc_year(year)
        payload = _cached_lulc_area(city_id, year)
        logger.info("LULC summary served for year=%s using city=%s", year, city_id)
        return payload
    except FileNotFoundError as e:
        logger.warning("LULC summary unavailable for year=%s: %s", year, e)
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        logger.warning("Invalid LULC summary request for year=%s: %s", year, e)
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{city}/{year}")
def lulc_area_by_city(city: str, year: int):
    try:
        city_id = resolve_city_id(city)
        payload = _cached_lulc_area(city_id, year)
        logger.info("LULC summary served for city=%s year=%s", city_id, year)
        return payload
    except FileNotFoundError as e:
        logger.warning("LULC summary unavailable for city=%s year=%s: %s", city, year, e)
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        logger.warning("Invalid LULC request for city=%s year=%s: %s", city, year, e)
        raise HTTPException(status_code=400, detail=str(e))

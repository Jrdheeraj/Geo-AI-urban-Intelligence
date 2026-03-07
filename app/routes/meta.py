import logging
from functools import lru_cache

from fastapi import APIRouter, HTTPException, Query

from app.config.cities import list_available_cities, resolve_city_id
from app.services.raster_service import (
    available_change_pairs,
    available_confidence_years,
    available_lulc_years,
    get_city_bounds,
)

router = APIRouter()
logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def _cached_cities_payload() -> dict[str, list[str]]:
    return {"cities": list_available_cities()}


@router.get("/cities")
def cities(refresh: bool = Query(default=False)):
    if refresh:
        _cached_cities_payload.cache_clear()
    payload = _cached_cities_payload()
    logger.info("Returning %d cities", len(payload["cities"]))
    return payload


@router.get("/availability/{city}")
def availability(city: str):
    try:
        city_id = resolve_city_id(city)
        return {
            "city": city_id,
            "lulc_years": available_lulc_years(city_id),
            "confidence_years": available_confidence_years(city_id),
            "change_pairs": [{"start": s, "end": e} for s, e in available_change_pairs(city_id)],
            "bounds": get_city_bounds(city_id),
        }
    except FileNotFoundError as e:
        logger.warning("Availability lookup failed for city '%s': %s", city, e)
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        logger.warning("Invalid city in availability lookup '%s': %s", city, e)
        raise HTTPException(status_code=400, detail=str(e))

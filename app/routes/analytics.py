import logging

from fastapi import APIRouter, HTTPException, Query

from app.config.cities import resolve_city_id
from app.services.analytics_service import lulc_analytics_payload
from app.services.raster_service import available_lulc_years, load_lulc, resolve_default_city

router = APIRouter()
logger = logging.getLogger(__name__)


def _resolve_years(city: str, year: int | None, start_year: int | None, end_year: int | None):
    years = available_lulc_years(city)
    if not years:
        raise HTTPException(status_code=404, detail=f"No LULC rasters found for city '{city}'.")

    resolved_start = start_year if start_year is not None else years[0]
    resolved_end = end_year if end_year is not None else years[-1]
    resolved_year = year if year is not None else resolved_end

    if resolved_start not in years:
        raise HTTPException(status_code=400, detail=f"start_year {resolved_start} is not available for city '{city}'.")
    if resolved_end not in years:
        raise HTTPException(status_code=400, detail=f"end_year {resolved_end} is not available for city '{city}'.")
    if resolved_year not in years:
        raise HTTPException(status_code=400, detail=f"year {resolved_year} is not available for city '{city}'.")
    if resolved_end <= resolved_start:
        raise HTTPException(status_code=400, detail="end_year must be greater than start_year")

    return resolved_year, resolved_start, resolved_end


@router.get("/lulc")
def lulc_analytics(
    city: str | None = Query(default=None),
    year: int | None = Query(default=None),
    start_year: int | None = Query(default=None),
    end_year: int | None = Query(default=None),
):
    try:
        city_id = resolve_city_id(city) if city else resolve_default_city()
        resolved_year, resolved_start, resolved_end = _resolve_years(city_id, year, start_year, end_year)
        distribution_raster = load_lulc(resolved_year, city=city_id)
        old_raster = load_lulc(resolved_start, city=city_id)
        new_raster = load_lulc(resolved_end, city=city_id)
        payload = lulc_analytics_payload(distribution_raster, old_raster, new_raster)
        payload["city"] = city_id
        payload["year"] = resolved_year
        payload["start_year"] = resolved_start
        payload["end_year"] = resolved_end
        return payload
    except FileNotFoundError as e:
        logger.warning("Analytics unavailable for city=%s year=%s start=%s end=%s: %s", city, year, start_year, end_year, e)
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        logger.warning("Invalid analytics request for city=%s year=%s start=%s end=%s: %s", city, year, start_year, end_year, e)
        raise HTTPException(status_code=400, detail=str(e))

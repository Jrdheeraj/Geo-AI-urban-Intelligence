from fastapi import APIRouter, HTTPException, Query

from app.services.analytics_service import lulc_analytics_payload
from app.services.raster_service import available_lulc_years, load_lulc

router = APIRouter()


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
    city: str = Query(default="tirupati"),
    year: int | None = Query(default=None),
    start_year: int | None = Query(default=None),
    end_year: int | None = Query(default=None),
):
    try:
        resolved_year, resolved_start, resolved_end = _resolve_years(city, year, start_year, end_year)
        distribution_raster = load_lulc(resolved_year, city=city)
        old_raster = load_lulc(resolved_start, city=city)
        new_raster = load_lulc(resolved_end, city=city)
        payload = lulc_analytics_payload(distribution_raster, old_raster, new_raster)
        payload["city"] = city
        payload["year"] = resolved_year
        payload["start_year"] = resolved_start
        payload["end_year"] = resolved_end
        return payload
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

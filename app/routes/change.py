from fastapi import APIRouter, HTTPException
from app.services.raster_service import load_lulc
from app.services.analytics_service import change_stats

router = APIRouter()

@router.get("/{start_year}/{end_year}")
def lulc_change(start_year: int, end_year: int):
    # Backward-compatible default city endpoint
    if end_year <= start_year:
        raise HTTPException(status_code=400, detail="end_year must be greater than start_year")
    try:
        old = load_lulc(start_year, city="tirupati")
        new = load_lulc(end_year, city="tirupati")
        return change_stats(old, new)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{city}/{start_year}/{end_year}")
def lulc_change_by_city(city: str, start_year: int, end_year: int):
    if end_year <= start_year:
        raise HTTPException(status_code=400, detail="end_year must be greater than start_year")
    try:
        old = load_lulc(start_year, city=city)
        new = load_lulc(end_year, city=city)
        return change_stats(old, new)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

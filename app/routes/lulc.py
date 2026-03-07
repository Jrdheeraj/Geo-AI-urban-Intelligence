from fastapi import APIRouter, HTTPException
from app.services.raster_service import load_lulc
from app.services.analytics_service import area_stats

router = APIRouter()

@router.get("/{year}")
def lulc_area(year: int):
    # Backward-compatible default city endpoint
    try:
        lulc = load_lulc(year, city="tirupati")
        return area_stats(lulc)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{city}/{year}")
def lulc_area_by_city(city: str, year: int):
    try:
        lulc = load_lulc(year, city=city)
        return area_stats(lulc)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

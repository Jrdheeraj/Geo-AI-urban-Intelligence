from fastapi import APIRouter, HTTPException

from app.config.cities import list_available_cities
from app.services.raster_service import (
    available_change_pairs,
    available_confidence_years,
    available_lulc_years,
    get_city_bounds,
)

router = APIRouter()


@router.get("/cities")
def cities():
    return {"cities": list_available_cities()}


@router.get("/availability/{city}")
def availability(city: str):
    try:
        return {
            "city": city,
            "lulc_years": available_lulc_years(city),
            "confidence_years": available_confidence_years(city),
            "change_pairs": [{"start": s, "end": e} for s, e in available_change_pairs(city)],
            "bounds": get_city_bounds(city),
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

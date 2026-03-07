from fastapi import APIRouter, HTTPException, Query, Response

from app.services.ai_service import (
    apply_policy_scenario,
    compute_risk_masks,
    simulate_lulc,
    transition_probability_matrix,
    urban_growth_hotspot_density,
)
from app.services.image_service import (
    create_change_image,
    create_confidence_image,
    create_hotspot_image,
    create_lulc_image,
    create_risk_image,
)
from app.services.raster_service import (
    get_city_bounds,
    load_change,
    load_confidence,
    load_lulc,
)

router = APIRouter()


@router.get("/bounds")
def get_bounds():
    # Backward-compatible default city endpoint
    try:
        return {"city": "tirupati", "bounds": get_city_bounds("tirupati")}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/bounds/{city}")
def get_city_bounds_endpoint(city: str):
    try:
        return {"city": city, "bounds": get_city_bounds(city)}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/lulc/{year}")
async def get_lulc_map(year: int):
    try:
        data = load_lulc(year, city="tirupati")
        return Response(content=create_lulc_image(data), media_type="image/png")
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/lulc/{city}/{year}")
async def get_lulc_map_city(city: str, year: int):
    try:
        data = load_lulc(year, city=city)
        return Response(content=create_lulc_image(data), media_type="image/png")
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/change/{start}/{end}")
async def get_change_map(start: int, end: int):
    if end <= start:
        raise HTTPException(status_code=400, detail="end must be greater than start")
    try:
        data = load_change(start, end, city="tirupati")
        return Response(content=create_change_image(data), media_type="image/png")
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/change/{city}/{start}/{end}")
async def get_change_map_city(city: str, start: int, end: int):
    if end <= start:
        raise HTTPException(status_code=400, detail="end must be greater than start")
    try:
        data = load_change(start, end, city=city)
        return Response(content=create_change_image(data), media_type="image/png")
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/confidence/{year}")
async def get_confidence_map(year: int):
    try:
        data, _ = load_confidence(year, city="tirupati")
        return Response(content=create_confidence_image(data), media_type="image/png")
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/confidence/{city}/{year}")
async def get_confidence_map_city(city: str, year: int):
    try:
        data, _ = load_confidence(year, city=city)
        return Response(content=create_confidence_image(data), media_type="image/png")
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/hotspot/{city}/{start}/{end}")
async def get_hotspot_map_city(city: str, start: int, end: int):
    if end <= start:
        raise HTTPException(status_code=400, detail="end must be greater than start")
    try:
        old = load_lulc(start, city=city)
        new = load_lulc(end, city=city)
        density = urban_growth_hotspot_density(old, new)
        return Response(content=create_hotspot_image(density), media_type="image/png")
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/risk/{city}/{start}/{end}")
async def get_risk_map_city(city: str, start: int, end: int):
    if end <= start:
        raise HTTPException(status_code=400, detail="end must be greater than start")
    try:
        old = load_lulc(start, city=city)
        new = load_lulc(end, city=city)
        high_risk, medium_risk, _ = compute_risk_masks(old, new)
        return Response(content=create_risk_image(high_risk, medium_risk), media_type="image/png")
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/simulation/{city}/{start}/{end}/{target_year}")
async def get_simulation_map_city(
    city: str,
    start: int,
    end: int,
    target_year: int,
    scenario: str = Query(default="trend"),
):
    try:
        if end <= start:
            raise HTTPException(status_code=400, detail="end must be greater than start")
        if target_year <= end:
            raise HTTPException(status_code=400, detail="target_year must be greater than end year")
        old = load_lulc(start, city=city)
        new = load_lulc(end, city=city)
        matrix = transition_probability_matrix(old, new)
        adjusted = apply_policy_scenario(matrix, scenario)
        simulated = simulate_lulc(new, adjusted, target_year - end)
        return Response(content=create_lulc_image(simulated), media_type="image/png")
    except HTTPException:
        raise
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

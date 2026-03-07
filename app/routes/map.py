import logging

from fastapi import APIRouter, HTTPException, Query, Response

from app.config.cities import resolve_city_id
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
    resolve_default_city,
    resolve_default_city_for_change_pair,
    resolve_default_city_for_confidence_year,
    resolve_default_city_for_lulc_year,
)

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/bounds")
def get_bounds():
    try:
        city_id = resolve_default_city()
        bounds = get_city_bounds(city_id)
        logger.info("Map bounds served for city=%s", city_id)
        return {"city": city_id, "bounds": bounds}
    except FileNotFoundError as e:
        logger.warning("Map bounds unavailable: %s", e)
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        logger.warning("Invalid bounds request: %s", e)
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/bounds/{city}")
def get_city_bounds_endpoint(city: str):
    try:
        city_id = resolve_city_id(city)
        bounds = get_city_bounds(city_id)
        logger.info("Map bounds served for city=%s", city_id)
        return {"city": city_id, "bounds": bounds}
    except FileNotFoundError as e:
        logger.warning("Map bounds unavailable for city=%s: %s", city, e)
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        logger.warning("Invalid bounds request for city=%s: %s", city, e)
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/lulc/{year}")
async def get_lulc_map(year: int):
    try:
        city_id = resolve_default_city_for_lulc_year(year)
        data = load_lulc(year, city=city_id)
        logger.info("Generated LULC map for year=%s city=%s", year, city_id)
        return Response(content=create_lulc_image(data), media_type="image/png")
    except FileNotFoundError as e:
        logger.warning("LULC map unavailable for year=%s: %s", year, e)
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        logger.warning("Invalid LULC map request for year=%s: %s", year, e)
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/lulc/{city}/{year}")
async def get_lulc_map_city(city: str, year: int):
    try:
        city_id = resolve_city_id(city)
        data = load_lulc(year, city=city_id)
        logger.info("Generated LULC map for city=%s year=%s", city_id, year)
        return Response(content=create_lulc_image(data), media_type="image/png")
    except FileNotFoundError as e:
        logger.warning("LULC map unavailable for city=%s year=%s: %s", city, year, e)
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        logger.warning("Invalid LULC map request for city=%s year=%s: %s", city, year, e)
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/change/{start}/{end}")
async def get_change_map(start: int, end: int):
    if end <= start:
        raise HTTPException(status_code=400, detail="end must be greater than start")
    try:
        city_id = resolve_default_city_for_change_pair(start, end)
        data = load_change(start, end, city=city_id)
        logger.info("Generated change map for %s-%s city=%s", start, end, city_id)
        return Response(content=create_change_image(data), media_type="image/png")
    except FileNotFoundError as e:
        logger.warning("Change map unavailable for %s-%s: %s", start, end, e)
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        logger.warning("Invalid change map request for %s-%s: %s", start, end, e)
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/change/{city}/{start}/{end}")
async def get_change_map_city(city: str, start: int, end: int):
    if end <= start:
        raise HTTPException(status_code=400, detail="end must be greater than start")
    try:
        city_id = resolve_city_id(city)
        data = load_change(start, end, city=city_id)
        logger.info("Generated change map for city=%s %s-%s", city_id, start, end)
        return Response(content=create_change_image(data), media_type="image/png")
    except FileNotFoundError as e:
        logger.warning("Change map unavailable for city=%s %s-%s: %s", city, start, end, e)
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        logger.warning("Invalid change map request for city=%s %s-%s: %s", city, start, end, e)
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/confidence/{year}")
async def get_confidence_map(year: int):
    try:
        city_id = resolve_default_city_for_confidence_year(year)
        data, _ = load_confidence(year, city=city_id)
        logger.info("Generated confidence map for year=%s city=%s", year, city_id)
        return Response(content=create_confidence_image(data), media_type="image/png")
    except FileNotFoundError as e:
        logger.warning("Confidence map unavailable for year=%s: %s", year, e)
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        logger.warning("Invalid confidence map request for year=%s: %s", year, e)
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/confidence/{city}/{year}")
async def get_confidence_map_city(city: str, year: int):
    try:
        city_id = resolve_city_id(city)
        data, _ = load_confidence(year, city=city_id)
        logger.info("Generated confidence map for city=%s year=%s", city_id, year)
        return Response(content=create_confidence_image(data), media_type="image/png")
    except FileNotFoundError as e:
        logger.warning("Confidence map unavailable for city=%s year=%s: %s", city, year, e)
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        logger.warning("Invalid confidence map request for city=%s year=%s: %s", city, year, e)
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/hotspot/{city}/{start}/{end}")
async def get_hotspot_map_city(city: str, start: int, end: int):
    if end <= start:
        raise HTTPException(status_code=400, detail="end must be greater than start")
    try:
        city_id = resolve_city_id(city)
        old = load_lulc(start, city=city_id)
        new = load_lulc(end, city=city_id)
        density = urban_growth_hotspot_density(old, new)
        logger.info("Generated hotspot map for city=%s %s-%s", city_id, start, end)
        return Response(content=create_hotspot_image(density), media_type="image/png")
    except FileNotFoundError as e:
        logger.warning("Hotspot map unavailable for city=%s %s-%s: %s", city, start, end, e)
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        logger.warning("Invalid hotspot map request for city=%s %s-%s: %s", city, start, end, e)
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/risk/{city}/{start}/{end}")
async def get_risk_map_city(city: str, start: int, end: int):
    if end <= start:
        raise HTTPException(status_code=400, detail="end must be greater than start")
    try:
        city_id = resolve_city_id(city)
        old = load_lulc(start, city=city_id)
        new = load_lulc(end, city=city_id)
        high_risk, medium_risk, _ = compute_risk_masks(old, new)
        logger.info("Generated risk map for city=%s %s-%s", city_id, start, end)
        return Response(content=create_risk_image(high_risk, medium_risk), media_type="image/png")
    except FileNotFoundError as e:
        logger.warning("Risk map unavailable for city=%s %s-%s: %s", city, start, end, e)
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        logger.warning("Invalid risk map request for city=%s %s-%s: %s", city, start, end, e)
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
        city_id = resolve_city_id(city)
        old = load_lulc(start, city=city_id)
        new = load_lulc(end, city=city_id)
        matrix = transition_probability_matrix(old, new)
        adjusted = apply_policy_scenario(matrix, scenario)
        simulated = simulate_lulc(new, adjusted, target_year - end)
        logger.info(
            "Generated simulation map for city=%s %s-%s target=%s scenario=%s",
            city_id,
            start,
            end,
            target_year,
            scenario,
        )
        return Response(content=create_lulc_image(simulated), media_type="image/png")
    except HTTPException:
        raise
    except FileNotFoundError as e:
        logger.warning(
            "Simulation map unavailable for city=%s %s-%s target=%s scenario=%s: %s",
            city,
            start,
            end,
            target_year,
            scenario,
            e,
        )
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        logger.warning(
            "Invalid simulation map request for city=%s %s-%s target=%s scenario=%s: %s",
            city,
            start,
            end,
            target_year,
            scenario,
            e,
        )
        raise HTTPException(status_code=400, detail=str(e))

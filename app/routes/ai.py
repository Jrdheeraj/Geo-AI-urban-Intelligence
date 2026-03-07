from fastapi import APIRouter, HTTPException, Query
from functools import lru_cache
import logging

from app.config.cities import resolve_city_id
from app.services.ai_service import (
    apply_policy_scenario,
    compute_risk_masks,
    hotspot_stats,
    insights_engine,
    simulate_lulc,
    transition_probability_matrix,
    urban_growth_hotspot_density,
)
from app.services.analytics_service import area_stats
from app.services.raster_service import load_lulc

router = APIRouter()
logger = logging.getLogger(__name__)


@lru_cache(maxsize=128)
def _cached_simulation_payload(city: str, start_year: int, end_year: int, target_year: int, scenario: str):
    old = load_lulc(start_year, city=city)
    current = load_lulc(end_year, city=city)
    matrix = transition_probability_matrix(old, current)
    adjusted = apply_policy_scenario(matrix, scenario)
    simulated = simulate_lulc(current, adjusted, target_year - end_year)
    return {
        "city": city,
        "scenario": scenario,
        "from_year": end_year,
        "target_year": target_year,
        "transition_probability_matrix": adjusted.round(3).tolist(),
        "stats": area_stats(simulated),
    }


@lru_cache(maxsize=128)
def _cached_risk_payload(city: str, start_year: int, end_year: int):
    old = load_lulc(start_year, city=city)
    new = load_lulc(end_year, city=city)
    high_risk, medium_risk, alerts = compute_risk_masks(old, new)
    return {
        "city": city,
        "period": f"{start_year}-{end_year}",
        "high_risk_pixels": int(high_risk.sum()),
        "medium_risk_pixels": int(medium_risk.sum()),
        "alerts": alerts,
    }


@lru_cache(maxsize=128)
def _cached_hotspot_payload(city: str, start_year: int, end_year: int):
    old = load_lulc(start_year, city=city)
    new = load_lulc(end_year, city=city)
    density = urban_growth_hotspot_density(old, new)
    return {
        "city": city,
        "period": f"{start_year}-{end_year}",
        "statistics": hotspot_stats(density),
    }


@lru_cache(maxsize=128)
def _cached_insights_payload(city: str, start_year: int, end_year: int):
    old = load_lulc(start_year, city=city)
    new = load_lulc(end_year, city=city)
    payload = insights_engine(start_year, end_year, old, new)
    payload["city"] = city
    payload["period"] = f"{start_year}-{end_year}"
    return payload


@router.get("/simulator/{city}/{start_year}/{end_year}/{target_year}")
def urban_planning_simulator(
    city: str,
    start_year: int,
    end_year: int,
    target_year: int,
    scenario: str = Query(default="trend"),
):
    if end_year <= start_year:
        raise HTTPException(status_code=400, detail="end_year must be greater than start_year")
    if target_year <= end_year:
        raise HTTPException(status_code=400, detail="target_year must be greater than end_year")

    try:
        city_id = resolve_city_id(city)
        return _cached_simulation_payload(city_id, start_year, end_year, target_year, scenario)
    except FileNotFoundError as e:
        logger.warning("AI simulation unavailable for city=%s %s-%s target=%s: %s", city, start_year, end_year, target_year, e)
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        logger.warning("Invalid AI simulation request for city=%s %s-%s target=%s: %s", city, start_year, end_year, target_year, e)
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/risk/{city}/{start_year}/{end_year}")
def urban_risk_alerts(city: str, start_year: int, end_year: int):
    if end_year <= start_year:
        raise HTTPException(status_code=400, detail="end_year must be greater than start_year")
    try:
        city_id = resolve_city_id(city)
        return _cached_risk_payload(city_id, start_year, end_year)
    except FileNotFoundError as e:
        logger.warning("AI risk unavailable for city=%s %s-%s: %s", city, start_year, end_year, e)
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        logger.warning("Invalid AI risk request for city=%s %s-%s: %s", city, start_year, end_year, e)
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/hotspots/{city}/{start_year}/{end_year}")
def urban_growth_hotspots(city: str, start_year: int, end_year: int):
    if end_year <= start_year:
        raise HTTPException(status_code=400, detail="end_year must be greater than start_year")
    try:
        city_id = resolve_city_id(city)
        return _cached_hotspot_payload(city_id, start_year, end_year)
    except FileNotFoundError as e:
        logger.warning("AI hotspots unavailable for city=%s %s-%s: %s", city, start_year, end_year, e)
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        logger.warning("Invalid AI hotspots request for city=%s %s-%s: %s", city, start_year, end_year, e)
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/insights/{city}/{start_year}/{end_year}")
def ai_insights(city: str, start_year: int, end_year: int):
    if end_year <= start_year:
        raise HTTPException(status_code=400, detail="end_year must be greater than start_year")
    try:
        city_id = resolve_city_id(city)
        return _cached_insights_payload(city_id, start_year, end_year)
    except FileNotFoundError as e:
        logger.warning("AI insights unavailable for city=%s %s-%s: %s", city, start_year, end_year, e)
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        logger.warning("Invalid AI insights request for city=%s %s-%s: %s", city, start_year, end_year, e)
        raise HTTPException(status_code=400, detail=str(e))

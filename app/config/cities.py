from __future__ import annotations

import logging
from functools import lru_cache
from pathlib import Path

from app.config import DATA_SEARCH_DIRS

logger = logging.getLogger(__name__)

_RASTER_KINDS = ("lulc", "change", "confidence")
_NON_CITY_DIRS = {"raw", "processed", "boundary", "gee_outputs", "__pycache__"}


def normalize_city(city: str) -> str:
    if not isinstance(city, str):
        raise ValueError("City must be provided as text.")
    normalized = city.strip().lower()
    if not normalized:
        raise ValueError("City cannot be empty.")
    return normalized


def _city_display_name(city_id: str) -> str:
    tokens = city_id.replace("_", " ").replace("-", " ").split()
    return " ".join(token.capitalize() for token in tokens) if tokens else city_id


def _has_raster_data(city_dir: Path) -> bool:
    for kind in _RASTER_KINDS:
        kind_dir = city_dir / kind
        if kind_dir.exists() and kind_dir.is_dir() and any(kind_dir.glob("*.tif")):
            return True
    return False


@lru_cache(maxsize=1)
def _discover_cities() -> dict[str, dict[str, str | Path]]:
    detected: dict[str, dict[str, str | Path]] = {}
    scanned_roots: list[str] = []

    for root in DATA_SEARCH_DIRS:
        scanned_roots.append(str(root))
        if not root.exists() or not root.is_dir():
            continue

        for candidate in root.iterdir():
            if not candidate.is_dir():
                continue

            candidate_name = candidate.name.strip()
            candidate_key = candidate_name.lower()
            if candidate_key in _NON_CITY_DIRS:
                continue
            if not _has_raster_data(candidate):
                continue

            if candidate_key not in detected:
                detected[candidate_key] = {
                    "id": candidate_key,
                    "name": _city_display_name(candidate_key),
                    "folder": candidate_name,
                    "path": candidate.resolve(),
                }

    ordered = dict(sorted(detected.items()))
    logger.info("Detected cities: %s", [record["name"] for record in ordered.values()])
    if not ordered:
        logger.warning("No city datasets found. Scanned: %s", scanned_roots)
    return ordered


def list_available_city_options() -> list[dict[str, str]]:
    return [
        {
            "id": str(record["id"]),
            "name": str(record["name"]),
            "folder": str(record["folder"]),
        }
        for record in _discover_cities().values()
    ]


def list_available_cities() -> list[str]:
    return [city["name"] for city in list_available_city_options()]


def resolve_city_id(city: str) -> str:
    city_key = normalize_city(city)
    city_map = _discover_cities()
    if city_key in city_map:
        return city_key

    for key, record in city_map.items():
        if normalize_city(str(record["name"])) == city_key:
            return key

    available = ", ".join(str(record["name"]) for record in city_map.values()) or "none"
    raise ValueError(f"City '{city.strip()}' is not available. Available cities: {available}.")


def resolve_city_folder(city: str) -> str:
    city_key = resolve_city_id(city)
    return str(_discover_cities()[city_key]["folder"])


def resolve_city_path(city: str) -> Path:
    city_key = resolve_city_id(city)
    return Path(_discover_cities()[city_key]["path"])


def invalidate_city_cache() -> None:
    _discover_cities.cache_clear()

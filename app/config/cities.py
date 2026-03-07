from __future__ import annotations

import logging
from functools import lru_cache
from pathlib import Path

from app.config import DATA_DIR

logger = logging.getLogger(__name__)

_NON_CITY_DIRS = {"__pycache__", ".gitkeep"}
_DATASET_DIR_NAMES = ("lulc", "change", "confidence", "ndvi")


class DatasetDirectoryMissingError(RuntimeError):
    """Raised when the configured dataset root is missing."""


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


def _has_city_data(city_dir: Path) -> bool:
    direct_tifs = [*city_dir.glob("*.tif"), *city_dir.glob("*.tiff")]
    if any("lulc" in tif.stem.lower() for tif in direct_tifs):
        return True

    for dataset_dir_name in _DATASET_DIR_NAMES:
        dataset_dir = city_dir / dataset_dir_name
        if dataset_dir.is_dir() and any(dataset_dir.glob("*.tif")):
            return True
    return False


@lru_cache(maxsize=1)
def _discover_cities() -> dict[str, dict[str, str | Path]]:
    if not DATA_DIR.exists() or not DATA_DIR.is_dir():
        logger.warning("Dataset directory missing for city discovery: %s", DATA_DIR)
        return {}

    detected: dict[str, dict[str, str | Path]] = {}
    for candidate in DATA_DIR.iterdir():
        if not candidate.is_dir():
            continue

        candidate_name = candidate.name.strip()
        candidate_key = candidate_name.lower()
        if candidate_key in _NON_CITY_DIRS:
            continue
        if not _has_city_data(candidate):
            continue

        detected[candidate_key] = {
            "id": candidate_key,
            "name": _city_display_name(candidate_key),
            "folder": candidate_name,
            "path": candidate.resolve(),
        }

    ordered = dict(sorted(detected.items(), key=lambda item: item[1]["name"].lower()))
    logger.info("Detected cities: %s", [record["name"] for record in ordered.values()])
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
    # /meta/cities should never crash when folder is missing.
    return [city["name"] for city in list_available_city_options()]


def resolve_city_id(city: str) -> str:
    if not DATA_DIR.exists() or not DATA_DIR.is_dir():
        raise DatasetDirectoryMissingError("Dataset directory missing")

    city_key = normalize_city(city)
    city_map = _discover_cities()
    if city_key in city_map:
        return city_key

    for key, record in city_map.items():
        if normalize_city(str(record["name"])) == city_key:
            return key

    raise FileNotFoundError("City not available")


def resolve_city_folder(city: str) -> str:
    city_key = resolve_city_id(city)
    return str(_discover_cities()[city_key]["folder"])


def resolve_city_path(city: str) -> Path:
    city_key = resolve_city_id(city)
    return Path(_discover_cities()[city_key]["path"])


def city_dataset_file_count(city: str) -> int:
    city_path = resolve_city_path(city)
    return sum(1 for _ in city_path.rglob("*.tif"))


def invalidate_city_cache() -> None:
    _discover_cities.cache_clear()

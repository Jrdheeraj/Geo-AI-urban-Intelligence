from __future__ import annotations

import logging
import re
from functools import lru_cache
from pathlib import Path
from typing import Iterable

import numpy as np
import rasterio

from app.config import DATA_DIR
from app.config.cities import (
    DatasetDirectoryMissingError,
    list_available_city_options,
    resolve_city_id,
    resolve_city_path,
)

logger = logging.getLogger(__name__)

_DATASET_DIR_NAMES = ("lulc", "change", "confidence", "ndvi")
_KIND_TOKENS = {
    "lulc": ("lulc",),
    "change": ("change",),
    "confidence": ("confidence",),
    "ndvi": ("ndvi",),
}


def load_raster(path: Path):
    """Load a single-band raster and return as numpy array and nodata."""
    resolved = path.resolve()
    logger.info("Loading raster: %s", resolved)
    with rasterio.open(resolved) as src:
        return src.read(1), src.nodata


def _assert_dataset_root() -> None:
    if not DATA_DIR.exists() or not DATA_DIR.is_dir():
        raise DatasetDirectoryMissingError("Dataset directory missing")


def list_available_city_ids() -> list[str]:
    return [city["id"] for city in list_available_city_options()]


def _extract_years_from_stem(stem: str) -> list[int]:
    return [int(y) for y in re.findall(r"(19\d{2}|20\d{2})", stem)]


def _all_city_tifs(city: str) -> list[Path]:
    city_id = resolve_city_id(city)
    city_root = resolve_city_path(city_id)

    files: list[Path] = [*city_root.glob("*.tif"), *city_root.glob("*.tiff")]
    for dataset_dir_name in _DATASET_DIR_NAMES:
        dataset_dir = city_root / dataset_dir_name
        if dataset_dir.is_dir():
            files.extend(dataset_dir.glob("*.tif"))
            files.extend(dataset_dir.glob("*.tiff"))

    unique: dict[str, Path] = {}
    for path in files:
        unique[str(path.resolve())] = path.resolve()
    return sorted(unique.values())


def _files_for_kind(city: str, kind: str) -> list[Path]:
    city_id = resolve_city_id(city)
    kind_key = kind.lower()
    tokens = _KIND_TOKENS[kind_key]

    selected: list[Path] = []
    for path in _all_city_tifs(city_id):
        stem = path.stem.lower()
        parent = path.parent.name.lower()
        if parent == kind_key:
            selected.append(path)
            continue

        # If file sits inside a different typed subfolder, skip implicit token matches.
        if parent in _DATASET_DIR_NAMES and parent != kind_key:
            continue

        if kind_key == "lulc":
            # Avoid selecting "LULC_Change_*" or confidence/ndvi files.
            if "lulc" in stem and not any(token in stem for token in ("change", "confidence", "ndvi")):
                selected.append(path)
            continue

        if any(token in stem for token in tokens):
            selected.append(path)
    return sorted(selected)


def _best_match(files: Iterable[Path], required_tokens: list[str]) -> Path | None:
    files = list(files)
    scored = []
    for path in files:
        stem = path.stem.lower()
        if not all(token in stem for token in required_tokens):
            continue
        score = sum(1 for token in ("lulc", "change", "confidence", "ndvi") if token in stem)
        scored.append((score, -len(path.name), path))
    if not scored:
        return None
    return sorted(scored, reverse=True)[0][2]


def available_lulc_years(city: str) -> list[int]:
    city_id = resolve_city_id(city)
    years = set()
    for tif in _files_for_kind(city_id, "lulc"):
        years.update(_extract_years_from_stem(tif.stem))
    return sorted(years)


def available_confidence_years(city: str) -> list[int]:
    city_id = resolve_city_id(city)
    years = set()
    for tif in _files_for_kind(city_id, "confidence"):
        years.update(_extract_years_from_stem(tif.stem))
    return sorted(years)


def available_change_pairs(city: str) -> list[tuple[int, int]]:
    city_id = resolve_city_id(city)
    pairs = set()
    for tif in _files_for_kind(city_id, "change"):
        years = _extract_years_from_stem(tif.stem)
        if len(years) >= 2:
            pairs.add((years[0], years[1]))

    # If no precomputed change rasters exist, derive valid pairs from LULC years.
    if not pairs:
        years = available_lulc_years(city_id)
        for i in range(len(years)):
            for j in range(i + 1, len(years)):
                pairs.add((years[i], years[j]))
    return sorted(pairs)


def resolve_lulc_path(city: str, year: int) -> Path:
    city_id = resolve_city_id(city)
    match = _best_match(_files_for_kind(city_id, "lulc"), [str(year), "lulc"])
    if match is None:
        raise FileNotFoundError("Dataset for year not found")
    return match


def resolve_change_path(city: str, start: int, end: int) -> Path:
    city_id = resolve_city_id(city)
    match = _best_match(_files_for_kind(city_id, "change"), [str(start), str(end), "change"])
    if match is None:
        raise FileNotFoundError("Dataset for year not found")
    return match


def resolve_confidence_path(city: str, year: int) -> Path:
    city_id = resolve_city_id(city)
    match = _best_match(_files_for_kind(city_id, "confidence"), [str(year), "confidence"])
    if match is None:
        raise FileNotFoundError("Dataset for year not found")
    return match


def load_lulc(year: int, city: str | None = None):
    city_id = resolve_city_id(city) if city else resolve_default_city_for_lulc_year(year)
    data, _ = load_raster(resolve_lulc_path(city_id, year))
    return data


def _build_change_from_lulc(city_id: str, start: int, end: int):
    old = load_lulc(start, city=city_id)
    new = load_lulc(end, city=city_id)
    return (old != new).astype(np.uint8)


def load_change(start: int, end: int, city: str | None = None):
    city_id = resolve_city_id(city) if city else resolve_default_city_for_change_pair(start, end)
    try:
        data, _ = load_raster(resolve_change_path(city_id, start, end))
        return data
    except FileNotFoundError:
        logger.warning(
            "Change raster missing for city=%s period=%s-%s; deriving change from LULC rasters.",
            city_id,
            start,
            end,
        )
        return _build_change_from_lulc(city_id, start, end)


def _fallback_confidence_from_lulc(city_id: str, year: int):
    # Safe fallback when no confidence raster exists.
    lulc = load_lulc(year, city=city_id)
    confidence = np.where(np.isfinite(lulc), 85, 0).astype(np.float32)
    return confidence, 0.0


def load_confidence(year: int, city: str | None = None):
    city_id = resolve_city_id(city) if city else resolve_default_city_for_confidence_year(year)
    try:
        return load_raster(resolve_confidence_path(city_id, year))
    except FileNotFoundError:
        logger.warning(
            "Confidence raster missing for city=%s year=%s; using fallback confidence defaults.",
            city_id,
            year,
        )
        return _fallback_confidence_from_lulc(city_id, year)


def _available_years_snapshot(fetcher) -> dict[str, list[int]]:
    snapshot: dict[str, list[int]] = {}
    for city_id in list_available_city_ids():
        try:
            snapshot[city_id] = fetcher(city_id)
        except FileNotFoundError:
            snapshot[city_id] = []
    return snapshot


def _available_pairs_snapshot() -> dict[str, list[str]]:
    snapshot: dict[str, list[str]] = {}
    for city_id in list_available_city_ids():
        try:
            snapshot[city_id] = [f"{s}-{e}" for s, e in available_change_pairs(city_id)]
        except FileNotFoundError:
            snapshot[city_id] = []
    return snapshot


def resolve_default_city() -> str:
    _assert_dataset_root()
    city_ids = list_available_city_ids()
    if not city_ids:
        raise FileNotFoundError("City not available")
    return city_ids[0]


@lru_cache(maxsize=128)
def resolve_default_city_for_lulc_year(year: int) -> str:
    _assert_dataset_root()
    for city_id in list_available_city_ids():
        if year in available_lulc_years(city_id):
            return city_id
    raise FileNotFoundError("Dataset for year not found")


@lru_cache(maxsize=128)
def resolve_default_city_for_change_pair(start: int, end: int) -> str:
    _assert_dataset_root()
    for city_id in list_available_city_ids():
        if (start, end) in available_change_pairs(city_id):
            return city_id
    raise FileNotFoundError("Dataset for year not found")


@lru_cache(maxsize=128)
def resolve_default_city_for_confidence_year(year: int) -> str:
    _assert_dataset_root()
    for city_id in list_available_city_ids():
        if year in available_confidence_years(city_id) or year in available_lulc_years(city_id):
            return city_id
    raise FileNotFoundError("Dataset for year not found")


@lru_cache(maxsize=128)
def resolve_default_city_for_lulc_and_confidence_year(year: int) -> str:
    _assert_dataset_root()
    for city_id in list_available_city_ids():
        if year in available_lulc_years(city_id):
            return city_id
    raise FileNotFoundError("Dataset for year not found")


@lru_cache(maxsize=128)
def resolve_default_city_for_change_and_confidence(start: int, end: int) -> str:
    _assert_dataset_root()
    for city_id in list_available_city_ids():
        if (start, end) in available_change_pairs(city_id) and end in available_lulc_years(city_id):
            return city_id
    raise FileNotFoundError("Dataset for year not found")


def get_city_bounds(city: str) -> list[list[float]]:
    """
    Return bounds in Leaflet format:
    [[south, west], [north, east]]
    """
    city_id = resolve_city_id(city)
    candidates = _all_city_tifs(city_id)
    if not candidates:
        raise FileNotFoundError("Dataset for year not found")

    with rasterio.open(candidates[0]) as src:
        bounds = src.bounds
    return [[bounds.bottom, bounds.left], [bounds.top, bounds.right]]

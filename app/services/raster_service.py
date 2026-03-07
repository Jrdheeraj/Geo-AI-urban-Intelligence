from __future__ import annotations

import logging
import re
from functools import lru_cache
from pathlib import Path
from typing import Iterable

import rasterio

from app.config.cities import (
    list_available_city_options,
    resolve_city_folder,
    resolve_city_id,
    resolve_city_path,
)

logger = logging.getLogger(__name__)


def load_raster(path: Path):
    """Load a single-band raster and return as numpy array and nodata."""
    resolved = path.resolve()
    logger.info("Loading raster: %s", resolved)
    with rasterio.open(resolved) as src:
        return src.read(1), src.nodata


def list_available_city_ids() -> list[str]:
    return [city["id"] for city in list_available_city_options()]


def _city_dir(city: str, kind: str) -> Path:
    city_id = resolve_city_id(city)
    directory = resolve_city_path(city_id) / kind
    if not directory.exists():
        raise FileNotFoundError(
            f"Directory not found for city '{resolve_city_folder(city_id)}' and dataset '{kind}': {directory}"
        )
    return directory


def _tif_files(directory: Path) -> list[Path]:
    return sorted([p for p in directory.glob("*.tif") if p.is_file()])


def _best_match(files: Iterable[Path], required_tokens: list[str]) -> Path | None:
    files = list(files)
    scored = []
    for path in files:
        stem = path.stem.lower()
        if not all(token in stem for token in required_tokens):
            continue
        score = sum(1 for token in ["lulc", "change", "confidence"] if token in stem)
        # Prefer more semantic names, then shorter filename
        scored.append((score, -len(path.name), path))
    if not scored:
        return None
    return sorted(scored, reverse=True)[0][2]


def _extract_years_from_stem(stem: str) -> list[int]:
    return [int(y) for y in re.findall(r"(19\d{2}|20\d{2})", stem)]


def available_lulc_years(city: str) -> list[int]:
    city_id = resolve_city_id(city)
    directory = _city_dir(city_id, "lulc")
    years = set()
    for f in _tif_files(directory):
        years.update(_extract_years_from_stem(f.stem))
    return sorted(years)


def available_confidence_years(city: str) -> list[int]:
    city_id = resolve_city_id(city)
    directory = _city_dir(city_id, "confidence")
    years = set()
    for f in _tif_files(directory):
        years.update(_extract_years_from_stem(f.stem))
    return sorted(years)


def available_change_pairs(city: str) -> list[tuple[int, int]]:
    city_id = resolve_city_id(city)
    directory = _city_dir(city_id, "change")
    pairs = set()
    for f in _tif_files(directory):
        years = _extract_years_from_stem(f.stem)
        if len(years) >= 2:
            pairs.add((years[0], years[1]))
    return sorted(pairs)


def resolve_lulc_path(city: str, year: int) -> Path:
    city_id = resolve_city_id(city)
    directory = _city_dir(city_id, "lulc")
    files = _tif_files(directory)
    match = _best_match(files, [str(year)])
    if match is None:
        raise FileNotFoundError(
            f"LULC data not found for {city_id} {year}. Available years: {available_lulc_years(city_id)}"
        )
    return match


def resolve_change_path(city: str, start: int, end: int) -> Path:
    city_id = resolve_city_id(city)
    directory = _city_dir(city_id, "change")
    files = _tif_files(directory)
    match = _best_match(files, [str(start), str(end)])
    if match is None:
        pairs = [f"{a}-{b}" for a, b in available_change_pairs(city_id)]
        raise FileNotFoundError(
            f"Change data not found for {city_id} {start}-{end}. Available pairs: {pairs}"
        )
    return match


def resolve_confidence_path(city: str, year: int) -> Path:
    city_id = resolve_city_id(city)
    directory = _city_dir(city_id, "confidence")
    files = _tif_files(directory)
    match = _best_match(files, [str(year)])
    if match is None:
        raise FileNotFoundError(
            f"Confidence data not found for {city_id} {year}. Available years: {available_confidence_years(city_id)}"
        )
    return match


def load_lulc(year: int, city: str | None = None):
    city_id = resolve_city_id(city) if city else resolve_default_city_for_lulc_year(year)
    data, _ = load_raster(resolve_lulc_path(city_id, year))
    return data


def load_change(start: int, end: int, city: str | None = None):
    city_id = resolve_city_id(city) if city else resolve_default_city_for_change_pair(start, end)
    data, _ = load_raster(resolve_change_path(city_id, start, end))
    return data


def load_confidence(year: int, city: str | None = None):
    city_id = resolve_city_id(city) if city else resolve_default_city_for_confidence_year(year)
    return load_raster(resolve_confidence_path(city_id, year))


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
    city_ids = list_available_city_ids()
    if not city_ids:
        raise FileNotFoundError("No city datasets were detected under the configured data directory.")
    return city_ids[0]


@lru_cache(maxsize=128)
def resolve_default_city_for_lulc_year(year: int) -> str:
    for city_id in list_available_city_ids():
        if year in available_lulc_years(city_id):
            return city_id
    raise FileNotFoundError(
        f"LULC year {year} is unavailable across all cities. Available LULC years by city: {_available_years_snapshot(available_lulc_years)}"
    )


@lru_cache(maxsize=128)
def resolve_default_city_for_change_pair(start: int, end: int) -> str:
    for city_id in list_available_city_ids():
        if (start, end) in available_change_pairs(city_id):
            return city_id
    raise FileNotFoundError(
        f"Change pair {start}-{end} is unavailable across all cities. Available pairs by city: {_available_pairs_snapshot()}"
    )


@lru_cache(maxsize=128)
def resolve_default_city_for_confidence_year(year: int) -> str:
    for city_id in list_available_city_ids():
        if year in available_confidence_years(city_id):
            return city_id
    raise FileNotFoundError(
        f"Confidence year {year} is unavailable across all cities. Available confidence years by city: {_available_years_snapshot(available_confidence_years)}"
    )


@lru_cache(maxsize=128)
def resolve_default_city_for_lulc_and_confidence_year(year: int) -> str:
    for city_id in list_available_city_ids():
        if year in available_lulc_years(city_id) and year in available_confidence_years(city_id):
            return city_id
    raise FileNotFoundError(
        f"Year {year} is unavailable as a joint LULC+confidence dataset across all cities. "
        f"LULC years: {_available_years_snapshot(available_lulc_years)}; "
        f"confidence years: {_available_years_snapshot(available_confidence_years)}"
    )


@lru_cache(maxsize=128)
def resolve_default_city_for_change_and_confidence(start: int, end: int) -> str:
    for city_id in list_available_city_ids():
        if (start, end) in available_change_pairs(city_id) and end in available_confidence_years(city_id):
            return city_id
    raise FileNotFoundError(
        f"Change pair {start}-{end} with confidence year {end} is unavailable across all cities. "
        f"Change pairs: {_available_pairs_snapshot()}; "
        f"confidence years: {_available_years_snapshot(available_confidence_years)}"
    )


def get_city_bounds(city: str) -> list[list[float]]:
    """
    Return bounds in Leaflet format:
    [[south, west], [north, east]]
    """
    city_id = resolve_city_id(city)
    candidates: list[Path] = []
    for kind in ("lulc", "change", "confidence"):
        try:
            directory = _city_dir(city_id, kind)
            candidates.extend(_tif_files(directory))
        except FileNotFoundError:
            continue

    if not candidates:
        raise FileNotFoundError(f"No GeoTIFF files found for city '{city_id}'.")

    with rasterio.open(candidates[0]) as src:
        bounds = src.bounds
    return [[bounds.bottom, bounds.left], [bounds.top, bounds.right]]

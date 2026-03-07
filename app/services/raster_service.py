from pathlib import Path
import re
from typing import Iterable

import rasterio

from app.config import DATA_DIR
from app.config.cities import resolve_city_folder


def load_raster(path: Path):
    """Load a single-band raster and return as numpy array and nodata."""
    with rasterio.open(path) as src:
        return src.read(1), src.nodata


def _city_dir(city: str, kind: str) -> Path:
    folder = resolve_city_folder(city)
    directory = DATA_DIR / folder / kind
    if not directory.exists():
        raise FileNotFoundError(f"Directory not found: {directory}")
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
    directory = _city_dir(city, "lulc")
    years = set()
    for f in _tif_files(directory):
        years.update(_extract_years_from_stem(f.stem))
    return sorted(years)


def available_confidence_years(city: str) -> list[int]:
    directory = _city_dir(city, "confidence")
    years = set()
    for f in _tif_files(directory):
        years.update(_extract_years_from_stem(f.stem))
    return sorted(years)


def available_change_pairs(city: str) -> list[tuple[int, int]]:
    directory = _city_dir(city, "change")
    pairs = set()
    for f in _tif_files(directory):
        years = _extract_years_from_stem(f.stem)
        if len(years) >= 2:
            pairs.add((years[0], years[1]))
    return sorted(pairs)


def resolve_lulc_path(city: str, year: int) -> Path:
    directory = _city_dir(city, "lulc")
    files = _tif_files(directory)
    match = _best_match(files, [str(year)])
    if match is None:
        raise FileNotFoundError(
            f"LULC data not found for {city} {year}. Available years: {available_lulc_years(city)}"
        )
    return match


def resolve_change_path(city: str, start: int, end: int) -> Path:
    directory = _city_dir(city, "change")
    files = _tif_files(directory)
    match = _best_match(files, [str(start), str(end)])
    if match is None:
        pairs = [f"{a}-{b}" for a, b in available_change_pairs(city)]
        raise FileNotFoundError(
            f"Change data not found for {city} {start}-{end}. Available pairs: {pairs}"
        )
    return match


def resolve_confidence_path(city: str, year: int) -> Path:
    directory = _city_dir(city, "confidence")
    files = _tif_files(directory)
    match = _best_match(files, [str(year)])
    if match is None:
        raise FileNotFoundError(
            f"Confidence data not found for {city} {year}. Available years: {available_confidence_years(city)}"
        )
    return match


def load_lulc(year: int, city: str = "tirupati"):
    data, _ = load_raster(resolve_lulc_path(city, year))
    return data


def load_change(start: int, end: int, city: str = "tirupati"):
    data, _ = load_raster(resolve_change_path(city, start, end))
    return data


def load_confidence(year: int, city: str = "tirupati"):
    return load_raster(resolve_confidence_path(city, year))


def get_city_bounds(city: str) -> list[list[float]]:
    """
    Return bounds in Leaflet format:
    [[south, west], [north, east]]
    """
    candidates = []
    for kind in ("lulc", "change", "confidence"):
        try:
            directory = _city_dir(city, kind)
            candidates.extend(_tif_files(directory))
        except FileNotFoundError:
            continue

    if not candidates:
        raise FileNotFoundError(f"No GeoTIFF files found for city '{city}'.")

    with rasterio.open(candidates[0]) as src:
        bounds = src.bounds
    return [[bounds.bottom, bounds.left], [bounds.top, bounds.right]]

from pathlib import Path
from typing import Dict

from app.config import DATA_DIR

CITIES: Dict[str, dict] = {
    "tirupati": {"folder": "tirupati", "name": "Tirupati"},
    "madanapalle": {"folder": "madanapalle", "name": "Madanapalle"},
}


def normalize_city(city: str) -> str:
    return city.strip().lower()


def resolve_city_folder(city: str) -> str:
    city_key = normalize_city(city)
    if city_key in CITIES:
        return CITIES[city_key]["folder"]

    # Keep the platform scalable: if folder exists in gee_outputs, accept it.
    candidate = DATA_DIR / city_key
    if candidate.exists() and candidate.is_dir():
        return city_key

    raise ValueError(f"Unsupported city '{city}'.")


def list_available_cities() -> list[dict]:
    disk_cities = []
    if DATA_DIR.exists():
        for city_dir in DATA_DIR.iterdir():
            if city_dir.is_dir():
                city_key = city_dir.name.lower()
                city_meta = CITIES.get(city_key, {})
                disk_cities.append(
                    {
                        "id": city_key,
                        "name": city_meta.get("name", city_dir.name.title()),
                        "folder": city_meta.get("folder", city_dir.name),
                    }
                )

    # De-duplicate while preserving order
    seen = set()
    unique = []
    for city in disk_cities:
        if city["id"] not in seen:
            seen.add(city["id"])
            unique.append(city)
    return unique


import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Supports local and production deployments.
# - Default: <repo>/data
# - Override: GEOAI_DATA_DIR=/absolute/or/relative/path
_raw_data_dir = Path(os.getenv("GEOAI_DATA_DIR", "data"))
if not _raw_data_dir.is_absolute():
    _raw_data_dir = BASE_DIR / _raw_data_dir
DATA_DIR = _raw_data_dir.resolve()

# Some datasets are organized as data/<city>/..., others as data/gee_outputs/<city>/...
DATA_SEARCH_DIRS = tuple(dict.fromkeys((DATA_DIR, DATA_DIR / "gee_outputs")))

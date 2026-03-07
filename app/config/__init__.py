import os
from pathlib import Path

# app/config -> app -> project root
BASE_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BASE_DIR.parent

# Default dataset location expected in deployment:
# <project_root>/data/gee_outputs
_default_data_dir = PROJECT_ROOT / "data" / "gee_outputs"
_raw_data_dir = Path(os.getenv("GEOAI_DATA_DIR", str(_default_data_dir)))
if not _raw_data_dir.is_absolute():
    _raw_data_dir = PROJECT_ROOT / _raw_data_dir
DATA_DIR = _raw_data_dir.resolve()

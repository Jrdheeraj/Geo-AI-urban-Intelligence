import logging
import os

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from app.config import DATA_DIR
from app.config.cities import (
    DatasetDirectoryMissingError,
    city_dataset_file_count,
    invalidate_city_cache,
    list_available_city_options,
)
from app.routes import lulc, change, confidence, map, ai, meta, analytics

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger(__name__)


def _parse_cors_origins() -> tuple[list[str], bool]:
    default_origins = [
        "https://geo-ai-urban-intelligence.vercel.app",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
    raw = os.getenv("CORS_ORIGINS", "").strip()
    if not raw:
        return default_origins, True
    origins = [origin.strip() for origin in raw.split(",") if origin.strip()]
    return origins or default_origins, True


cors_origins, cors_allow_credentials = _parse_cors_origins()

app = FastAPI(
    title="GeoAI Smart City Backend",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=cors_allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(DatasetDirectoryMissingError)
async def dataset_directory_missing_handler(request, exc: DatasetDirectoryMissingError):
    logger.error("Dataset directory missing while serving %s: %s", request.url.path, exc)
    return JSONResponse(status_code=500, content={"detail": "Dataset directory missing"})


@app.middleware("http")
async def log_api_errors(request, call_next):
    try:
        response = await call_next(request)
    except Exception:
        logger.exception("Unhandled API exception for %s %s", request.method, request.url.path)
        raise

    if response.status_code >= 400:
        logger.warning("API error %s %s -> %s", request.method, request.url.path, response.status_code)
    return response


@app.on_event("startup")
def verify_dataset_integrity() -> None:
    if not DATA_DIR.exists() or not DATA_DIR.is_dir():
        logger.error("Dataset directory missing: %s", DATA_DIR)
        return

    invalidate_city_cache()
    cities = list_available_city_options()
    if not cities:
        logger.warning("No city datasets detected in: %s", DATA_DIR)
        return

    logger.info("Detected cities: %s", ", ".join(city["name"] for city in cities))
    for city in cities:
        city_id = city["id"]
        logger.info("%s datasets: %d files", city["name"], city_dataset_file_count(city_id))

app.include_router(lulc.router, prefix="/lulc", tags=["LULC"])
app.include_router(change.router, prefix="/change", tags=["Change"])
app.include_router(confidence.router, prefix="/confidence", tags=["Confidence"])
app.include_router(map.router, prefix="/map", tags=["Map Imagery"])
app.include_router(ai.router, prefix="/ai", tags=["AI Intelligence"])
app.include_router(meta.router, prefix="/meta", tags=["Meta"])
app.include_router(analytics.router, prefix="/analytics", tags=["Analytics"])


@app.get("/")
def health():
    logger.info("Health check served")
    return {"status": "Backend running successfully"}

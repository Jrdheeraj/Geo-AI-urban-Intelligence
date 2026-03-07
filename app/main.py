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


app = FastAPI(
    title="GeoAI Smart City Backend",
    version="1.0.0"
)

origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://geo-ai-urban-intelligence.vercel.app",
    "https://geo-ai-urban-intelligence-git-main-dheerajs-projects.vercel.app",
]
# Allow Vercel preview deployments (branch/commit URLs) for this project.
vercel_origin_regex = r"^https://geo-ai-urban-intelligence(?:-[a-z0-9-]+)?\.vercel\.app$"

# Optional extension for additional preview/custom domains.
extra_cors = os.getenv("CORS_ORIGINS", "").strip()
if extra_cors:
    origins.extend(origin.strip() for origin in extra_cors.split(",") if origin.strip())

app.add_middleware(
    CORSMiddleware,
    allow_origins=sorted(set(origins)),
    allow_origin_regex=vercel_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(DatasetDirectoryMissingError)
async def dataset_directory_missing_handler(request, exc: DatasetDirectoryMissingError):
    logger.error("Dataset directory missing while serving %s: %s", request.url.path, exc)
    return JSONResponse(status_code=500, content={"detail": "Dataset directory missing"})


@app.middleware("http")
async def log_api_errors(request, call_next):
    origin = request.headers.get("origin", "-")
    logger.info("Incoming request %s %s origin=%s", request.method, request.url.path, origin)
    try:
        response = await call_next(request)
    except Exception:
        logger.exception("Unhandled API exception for %s %s", request.method, request.url.path)
        raise

    logger.info("Response %s %s -> %s", request.method, request.url.path, response.status_code)
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
    return {"status": "GeoAI backend running"}


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 10000))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port)

import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import lulc, change, confidence, map, ai, meta, analytics

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger(__name__)


def _parse_cors_origins() -> tuple[list[str], bool]:
    raw = os.getenv("CORS_ORIGINS", "*").strip()
    if not raw or raw == "*":
        return ["*"], False
    origins = [origin.strip() for origin in raw.split(",") if origin.strip()]
    return origins or ["*"], bool(origins)


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

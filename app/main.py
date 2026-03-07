from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import lulc, change, confidence, map, ai, meta, analytics

app = FastAPI(
    title="GeoAI Smart City Backend",
    version="1.0.0"
)

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(lulc.router, prefix="/lulc", tags=["LULC"])
app.include_router(change.router, prefix="/change", tags=["Change"])
app.include_router(confidence.router, prefix="/confidence", tags=["Confidence"])
app.include_router(map.router, prefix="/map", tags=["Map Imagery"])
app.include_router(ai.router, prefix="/ai", tags=["AI Intelligence"])
app.include_router(meta.router, prefix="/meta", tags=["Meta"])
app.include_router(analytics.router, prefix="/analytics", tags=["Analytics"])


@app.get("/")
def health():
    return {"status": "Backend running successfully"}

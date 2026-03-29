# GeoAI Urban Growth Monitoring

GeoAI is a full-stack geospatial analytics platform for Land Use / Land Cover (LULC) monitoring, change detection, risk alerts, hotspot analysis, and policy-driven simulation.

It uses raster outputs (GeoTIFF) from your Earth Engine + Random Forest pipeline and serves interactive analytics/maps through a FastAPI backend and React + Leaflet frontend.

## Stack

- Backend: FastAPI, NumPy, Rasterio
- Frontend: React, TypeScript, Vite, Leaflet, Tailwind
- Data: GeoTIFF rasters under `data/gee_outputs`

## Core Features

- Multi-city support (configured + auto-discovered from disk)
- LULC distribution analytics (5 classes)
- Transition matrix analytics across year pairs
- Confidence summaries
- AI risk alerts, hotspots, insights, and simulation
- PNG map overlay endpoints for LULC/change/confidence/hotspot/risk/simulation

## LULC Class Order

Canonical class order used by analytics:

1. Forest
2. Water Bodies
3. Agriculture
4. Barren Land
5. Built-up

The backend analytics module supports both common raster schemas:

- `0..4` (zero-based)
- `1..5` (legacy one-based)

and normalizes internally before computing analytics.

## Repository Structure

```text
.
|-- app/
|   |-- config/            # Backend config (data dir, city mapping)
|   |-- routes/            # FastAPI route modules
|   |-- services/          # Raster + analytics + AI logic
|   `-- main.py            # FastAPI app entrypoint
|-- data/
|   `-- gee_outputs/
|       `-- <city>/
|           |-- lulc/
|           |-- change/
|           `-- confidence/
|-- frontend/
|   |-- src/
|   |-- package.json
|   `-- vite config + test config
`-- requirements.txt
```

## Data Layout Requirements

Expected layout per city:

```text
data/gee_outputs/<city>/lulc/*.tif
data/gee_outputs/<city>/change/*.tif
data/gee_outputs/<city>/confidence/*.tif
```

Year/pair extraction is filename-based (regex for 4-digit years), so filenames should include years (for example `lulc_2025.tif`, `City_LULC_Change_2018_2025.tif`).

## Quick Start

### 1) Backend

From project root:

```bash
python -m venv venv
```

Activate virtual environment:

- Windows PowerShell:

```powershell
.\venv\Scripts\Activate.ps1
```

- macOS/Linux:

```bash
source venv/bin/activate
```

Install and run:

```bash
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8888 --reload
```

Backend URL: `http://localhost:8888`
Swagger docs: `http://localhost:8888/docs`

### 2) Frontend

In a new terminal:

```bash
cd frontend
npm install
```

Create `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:8001
```

Run dev server:

```bash
npm run dev
```

Frontend URL: usually `http://localhost:5173`

## Quality Checks

Frontend:

```bash
cd frontend
npm run lint
npm run test
npm run build
```

Backend (syntax/bytecode check):

```bash
venv\Scripts\python.exe -m compileall app
```

## API Overview

Base URL: `http://localhost:8888`

- Health: `GET /`
- Meta:
  - `GET /meta/cities`
  - `GET /meta/availability/{city}`
- Analytics:
  - `GET /analytics/lulc?city=<id>&year=<y>&start_year=<s>&end_year=<e>`
- LULC:
  - `GET /lulc/{city}/{year}`
- Change:
  - `GET /change/{city}/{start_year}/{end_year}`
- Confidence:
  - `GET /confidence/{city}/{year}`
- AI:
  - `GET /ai/risk/{city}/{start_year}/{end_year}`
  - `GET /ai/hotspots/{city}/{start_year}/{end_year}`
  - `GET /ai/insights/{city}/{start_year}/{end_year}`
  - `GET /ai/simulator/{city}/{start_year}/{end_year}/{target_year}?scenario=trend|agriculture_protection|green_zone_enforcement`
- Map overlays (PNG):
  - `GET /map/lulc/{city}/{year}`
  - `GET /map/change/{city}/{start}/{end}`
  - `GET /map/confidence/{city}/{year}`
  - `GET /map/hotspot/{city}/{start}/{end}`
  - `GET /map/risk/{city}/{start}/{end}`
  - `GET /map/simulation/{city}/{start}/{end}/{target_year}?scenario=...`

## Troubleshooting

- `VITE_API_BASE_URL is not set`:
  - Add `frontend/.env` with `VITE_API_BASE_URL=http://localhost:8888`
- 404 for city/year/pair:
  - Check files under `data/gee_outputs/<city>/...`
  - Ensure filenames contain expected year tokens
- Windows `spawn EPERM` while running tests in restricted shells:
  - Re-run tests in a normal terminal session with standard permissions

## Notes

- Current configured cities: `tirupati`, `madanapalle`
- Additional cities are auto-detected if folder exists under `data/gee_outputs/<city>`

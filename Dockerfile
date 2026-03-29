# Use an official Python runtime as a parent image
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Install system dependencies for Rasterio / Fiona / GDAL
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgdal-dev \
    libproj-dev \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Set the CPLUS_INCLUDE_PATH and C_INCLUDE_PATH for GDAL
ENV CPLUS_INCLUDE_PATH=/usr/include/gdal
ENV C_INCLUDE_PATH=/usr/include/gdal

WORKDIR /app

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY . .

# Expose the port (Render provides this via $PORT env var)
EXPOSE 10000

# Set start command
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000}

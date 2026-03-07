import { useState, useRef, useCallback, useEffect } from "react";
import { MapContainer, TileLayer, ImageOverlay, useMap } from "react-leaflet";
import { api, getMapOverlayUrl } from "@/services/api";
import { Scenario } from "@/types/api";
import "leaflet/dist/leaflet.css";

interface MapComparisonProps {
  city: string;
  startYear: number;
  endYear: number;
  targetYear?: number;
  scenario?: Scenario;
  layer: "lulc" | "change" | "confidence" | "hotspot" | "risk" | "simulation";
  opacity: number;
  bounds: [[number, number], [number, number]];
  center: [number, number];
}

function FitToCityBounds({ bounds }: { bounds: [[number, number], [number, number]] }) {
  const map = useMap();

  useEffect(() => {
    map.fitBounds(bounds);
  }, [map, bounds]);

  return null;
}

export default function MapComparison({
  city,
  startYear,
  endYear,
  targetYear,
  scenario = "trend",
  layer,
  opacity,
  bounds,
  center,
}: MapComparisonProps) {
  const [sliderPos, setSliderPos] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current || !dragging.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pos = ((clientX - rect.left) / rect.width) * 100;
    setSliderPos(Math.max(0, Math.min(100, pos)));
  }, []);

  const startUrl = getMapOverlayUrl(api.maps.lulc(city, startYear));

  const endPath =
    layer === "lulc"
      ? api.maps.lulc(city, endYear)
      : layer === "change"
      ? api.maps.change(city, startYear, endYear)
      : layer === "confidence"
      ? api.maps.confidence(city, endYear)
      : layer === "hotspot"
      ? api.maps.hotspot(city, startYear, endYear)
      : layer === "risk"
      ? api.maps.risk(city, startYear, endYear)
      : api.maps.simulation(city, startYear, endYear, targetYear ?? endYear + 1, scenario);

  const endUrl = getMapOverlayUrl(endPath);
  const normalizedOpacity = Math.max(0, Math.min(1, opacity / 100));

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[500px] md:h-[600px] rounded-2xl overflow-hidden border border-border"
      onMouseMove={(e) => handleMove(e.clientX)}
      onMouseUp={() => { dragging.current = false; }}
      onMouseLeave={() => { dragging.current = false; }}
      onTouchMove={(e) => handleMove(e.touches[0].clientX)}
      onTouchEnd={() => { dragging.current = false; }}
    >
      {/* Left map (start year) */}
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}>
        <MapContainer
          center={center}
          zoom={12}
          className="w-full h-full"
          zoomControl={false}
          attributionControl={false}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <FitToCityBounds bounds={bounds} />
          <ImageOverlay url={startUrl} bounds={bounds} opacity={normalizedOpacity} className="pixel-overlay" />
        </MapContainer>
        <div className="absolute top-4 left-4 z-[1000] bg-card/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-sm font-semibold text-foreground border border-border">
          {startYear}
        </div>
      </div>

      {/* Right map (end year) */}
      <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${sliderPos}%)` }}>
        <MapContainer
          center={center}
          zoom={12}
          className="w-full h-full"
          zoomControl={false}
          attributionControl={false}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <FitToCityBounds bounds={bounds} />
          <ImageOverlay url={endUrl} bounds={bounds} opacity={normalizedOpacity} className="pixel-overlay" />
        </MapContainer>
        <div className="absolute top-4 right-4 z-[1000] bg-card/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-sm font-semibold text-foreground border border-border">
          {endYear}
        </div>
      </div>

      {/* Slider handle */}
      <div
        className="absolute top-0 bottom-0 z-[1001] cursor-col-resize flex items-center"
        style={{ left: `${sliderPos}%`, transform: "translateX(-50%)" }}
        onMouseDown={() => { dragging.current = true; }}
        onTouchStart={() => { dragging.current = true; }}
      >
        <div className="w-1 h-full bg-primary-foreground/80" />
        <div className="absolute top-1/2 -translate-y-1/2 w-10 h-10 bg-card border-2 border-primary rounded-full flex items-center justify-center shadow-lg">
          <span className="text-primary text-xs font-bold">&lt;&gt;</span>
        </div>
      </div>
    </div>
  );
}


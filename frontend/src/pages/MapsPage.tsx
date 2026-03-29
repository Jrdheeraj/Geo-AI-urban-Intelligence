import { useEffect, useMemo, useRef, useState, Suspense, lazy } from "react";
import { motion } from "framer-motion";
import { Download, Eye, Layers, MapPin } from "lucide-react";
import { api } from "@/services/api";
import { resolveInitialCity, saveCity } from "@/lib/cityPreference";
import { getAnalysisCommand, saveAnalysisDraft, subscribeAnalysisCommand } from "@/lib/analysisCommand";
import { CityAvailability, CityOption, Scenario } from "@/types/api";


const MapComparison = lazy(() => import("@/components/maps/MapComparison"));

const layerOptions = [
  { id: "lulc", label: "LULC Map" },
  { id: "change", label: "Change Detection" },
  { id: "confidence", label: "Confidence Heatmap" },
  { id: "hotspot", label: "Hotspots" },
  { id: "risk", label: "Risk Map" },
  { id: "simulation", label: "Simulation" },
] as const;

export default function MapsPage() {
  const [cities, setCities] = useState<CityOption[]>([]);
  const [selectedCity, setSelectedCity] = useState<string>("");
  const [availability, setAvailability] = useState<CityAvailability | null>(null);
  const [startYear, setStartYear] = useState<number>(2018);
  const [endYear, setEndYear] = useState<number>(2024);
  const [targetYear, setTargetYear] = useState<number>(2026);
  const [scenario, setScenario] = useState<Scenario>("trend");
  const [activeLayer, setActiveLayer] = useState<(typeof layerOptions)[number]["id"]>("lulc");
  const [opacity, setOpacity] = useState(70);
  const [error, setError] = useState<string>("");
  const [loadingMeta, setLoadingMeta] = useState(true);
  const isValidSelectedCity = selectedCity && cities.some((c) => c.id === selectedCity);
  const startYearRef = useRef(startYear);
  const endYearRef = useRef(endYear);

  useEffect(() => {
    startYearRef.current = startYear;
    endYearRef.current = endYear;
  }, [startYear, endYear]);

  useEffect(() => {
    const controller = new AbortController();
    setLoadingMeta(true);
    api
      .getCities(controller.signal)
      .then((result) => {
        setCities(result);
        setSelectedCity(resolveInitialCity(result));
      })
      .catch((err: Error) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => setLoadingMeta(false));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (isValidSelectedCity) saveCity(selectedCity);
  }, [isValidSelectedCity, selectedCity]);

  useEffect(() => {
    saveAnalysisDraft({
      city: isValidSelectedCity ? selectedCity : undefined,
      startYear: startYear || undefined,
      endYear: endYear || undefined,
      targetYear: targetYear || undefined,
      scenario,
    });
  }, [isValidSelectedCity, selectedCity, startYear, endYear, targetYear, scenario]);

  useEffect(() => {
    const applyCommand = (command: {
      city: string;
      startYear: number;
      endYear: number;
      targetYear: number;
      scenario: Scenario;
    }) => {
      if (!cities.some((c) => c.id === command.city)) return;
      setSelectedCity(command.city);
      setStartYear(command.startYear);
      setEndYear(command.endYear);
      setTargetYear(command.targetYear);
      setScenario(command.scenario);
    };

    const existing = getAnalysisCommand();
    if (existing) applyCommand(existing);

    return subscribeAnalysisCommand((command) => applyCommand(command));
  }, [cities]);

  useEffect(() => {
    if (!isValidSelectedCity) return;
    const controller = new AbortController();
    setError("");
    setAvailability(null);
    api
      .getAvailability(selectedCity, controller.signal)
      .then((result) => {
        setAvailability(result);
        const hasValidPair = result.change_pairs.some((p) => p.start === startYearRef.current && p.end === endYearRef.current);
        if (!hasValidPair) {
          const pair = result.change_pairs[0];
          if (pair) {
            setStartYear(pair.start);
            setEndYear(pair.end);
            setTargetYear(pair.end + 2);
          } else if (result.lulc_years.length >= 2) {
            setStartYear(result.lulc_years[0]);
            setEndYear(result.lulc_years[result.lulc_years.length - 1]);
            setTargetYear(result.lulc_years[result.lulc_years.length - 1] + 2);
          }
        }
      })
      .catch((err: Error) => {
        if (err.name !== "AbortError") setError(err.message);
      });
    return () => controller.abort();
  }, [isValidSelectedCity, selectedCity]);

  const yearOptions = useMemo(() => availability?.lulc_years ?? [], [availability]);
  const changePairs = useMemo(() => availability?.change_pairs ?? [], [availability]);
  const bounds = useMemo(() => availability?.bounds ?? ([[13.55, 79.35], [13.7, 79.5]] as [[number, number], [number, number]]), [availability]);
  const center = useMemo<[number, number]>(() => {
    const b = bounds;
    return [(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2];
  }, [bounds]);

  const selectPair = (value: string) => {
    const [start, end] = value.split("-").map(Number);
    setStartYear(start);
    setEndYear(end);
    if (targetYear <= end) setTargetYear(end + 2);
  };

  return (
    <section id="maps" className="py-24 border-t border-border">
      <div className="max-w-7xl mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <h1 className="text-3xl font-bold text-foreground mb-2">Map Visualization</h1>
          <p className="text-muted-foreground mb-8">Live overlays from backend rasters and AI map services.</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="glass-card p-5 mb-6"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> City
              </label>
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="w-full bg-muted text-foreground rounded-lg px-3 py-2 text-sm border-0 focus:ring-2 focus:ring-primary outline-none"
                disabled={loadingMeta || cities.length === 0}
              >
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Change Pair</label>
              <select
                value={`${startYear}-${endYear}`}
                onChange={(e) => selectPair(e.target.value)}
                className="w-full bg-muted text-foreground rounded-lg px-3 py-2 text-sm border-0 focus:ring-2 focus:ring-primary outline-none"
                disabled={changePairs.length === 0}
              >
                {changePairs.map((p) => (
                  <option key={`${p.start}-${p.end}`} value={`${p.start}-${p.end}`}>
                    {p.start} - {p.end}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                <Layers className="w-3 h-3" /> Layer
              </label>
              <select
                value={activeLayer}
                onChange={(e) => setActiveLayer(e.target.value as (typeof layerOptions)[number]["id"])}
                className="w-full bg-muted text-foreground rounded-lg px-3 py-2 text-sm border-0 focus:ring-2 focus:ring-primary outline-none"
              >
                {layerOptions.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Target Year</label>
              <select
                value={targetYear}
                onChange={(e) => setTargetYear(Number(e.target.value))}
                className="w-full bg-muted text-foreground rounded-lg px-3 py-2 text-sm border-0 focus:ring-2 focus:ring-primary outline-none"
                disabled={activeLayer !== "simulation"}
              >
                {[...new Set([...yearOptions, endYear + 1, endYear + 2, endYear + 3])].sort().map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Scenario</label>
              <select
                value={scenario}
                onChange={(e) => setScenario(e.target.value as Scenario)}
                className="w-full bg-muted text-foreground rounded-lg px-3 py-2 text-sm border-0 focus:ring-2 focus:ring-primary outline-none"
                disabled={activeLayer !== "simulation"}
              >
                <option value="trend">trend</option>
                <option value="agriculture_protection">agriculture_protection</option>
                <option value="green_zone_enforcement">green_zone_enforcement</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                <Eye className="w-3 h-3" /> Opacity: {opacity}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={opacity}
                onChange={(e) => setOpacity(Number(e.target.value))}
                className="w-full accent-primary mt-1"
              />
            </div>
          </div>
        </motion.div>

        {error && (
          <div className="glass-card p-4 mb-6 text-sm text-red-600 border border-red-200">
            {error}
          </div>
        )}

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
          {isValidSelectedCity ? (
            <Suspense
              fallback={
                <div className="w-full h-[600px] glass-card flex items-center justify-center">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    Loading map...
                  </div>
                </div>
              }
            >
              <MapComparison
                key={`${selectedCity}-${startYear}-${endYear}-${activeLayer}-${targetYear}-${scenario}`}
                city={selectedCity}
                startYear={startYear}
                endYear={endYear}
                targetYear={targetYear}
                scenario={scenario}
                layer={activeLayer}
                opacity={opacity}
                bounds={bounds}
                center={center}
              />
            </Suspense>
          ) : (
            <div className="w-full h-[600px] glass-card flex items-center justify-center text-muted-foreground">Select a valid city to load map layers.</div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="glass-card p-5 mt-6 mb-12"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-sm font-medium text-foreground">Legend:</span>
              {[
                { color: "bg-green-500", label: "Forest" },
                { color: "bg-slate-500", label: "Water Bodies" },
                { color: "bg-yellow-500", label: "Agriculture" },
                { color: "bg-gray-400", label: "Barren Land" },
                { color: "bg-red-500", label: "Built-up" },
              ].map((item) => (
                <span key={item.label} className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <span className={`w-3 h-3 rounded-sm ${item.color}`} />
                  {item.label}
                </span>
              ))}
            </div>
            <button className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
              <Download className="w-4 h-4" />
              Export Map
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

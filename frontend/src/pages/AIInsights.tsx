import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, BarChart3, Lightbulb, MapPin } from "lucide-react";
import { api } from "@/services/api";
import { resolveInitialCity, saveCity } from "@/lib/cityPreference";
import { getAnalysisCommand, saveAnalysisDraft, subscribeAnalysisCommand } from "@/lib/analysisCommand";
import { AIHotspotResponse, AIInsightsResponse, AIRiskResponse, CityAvailability, CityOption } from "@/types/api";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";

export default function InsightsPage() {
  const [cities, setCities] = useState<CityOption[]>([]);
  const [selectedCity, setSelectedCity] = useState("");
  const [availability, setAvailability] = useState<CityAvailability | null>(null);
  const [startYear, setStartYear] = useState(0);
  const [endYear, setEndYear] = useState(0);
  const [risk, setRisk] = useState<AIRiskResponse | null>(null);
  const [hotspots, setHotspots] = useState<AIHotspotResponse | null>(null);
  const [insights, setInsights] = useState<AIInsightsResponse | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [error, setError] = useState("");
  const isValidSelectedCity = selectedCity && cities.some((c) => c.id === selectedCity);
  const startYearRef = useRef(startYear);
  const endYearRef = useRef(endYear);
  const insightsAbortRef = useRef<AbortController | null>(null);
  const lastRunKeyRef = useRef("");

  useEffect(() => {
    startYearRef.current = startYear;
    endYearRef.current = endYear;
  }, [startYear, endYear]);

  useEffect(() => {
    const controller = new AbortController();
    api
      .getCities(controller.signal)
      .then((result) => {
        setCities(result);
        setSelectedCity((prev) => {
          if (prev && result.some((c) => c.id === prev)) return prev;
          return resolveInitialCity(result);
        });
      })
      .catch((err: Error) => {
        if (err.name !== "AbortError") setError(err.message);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (isValidSelectedCity) saveCity(selectedCity);
  }, [isValidSelectedCity, selectedCity]);

  useEffect(() => {
    if (!isValidSelectedCity) {
      setAvailability(null);
      setStartYear(0);
      setEndYear(0);
      return;
    }
    const controller = new AbortController();
    setRisk(null);
    setHotspots(null);
    setInsights(null);
    setAvailability(null);
    lastRunKeyRef.current = "";
    api
      .getAvailability(selectedCity, controller.signal)
      .then((result) => {
        setAvailability(result);
        if (result.change_pairs.length === 0) {
          setStartYear(0);
          setEndYear(0);
          return;
        }
        const currentValid = result.change_pairs.some((p) => p.start === startYearRef.current && p.end === endYearRef.current);
        if (!currentValid) {
          setStartYear(result.change_pairs[0].start);
          setEndYear(result.change_pairs[0].end);
        }
      })
      .catch((err: Error) => {
        if (err.name !== "AbortError") setError(err.message);
      });
    return () => controller.abort();
  }, [isValidSelectedCity, selectedCity]);

  const runInsights = useCallback((city: string, start: number, end: number, options?: { force?: boolean }) => {
    if (!cities.some((c) => c.id === city)) return;
    if (!city || !start || !end || end <= start) return;
    const runKey = `${city}-${start}-${end}`;
    if (!options?.force && runKey === lastRunKeyRef.current) return;
    lastRunKeyRef.current = runKey;
    insightsAbortRef.current?.abort();
    const controller = new AbortController();
    insightsAbortRef.current = controller;
    setError("");
    setLoadingInsights(true);
    Promise.all([
      api.getRisk(city, start, end, controller.signal),
      api.getHotspots(city, start, end, controller.signal),
      api.getInsights(city, start, end, controller.signal),
    ])
      .then(([riskData, hotspotData, insightData]) => {
        setRisk(riskData);
        setHotspots(hotspotData);
        setInsights(insightData);
      })
      .catch((err: Error) => {
        if (err.name === "AbortError") return;
        lastRunKeyRef.current = "";
        setError(err.message);
      })
      .finally(() => {
        if (insightsAbortRef.current === controller) {
          insightsAbortRef.current = null;
          setLoadingInsights(false);
        }
      });
  }, [cities]);

  useEffect(
    () => () => {
      insightsAbortRef.current?.abort();
    },
    []
  );

  useEffect(() => {
    const applyCommand = (command: { city: string; startYear: number; endYear: number }) => {
      if (!cities.some((c) => c.id === command.city)) return;
      if (!command.city || !command.startYear || !command.endYear) return;
      setSelectedCity(command.city);
      setStartYear(command.startYear);
      setEndYear(command.endYear);
      runInsights(command.city, command.startYear, command.endYear, { force: true });
    };

    const existing = getAnalysisCommand();
    if (existing) applyCommand(existing);

    return subscribeAnalysisCommand((command) => applyCommand(command));
  }, [cities, runInsights]);

  useEffect(() => {
    saveAnalysisDraft({
      city: isValidSelectedCity ? selectedCity : undefined,
      startYear: startYear || undefined,
      endYear: endYear || undefined,
    });
  }, [isValidSelectedCity, selectedCity, startYear, endYear]);

  const onPairChange = (value: string) => {
    if (!value) {
      setStartYear(0);
      setEndYear(0);
      return;
    }
    const [s, e] = value.split("-").map(Number);
    if (!Number.isFinite(s) || !Number.isFinite(e)) {
      setStartYear(0);
      setEndYear(0);
      return;
    }
    setStartYear(s);
    setEndYear(e);
  };

  const hasSelectedPair = useMemo(
    () => (availability?.change_pairs ?? []).some((p) => p.start === startYear && p.end === endYear),
    [availability, startYear, endYear]
  );

  useEffect(() => {
    if (!isValidSelectedCity || !hasSelectedPair || !startYear || !endYear || endYear <= startYear) return;
    runInsights(selectedCity, startYear, endYear);
  }, [isValidSelectedCity, hasSelectedPair, selectedCity, startYear, endYear, runInsights]);

  const hotspotData = useMemo(
    () =>
      hotspots
        ? [
            { label: "High Density", value: hotspots.statistics.high_pixels, color: "bg-red-500" },
            { label: "Medium Density", value: hotspots.statistics.medium_pixels, color: "bg-yellow-500" },
            { label: "Stable Regions", value: hotspots.statistics.stable_pixels, color: "bg-green-500" },
          ]
        : [],
    [hotspots]
  );

  const maxHotspot = Math.max(...hotspotData.map((d) => d.value), 1);
  const hotspotTotal = hotspotData.reduce((sum, item) => sum + item.value, 0);

  return (
    <>
      <Navbar />
      <main className="pt-24 pb-0 min-h-screen">
      <div className="max-w-6xl mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">AI Insights & Risk Assessment</h1>
          <p className="text-muted-foreground">Live model outputs for risk, hotspots, and recommendations.</p>
        </motion.div>

        <div className="glass-card p-5 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> City
              </label>
              <select value={selectedCity} onChange={(e) => setSelectedCity(e.target.value)} className="bg-muted text-foreground rounded-lg px-3 py-2 text-sm border-0 outline-none w-full">
                <option value="">Select city</option>
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
                value={startYear && endYear ? `${startYear}-${endYear}` : ""}
                onChange={(e) => onPairChange(e.target.value)}
                className="bg-muted text-foreground rounded-lg px-3 py-2 text-sm border-0 outline-none w-full"
                disabled={(availability?.change_pairs?.length ?? 0) === 0}
              >
                <option value="">Select pair</option>
                {(availability?.change_pairs ?? []).map((p) => (
                  <option key={`${p.start}-${p.end}`} value={`${p.start}-${p.end}`}>
                    {p.start} - {p.end}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Selected Window</label>
              <div className="bg-muted text-foreground rounded-lg px-3 py-2 text-sm">{startYear && endYear ? `${startYear} - ${endYear}` : "No pair selected"}</div>
            </div>
          </div>
        </div>

        {error && <div className="glass-card p-4 mb-6 text-sm text-red-600 border border-red-200">{error}</div>}

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" /> Urban Risk Alerts
          </h2>
          <div className="space-y-3">
            {loadingInsights && <div className="glass-card p-5 text-sm text-muted-foreground">Running risk analysis...</div>}
            {!loadingInsights && risk && risk.alerts.length === 0 && <div className="glass-card p-5 text-sm text-muted-foreground">No urban risk alerts detected for this window.</div>}
            {!loadingInsights && !risk && <div className="glass-card p-5 text-sm text-muted-foreground">Select a city and change pair to load risk alerts.</div>}
            {(risk?.alerts ?? []).map((alert, i) => (
              <div key={i} className="glass-card p-5 border-l-4 border-l-destructive">
                <p className="text-sm text-foreground">{alert}</p>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card p-6 mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" /> Hotspot Analysis
          </h2>
          {loadingInsights && <p className="text-xs text-muted-foreground mb-4">Running hotspot analysis...</p>}
          {!loadingInsights && !hotspots && <p className="text-xs text-muted-foreground mb-4">Select a city and change pair to load hotspot metrics.</p>}
          {hotspotData.length > 0 && hotspotTotal === 0 && (
            <p className="text-xs text-muted-foreground mb-4">
              No urban-change hotspots detected for the selected city and time window.
            </p>
          )}
          <div className="grid grid-cols-3 gap-4">
            {hotspotData.map((h) => (
              <div key={h.label} className="text-center">
                <div className="w-full h-3 rounded-full bg-muted mb-3 overflow-hidden">
                  <div className={`h-full ${h.color} rounded-full`} style={{ width: `${(h.value / maxHotspot) * 100}%` }} />
                </div>
                <p className="text-2xl font-bold text-foreground">{h.value.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">{h.label}</p>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card p-6 mb-12">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-foreground" /> AI Recommendations
          </h2>
          <div className="space-y-3">
            {loadingInsights && <div className="p-3 rounded-xl bg-muted text-sm text-muted-foreground">Generating recommendations...</div>}
            {!loadingInsights && !insights && <div className="p-3 rounded-xl bg-muted text-sm text-muted-foreground">Select a city and change pair to load AI recommendations.</div>}
            {(insights?.recommendations ?? []).map((r, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-muted">
                <span className="shrink-0 w-6 h-6 bg-primary/10 text-primary rounded-full flex items-center justify-center text-xs font-bold">
                  {i + 1}
                </span>
                <p className="text-sm text-foreground">{r}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
      <Footer />
    </main>
    </>
  );
}

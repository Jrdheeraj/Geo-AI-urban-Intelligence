import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { BarChart3, Download, MapPin, Play } from "lucide-react";
import { api } from "@/services/api";
import { saveAnalysisDraft, triggerAnalysis } from "@/lib/analysisCommand";
import { ChangeResponse, CityAvailability, CityOption, LULCAnalyticsResponse, LULC_COLORS } from "@/types/api";
import Footer from "@/components/Footer";

const classes = ["Forest", "Water Bodies", "Agriculture", "Barren Land", "Built-up"];
const ANALYTICS_SESSION_KEY = "geoai_analytics_state";

type AnalyticsSessionState = {
  city: string;
  year: number;
  startYear: number;
  endYear: number;
  analytics: LULCAnalyticsResponse;
  change: ChangeResponse;
};

export default function AnalyticsPage() {
  const [cities, setCities] = useState<CityOption[]>([]);
  const [selectedCity, setSelectedCity] = useState("");
  const [availability, setAvailability] = useState<CityAvailability | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [startYear, setStartYear] = useState<number | null>(null);
  const [endYear, setEndYear] = useState<number | null>(null);
  const [analytics, setAnalytics] = useState<LULCAnalyticsResponse | null>(null);
  const [change, setChange] = useState<ChangeResponse | null>(null);
  const [error, setError] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hasRestored, setHasRestored] = useState(false);
  const isValidSelectedCity = selectedCity && cities.some((c) => c.id === selectedCity);

  const clearResults = () => {
    setAnalytics(null);
    setChange(null);
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(ANALYTICS_SESSION_KEY);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const raw = window.sessionStorage.getItem(ANALYTICS_SESSION_KEY);
      if (raw) {
        try {
          const saved = JSON.parse(raw) as Partial<AnalyticsSessionState>;
          if (typeof saved.city === "string") setSelectedCity(saved.city);
          if (typeof saved.year === "number") setYear(saved.year);
          if (typeof saved.startYear === "number") setStartYear(saved.startYear);
          if (typeof saved.endYear === "number") setEndYear(saved.endYear);
          if (saved.analytics) setAnalytics(saved.analytics as LULCAnalyticsResponse);
          if (saved.change) setChange(saved.change as ChangeResponse);
        } catch {
          // Ignore corrupted session data.
        }
      }
    }
    setHasRestored(true);
  }, []);

  useEffect(() => {
    if (!hasRestored) return;
    const controller = new AbortController();
    api
      .getCities(controller.signal)
      .then((result) => {
        setCities(result);
        if (selectedCity && !result.some((c) => c.id === selectedCity)) {
          setSelectedCity("");
          setYear(null);
          setStartYear(null);
          setEndYear(null);
          clearResults();
        }
      })
      .catch((err: Error) => {
        if (err.name !== "AbortError") setError(err.message);
      });
    return () => controller.abort();
  }, [hasRestored, selectedCity]);

  useEffect(() => {
    if (!isValidSelectedCity) {
      setAvailability(null);
      return;
    }
    const controller = new AbortController();
    setError("");
    api
      .getAvailability(selectedCity, controller.signal)
      .then((result) => {
        setAvailability(result);
        const years = result.lulc_years;
        if (years.length === 0) {
          setYear(null);
          setStartYear(null);
          setEndYear(null);
          return;
        }

        const pair = result.change_pairs[0];
        const defaultStart = pair?.start ?? years[0];
        const defaultEnd = pair?.end ?? years[years.length - 1];
        const defaultYear = years[years.length - 1];

        setYear((prev) => (prev !== null && years.includes(prev) ? prev : defaultYear));
        setStartYear((prev) => (prev !== null && years.includes(prev) ? prev : defaultStart));
        setEndYear((prev) => (prev !== null && years.includes(prev) ? prev : defaultEnd));
      })
      .catch((err: Error) => {
        if (err.name !== "AbortError") setError(err.message);
      });
    return () => controller.abort();
  }, [isValidSelectedCity, selectedCity]);

  const runAnalysis = async () => {
    if (!selectedCity || !year || !startYear || !endYear) {
      setError("Select a city and all years before starting analysis.");
      return;
    }
    if (endYear <= startYear) {
      setError("End year must be greater than start year.");
      return;
    }

    triggerAnalysis({
      city: selectedCity,
      year,
      startYear,
      endYear,
      targetYear: endYear + 2,
      scenario: "trend",
      runAt: Date.now(),
    });

    setError("");
    setIsAnalyzing(true);
    try {
      const [analyticsResult, changeResult] = await Promise.all([
        api.getLULCAnalytics(selectedCity, year, startYear, endYear),
        api.getChangeDetection(selectedCity, startYear, endYear),
      ]);
      setAnalytics(analyticsResult);
      setChange(changeResult);
      // Warm up other modules so Insights/Simulation open faster for the same run command.
      void Promise.allSettled([
        api.getRisk(selectedCity, startYear, endYear),
        api.getHotspots(selectedCity, startYear, endYear),
        api.getInsights(selectedCity, startYear, endYear),
        api.getSimulation(selectedCity, startYear, endYear, endYear + 2, "trend"),
      ]);
      if (typeof window !== "undefined") {
        const payload: AnalyticsSessionState = { city: selectedCity, year, startYear, endYear, analytics: analyticsResult, change: changeResult };
        window.sessionStorage.setItem(ANALYTICS_SESSION_KEY, JSON.stringify(payload));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Analysis failed.";
      setError(message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const lulcByClass = useMemo(() => {
    return {
      Forest: analytics?.distribution.forest ?? 0,
      "Water Bodies": analytics?.distribution.water ?? 0,
      Agriculture: analytics?.distribution.agriculture ?? 0,
      "Barren Land": analytics?.distribution.barren ?? 0,
      "Built-up": analytics?.distribution.builtup ?? 0,
    };
  }, [analytics]);

  const onStartYearChange = (newStartYear: number) => {
    setStartYear(newStartYear);
    clearResults();
    if (endYear <= newStartYear) {
      const nextEnd = (availability?.lulc_years ?? []).find((y) => y > newStartYear) ?? null;
      setEndYear(nextEnd);
    }
  };

  const exportCsv = () => {
    if (!change) return;
    const lines = ["from_class,to_class,area_ha"];
    for (const row of change.breakdown ?? []) {
      lines.push(`${row.from_class},${row.to_class},${row.area_ha}`);
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics_${selectedCity}_${startYear}_${endYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const yearOptions = availability?.lulc_years ?? [];
  const canRun = Boolean(isValidSelectedCity && year && startYear && endYear && endYear > startYear);
  const hasResults = Boolean(analytics);

  useEffect(() => {
    saveAnalysisDraft({
      city: isValidSelectedCity ? selectedCity : undefined,
      year: year ?? undefined,
      startYear: startYear ?? undefined,
      endYear: endYear ?? undefined,
      targetYear: endYear ? endYear + 2 : undefined,
      scenario: "trend",
    });
  }, [isValidSelectedCity, selectedCity, year, startYear, endYear]);

  return (
    <main className="pt-24 pb-0 min-h-screen">
      <div className="max-w-7xl mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Analytics Dashboard</h1>
          <p className="text-muted-foreground">Live LULC and transition analytics from backend rasters.</p>
        </motion.div>

        <div className="glass-card p-5 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> City
              </label>
              <select
                value={selectedCity}
                onChange={(e) => {
                  setSelectedCity(e.target.value);
                  setYear(null);
                  setStartYear(null);
                  setEndYear(null);
                  clearResults();
                }}
                className="w-full bg-muted text-foreground rounded-lg px-3 py-2 text-sm border-0 outline-none"
              >
                <option value="">Select city</option>
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Year</label>
              <select
                value={year ?? ""}
                onChange={(e) => {
                  setYear(e.target.value ? Number(e.target.value) : null);
                  clearResults();
                }}
                className="w-full bg-muted text-foreground rounded-lg px-3 py-2 text-sm border-0 outline-none"
              >
                <option value="">Select year</option>
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Start Year</label>
              <select
                value={startYear ?? ""}
                onChange={(e) => {
                  if (!e.target.value) {
                    setStartYear(null);
                    clearResults();
                    return;
                  }
                  onStartYearChange(Number(e.target.value));
                }}
                className="w-full bg-muted text-foreground rounded-lg px-3 py-2 text-sm border-0 outline-none"
              >
                <option value="">Select start</option>
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">End Year</label>
              <select
                value={endYear ?? ""}
                onChange={(e) => {
                  setEndYear(e.target.value ? Number(e.target.value) : null);
                  clearResults();
                }}
                className="w-full bg-muted text-foreground rounded-lg px-3 py-2 text-sm border-0 outline-none"
              >
                <option value="">Select end</option>
                {yearOptions
                  .filter((y) => (startYear ? y > startYear : true))
                  .map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={runAnalysis}
                disabled={!canRun || isAnalyzing}
                className="w-full flex items-center justify-center gap-1 bg-cta text-cta-foreground px-3 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
              >
                <Play className="w-4 h-4" />
                {isAnalyzing ? "Analyzing..." : "Start Analysis"}
              </button>
            </div>
            <div className="flex items-end">
              <button
                onClick={exportCsv}
                disabled={!hasResults}
                className="w-full flex items-center justify-center gap-1 bg-cta text-cta-foreground px-3 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            </div>
          </div>
          {!canRun && yearOptions.length > 0 && (
            <p className="text-xs text-muted-foreground mt-3">Choose city, year, and valid timeline (end year greater than start year).</p>
          )}
          {!selectedCity && <p className="text-xs text-muted-foreground mt-3">Select a city to load available years.</p>}
          {selectedCity && yearOptions.length === 0 && <p className="text-xs text-muted-foreground mt-3">No year data available for this city.</p>}
        </div>

        {error && <div className="glass-card p-4 mb-6 text-sm text-red-600 border border-red-200">{error}</div>}

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className={`glass-card p-6 mb-6 ${hasResults ? "" : "bg-black text-white"}`}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <BarChart3 className={`w-5 h-5 ${hasResults ? "text-primary" : "text-white"}`} />
              <h2 className={`text-lg font-semibold ${hasResults ? "text-foreground" : "text-white"}`}>
                LULC Distribution - {hasResults ? analytics?.year : "Waiting"}
              </h2>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {classes.map((cls) => (
              <div key={cls} className={`text-center p-4 rounded-xl ${hasResults ? "bg-muted" : "bg-black border border-zinc-700"}`}>
                <div className="w-4 h-4 rounded-full mx-auto mb-2" style={{ backgroundColor: LULC_COLORS[cls] }} />
                <p className={`text-2xl font-bold ${hasResults ? "text-foreground" : "text-white"}`}>{hasResults ? `${(lulcByClass[cls] ?? 0).toFixed(1)}%` : "--"}</p>
                <p className={`text-xs mt-1 ${hasResults ? "text-muted-foreground" : "text-zinc-300"}`}>{cls}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 flex rounded-full overflow-hidden h-4">
            {classes.map((cls) => (
              <div key={cls} style={{ width: `${lulcByClass[cls] ?? 0}%`, backgroundColor: LULC_COLORS[cls] }} className="transition-all duration-500" />
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className={`glass-card p-6 mb-12 ${hasResults ? "" : "bg-black text-white"}`}>
          <h2 className={`text-lg font-semibold mb-4 ${hasResults ? "text-foreground" : "text-white"}`}>
            Transition Matrix ({hasResults ? `${analytics?.start_year} - ${analytics?.end_year}` : "Waiting"})
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">From \ To</th>
                  {classes.map((c) => (
                    <th key={c} className="py-2 px-3 text-muted-foreground font-medium text-center text-xs">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {classes.map((rowClass, ri) => (
                  <tr key={rowClass} className="border-t border-border">
                    <td className="py-2.5 px-3 font-medium text-foreground text-sm">{rowClass}</td>
                    {(analytics?.transition_matrix?.[ri] ?? [0, 0, 0, 0, 0]).map((val, ci) => (
                      <td key={ci} className="py-2.5 px-3 text-center text-foreground text-sm rounded bg-muted/40">
                        {Number(val).toFixed(1)}%
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
      <Footer />
    </main>
  );
}

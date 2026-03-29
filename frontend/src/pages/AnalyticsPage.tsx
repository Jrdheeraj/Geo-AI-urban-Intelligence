import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { BarChart3, Download, FileText, MapPin, Play } from "lucide-react";
import { api } from "@/services/api";
import { getAnalysisCommand, saveAnalysisDraft, subscribeAnalysisCommand, triggerAnalysis } from "@/lib/analysisCommand";
import { generateDetailedReport, ReportData } from "@/lib/reportGenerator";
import { ChangeResponse, CityAvailability, CityOption, LULCAnalyticsResponse, LULC_COLORS } from "@/types/api";
import { cn } from "@/lib/utils";


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
    // Session restoration disabled per user request for clean start on refresh.
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

  const [isDownloadingReport, setIsDownloadingReport] = useState(false);

  const handleDownloadReport = async () => {
    if (!analytics || !change || !selectedCity) return;
    setIsDownloadingReport(true);
    try {
      const cityName = cities.find((c) => c.id === selectedCity)?.name || selectedCity;
      const fileName = `GeoAI_Report_${cityName}_${year}.pdf`;
      const { generateMultiPagePdf } = await import("@/lib/pdfReport");
      
      // IDs of the sections to capture as separate pages
      const sections = ["report-page-1", "report-page-2", "report-page-3"];
      await generateMultiPagePdf(sections, fileName);
    } catch (err) {
      console.error("PDF Error:", err);
      setError("Failed to generate PDF report.");
    } finally {
      setIsDownloadingReport(false);
    }
  };

  const runAnalysis = async (
    city = selectedCity,
    y = year,
    start = startYear,
    end = endYear
  ) => {
    if (!city || !y || !start || !end) {
      setError("Select a city and all years before starting analysis.");
      return;
    }
    if (end <= start) {
      setError("End year must be greater than start year.");
      return;
    }

    // We no longer triggerAnalysis here to avoid infinite event feedback loops.
    // triggerAnalysis is now handled directly by the UI trigger (button click).

    setError("");
    setIsAnalyzing(true);
    try {
      const [analyticsResult, changeResult] = await Promise.all([
        api.getLULCAnalytics(city, y, start, end),
        api.getChangeDetection(city, start, end),
      ]);
      setAnalytics(analyticsResult);
      setChange(changeResult);
      // Warm up other modules so Insights/Simulation open faster for the same run command.
      void Promise.allSettled([
        api.getRisk(city, start, end),
        api.getHotspots(city, start, end),
        api.getInsights(city, start, end),
        api.getSimulation(city, start, end, end + 2, "trend"),
      ]);
      if (typeof window !== "undefined") {
        const payload: AnalyticsSessionState = { city, year: y, startYear: start, endYear: end, analytics: analyticsResult, change: changeResult };
        window.sessionStorage.setItem(ANALYTICS_SESSION_KEY, JSON.stringify(payload));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Analysis failed.";
      setError(message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    const applyCommand = (command: {
      city: string;
      year: number;
      startYear: number;
      endYear: number;
    }, shouldRun: boolean) => {
      if (!cities.some((c) => c.id === command.city)) return;
      setSelectedCity(command.city);
      setYear(command.year);
      setStartYear(command.startYear);
      setEndYear(command.endYear);
      if (shouldRun) {
        void runAnalysis(command.city, command.year, command.startYear, command.endYear);
      }
    };

    return subscribeAnalysisCommand((command) => {
      // On live subscription, we DO run
      applyCommand(command, true);
    });
  }, [cities]); // Removed analytics to prevent re-subscribing on every result

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
    <section id="analytics" className="py-24 border-t border-border">
      <div className="print:hidden">
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
                onClick={() => {
                  if (canRun) {
                    // Manual trigger: broadcast to other components/tabs
                    triggerAnalysis({
                      city: selectedCity,
                      year: year!,
                      startYear: startYear!,
                      endYear: endYear!,
                      targetYear: endYear! + 2,
                      scenario: "trend",
                      runAt: Date.now(),
                    });
                    void runAnalysis();
                  }
                }}
                disabled={!canRun || isAnalyzing}
                className="w-full flex items-center justify-center gap-1 bg-cta text-cta-foreground px-3 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
              >
                <Play className="w-4 h-4" />
                {isAnalyzing ? "Analyzing..." : "Start Analysis"}
              </button>
            </div>
            <div className="flex items-end">
              <button
                onClick={handleDownloadReport}
                disabled={!hasResults || isDownloadingReport}
                className="w-full flex items-center justify-center gap-1 bg-cta text-cta-foreground px-3 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
              >
                <FileText className={cn("w-4 h-4", isDownloadingReport && "animate-pulse")} />
                {isDownloadingReport ? "Generating..." : "Download Report"}
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
    </div>

    {/* MULTI-PAGE HIGH FIDELITY REPORT */}
    <div className="absolute -left-[9999px] top-0 space-y-20">
      
      {/* PAGE 1: DISTRIBUTION */}
      <div id="report-page-1" className="bg-white p-16 border-[12px] border-slate-900 w-[1100px] min-h-[1400px]">
        <header className="flex justify-between items-start border-b-8 border-slate-900 pb-12 mb-16">
          <div>
            <h1 className="text-7xl font-black uppercase tracking-tighter leading-none mb-2">GeoAI-urban-intellegence</h1>
            <p className="text-2xl font-black text-slate-400 uppercase tracking-[0.3em]">Intelligence Report • Vol I</p>
          </div>
          <div className="text-right text-lg font-bold space-y-1">
            <p>City: {cities.find(c => c.id === selectedCity)?.name}</p>
            <p>Period: {startYear} - {endYear}</p>
            <p>Analysis Year: {year}</p>
          </div>
        </header>

        <section className="mb-20">
          <h2 className="text-4xl font-black uppercase mb-10 tracking-tight text-slate-900 border-l-8 border-slate-900 pl-6">1. LULC Distribution</h2>
          <div className="relative">
            <div className="space-y-6 max-w-2xl">
              {["Forest", "Water Bodies", "Agriculture", "Barren Land", "Built-up"].map((label) => {
                const key = label === "Built-up" ? "builtup" : label.toLowerCase().split(' ')[0];
                const val = (analytics?.distribution as any)?.[key] || 0;
                const displayVal = (val > 1) ? val : (val * 100);
                
                return (
                  <div key={label} className="flex items-center gap-6">
                    <span className="w-32 text-sm font-black uppercase text-slate-500">{label}</span>
                    <div className="flex-1 h-6 bg-slate-100 relative">
                      <div className="h-full bg-slate-900" style={{ width: `${displayVal}%` }} />
                      <span className="absolute right-[-70px] top-0 font-black text-xl">{displayVal.toFixed(1)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="absolute top-0 right-0 w-96 bg-slate-50 border border-slate-200 p-8 shadow-xl mt-[-20px] rounded-2xl">
              <h3 className="text-sm font-black uppercase mb-4 text-slate-400">Analysis Insight</h3>
              <p className="text-sm text-slate-600 leading-relaxed font-medium">
                Current data for {year} shows that the urban footprint accounts for 
                {((analytics?.distribution.builtup || 0) > 1 ? (analytics?.distribution.builtup || 0) : (analytics?.distribution.builtup || 0) * 100).toFixed(1)}% 
                of the total land area in {cities.find(c => c.id === selectedCity)?.name}.
              </p>
            </div>
          </div>
        </section>
        
        <footer className="mt-auto pt-10 border-t border-slate-100 text-center opacity-30">
          <p className="text-[10px] font-black uppercase tracking-[1em]">GeoAI-urban-intellegence • PAGE 01</p>
        </footer>
      </div>

      {/* PAGE 2: TRANSITION */}
      <div id="report-page-2" className="bg-white p-16 border-[12px] border-slate-900 w-[1100px] min-h-[1400px]">
        <h2 className="text-4xl font-black uppercase mb-12 tracking-tight text-slate-900 border-l-8 border-slate-900 pl-6">2. Transition Matrix</h2>
        <div className="border-4 border-slate-900 overflow-hidden rounded-2xl mb-12">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white">
                <th className="p-6 text-left text-xs font-black uppercase tracking-widest">From \ To</th>
                {["Forest", "Water Bodies", "Agri", "Barren", "Built"].map(c => (
                  <th key={c} className="p-6 text-center text-xs font-black uppercase tracking-widest">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(analytics?.transition_matrix || []).map((row, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                  <td className="p-6 text-xs font-black uppercase border-r border-slate-100 bg-slate-50">{["Forest", "Water", "Agri", "Barren", "Built"][i]}</td>
                  {row.map((val, j) => (
                    <td key={j} className="p-6 text-center text-xs font-bold border-r border-slate-100">{(val * 100).toFixed(1)}%</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="bg-slate-900 text-white p-10 rounded-3xl">
          <h3 className="text-xl font-black uppercase mb-4 tracking-wider">Matrix Interpretation</h3>
          <p className="text-slate-400 text-sm leading-relaxed">
            The values represented here are percentage conversions between land classes. High values in the diagonal 
            represent stability, while off-diagonal peaks indicate major land use transitions typically driven by 
            infrastructure expansion or environmental shifts.
          </p>
        </div>

        <footer className="mt-auto pt-10 border-t border-slate-100 text-center opacity-30">
          <p className="text-[10px] font-black uppercase tracking-[1em]">GeoAI-urban-intellegence • PAGE 02</p>
        </footer>
      </div>

      {/* PAGE 3: OUTLOOK */}
      <div id="report-page-3" className="bg-white p-16 border-[12px] border-slate-900 w-[1100px] min-h-[1400px]">
        <h2 className="text-4xl font-black uppercase mb-12 tracking-tight text-slate-900 border-l-8 border-slate-900 pl-6">3. Strategic Outlook</h2>
        <div className="p-16 border-[8px] border-slate-900 rounded-[3rem] bg-white mb-16 shadow-2xl">
          <p className="text-3xl font-black leading-tight mb-10 italic text-slate-800">
            "Spatial patterns suggest an acceleration in built-up density. Urban planning must prioritize 
            permeable surfaces to mitigate heat-island effects in upcoming quarters."
          </p>
          <div className="grid grid-cols-2 gap-12 text-sm font-black uppercase tracking-[0.2em] text-slate-300 border-t-4 border-slate-100 pt-10">
            <div className="flex justify-between"><span>Confidence</span><span className="text-slate-900">High Precision</span></div>
            <div className="flex justify-between"><span>Model Type</span><span className="text-slate-900">Geospatial AI</span></div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8">
          <div className="p-10 border-4 border-slate-100 rounded-3xl">
            <h4 className="font-black uppercase mb-4 text-slate-900">Policy Recommendation</h4>
            <p className="text-sm text-slate-500 leading-relaxed">Implement mandatory green-roofing for all new commercial built-up areas exceeding 500sqm.</p>
          </div>
          <div className="p-10 border-4 border-slate-100 rounded-3xl">
            <h4 className="font-black uppercase mb-4 text-slate-900">Conservation focus</h4>
            <p className="text-sm text-slate-500 leading-relaxed">Protect the existing water bodies as they show {((analytics?.distribution.water || 0) * 100).toFixed(1)}% stability.</p>
          </div>
        </div>

        <footer className="mt-auto pt-10 border-t border-slate-100 text-center opacity-30">
          <p className="text-[10px] font-black uppercase tracking-[1em]">GeoAI-urban-intellegence • PAGE 03</p>
        </footer>
      </div>

    </div>
    </section>
  );
}

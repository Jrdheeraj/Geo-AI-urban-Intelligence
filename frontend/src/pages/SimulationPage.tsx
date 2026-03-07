import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { MapPin, Play, Shield, TrendingUp, TreePine } from "lucide-react";
import { api } from "@/services/api";
import { resolveInitialCity, saveCity } from "@/lib/cityPreference";
import { getAnalysisCommand, saveAnalysisDraft, subscribeAnalysisCommand } from "@/lib/analysisCommand";
import { AISimulatorResponse, CityAvailability, CityOption, LULC_COLORS, Scenario } from "@/types/api";
import Footer from "@/components/Footer";

const scenarioOptions: Array<{ id: Scenario; label: string; icon: typeof TrendingUp; desc: string }> = [
  { id: "trend", label: "Trend-based", icon: TrendingUp, desc: "Continue current growth patterns" },
  { id: "agriculture_protection", label: "Agri Protection", icon: TreePine, desc: "Restrict farmland conversion" },
  { id: "green_zone_enforcement", label: "Green Zone", icon: Shield, desc: "Enforce ecological buffers" },
];

export default function SimulationPage() {
  const [cities, setCities] = useState<CityOption[]>([]);
  const [selectedCity, setSelectedCity] = useState("");
  const [availability, setAvailability] = useState<CityAvailability | null>(null);
  const [startYear, setStartYear] = useState(0);
  const [endYear, setEndYear] = useState(0);
  const [targetYear, setTargetYear] = useState(0);
  const [scenario, setScenario] = useState<Scenario>("trend");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AISimulatorResponse | null>(null);
  const [error, setError] = useState("");
  const isValidSelectedCity = selectedCity && cities.some((c) => c.id === selectedCity);

  useEffect(() => {
    const controller = new AbortController();
    api
      .getCities(controller.signal)
      .then((data) => {
        setCities(data);
        setSelectedCity(resolveInitialCity(data));
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
    saveAnalysisDraft({
      city: selectedCity || undefined,
      startYear: startYear || undefined,
      endYear: endYear || undefined,
      targetYear: targetYear || undefined,
      scenario,
    });
  }, [selectedCity, startYear, endYear, targetYear, scenario]);

  useEffect(() => {
    if (!isValidSelectedCity) {
      setAvailability(null);
      setStartYear(0);
      setEndYear(0);
      setTargetYear(0);
      return;
    }
    const controller = new AbortController();
    setResult(null);
    setAvailability(null);
    api
      .getAvailability(selectedCity, controller.signal)
      .then((data) => {
        setAvailability(data);
        if (data.change_pairs.length > 0) {
          const pair = data.change_pairs[0];
          setStartYear(pair.start);
          setEndYear(pair.end);
          setTargetYear(pair.end + 2);
        }
      })
      .catch((err: Error) => {
        if (err.name !== "AbortError") setError(err.message);
      });
    return () => controller.abort();
  }, [isValidSelectedCity, selectedCity]);

  const onPairChange = (value: string) => {
    const [s, e] = value.split("-").map(Number);
    setStartYear(s);
    setEndYear(e);
    if (targetYear <= e) setTargetYear(e + 2);
  };

  const runSimulation = useCallback(
    async (
      city = selectedCity,
      start = startYear,
      end = endYear,
      target = targetYear,
      selectedScenario = scenario
    ) => {
      if (!city || !start || !end || !target) return;
      setRunning(true);
      setError("");
      try {
        const data = await api.getSimulation(city, start, end, target, selectedScenario);
        setResult(data);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setRunning(false);
      }
    },
    [selectedCity, startYear, endYear, targetYear, scenario]
  );

  useEffect(() => {
    const applyCommand = (command: {
      city: string;
      startYear: number;
      endYear: number;
      targetYear: number;
      scenario: Scenario;
    }) => {
      if (!cities.some((c) => c.id === command.city)) return;
      if (!command.city || !command.startYear || !command.endYear || !command.targetYear) return;
      setSelectedCity(command.city);
      setStartYear(command.startYear);
      setEndYear(command.endYear);
      setTargetYear(command.targetYear);
      setScenario(command.scenario);
      void runSimulation(command.city, command.startYear, command.endYear, command.targetYear, command.scenario);
    };

    const existing = getAnalysisCommand();
    if (existing) applyCommand(existing);

    return subscribeAnalysisCommand((command) => applyCommand(command));
  }, [cities, runSimulation]);

  const projected = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of result?.stats.stats ?? []) map[item.class_name] = item.percentage;
    return map;
  }, [result]);

  const canRunSimulation = Boolean(selectedCity && startYear && endYear && targetYear && targetYear > endYear && endYear > startYear);

  return (
    <main className="pt-24 pb-0 min-h-screen">
      <div className="max-w-6xl mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Urban Growth Simulation</h1>
          <p className="text-muted-foreground">Run backend simulation models under policy scenarios.</p>
        </motion.div>

        <div className="glass-card p-5 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> City
              </label>
              <select value={selectedCity || ""} onChange={(e) => setSelectedCity(e.target.value)} className="w-full bg-muted text-foreground rounded-lg px-3 py-2 text-sm border-0 outline-none">
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
              <select value={`${startYear}-${endYear}`} onChange={(e) => onPairChange(e.target.value)} className="w-full bg-muted text-foreground rounded-lg px-3 py-2 text-sm border-0 outline-none">
                {(availability?.change_pairs ?? []).map((p) => (
                  <option key={`${p.start}-${p.end}`} value={`${p.start}-${p.end}`}>
                    {p.start} - {p.end}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Selected Window</label>
              <div className="w-full bg-muted text-foreground rounded-lg px-3 py-2 text-sm">{startYear && endYear ? `${startYear} - ${endYear}` : "No pair selected"}</div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Target Year</label>
              <select value={targetYear} onChange={(e) => setTargetYear(Number(e.target.value))} className="w-full bg-muted text-foreground rounded-lg px-3 py-2 text-sm border-0 outline-none">
                {[endYear + 1, endYear + 2, endYear + 3, endYear + 5].filter((v) => v > endYear).map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button onClick={() => void runSimulation()} disabled={running || !canRunSimulation} className="w-full bg-cta text-cta-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2">
                {running ? <div className="w-4 h-4 border-2 border-cta-foreground border-t-transparent rounded-full animate-spin" /> : <Play className="w-4 h-4" />}
                {running ? "Running..." : "Run Simulation"}
              </button>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mb-6">
          {scenarioOptions.map((s) => (
            <button
              key={s.id}
              onClick={() => setScenario(s.id)}
              className={`glass-card p-5 text-left transition-all duration-200 ${scenario === s.id ? "ring-2 ring-primary" : "hover:shadow-lg"}`}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${scenario === s.id ? "bg-primary/20" : "bg-muted"}`}>
                  <s.icon className={`w-4 h-4 ${scenario === s.id ? "text-primary" : "text-muted-foreground"}`} />
                </div>
                <span className="font-semibold text-foreground text-sm">{s.label}</span>
              </div>
              <p className="text-xs text-muted-foreground">{s.desc}</p>
            </button>
          ))}
        </div>

        {error && <div className="glass-card p-4 mb-6 text-sm text-red-600 border border-red-200">{error}</div>}

        {result && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 mb-12">
            <h2 className="text-lg font-semibold text-foreground mb-6">Projected LULC Distribution - {result.target_year}</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              {Object.entries(projected).map(([cls, val]) => (
                <div key={cls} className="text-center p-4 rounded-xl bg-muted">
                  <div className="w-4 h-4 rounded-full mx-auto mb-2" style={{ backgroundColor: LULC_COLORS[cls] }} />
                  <p className="text-2xl font-bold text-foreground">{val.toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground mt-1">{cls}</p>
                </div>
              ))}
            </div>
            <div className="flex rounded-full overflow-hidden h-4">
              {Object.entries(projected).map(([cls, val]) => (
                <div key={cls} style={{ width: `${val}%`, backgroundColor: LULC_COLORS[cls] }} className="transition-all duration-500" />
              ))}
            </div>
          </motion.div>
        )}
      </div>
      <Footer />
    </main>
  );
}

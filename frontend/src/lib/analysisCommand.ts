import { Scenario } from "@/types/api";

const ANALYSIS_DRAFT_KEY = "geoai_analysis_draft";
const ANALYSIS_COMMAND_KEY = "geoai_analysis_command";
const ANALYSIS_EVENT = "geoai-analysis-command";

export type AnalysisDraft = {
  city?: string;
  year?: number;
  startYear?: number;
  endYear?: number;
  targetYear?: number;
  scenario?: Scenario;
};

export type AnalysisCommand = {
  city: string;
  year: number;
  startYear: number;
  endYear: number;
  targetYear: number;
  scenario: Scenario;
  runAt: number;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isScenario(value: unknown): value is Scenario {
  return value === "trend" || value === "agriculture_protection" || value === "green_zone_enforcement";
}

function normalizeCity(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.toLowerCase() === "[object object]") return undefined;
  return trimmed;
}

function normalizeDraft(value: unknown): AnalysisDraft {
  const raw = (value ?? {}) as Partial<AnalysisDraft>;
  return {
    city: normalizeCity(raw.city),
    year: isFiniteNumber(raw.year) ? raw.year : undefined,
    startYear: isFiniteNumber(raw.startYear) ? raw.startYear : undefined,
    endYear: isFiniteNumber(raw.endYear) ? raw.endYear : undefined,
    targetYear: isFiniteNumber(raw.targetYear) ? raw.targetYear : undefined,
    scenario: isScenario(raw.scenario) ? raw.scenario : undefined,
  };
}

function normalizeCommand(value: unknown): AnalysisCommand | null {
  const raw = (value ?? {}) as Partial<AnalysisCommand>;
  const draft = getAnalysisDraft();
  const city = normalizeCity(raw.city) ?? normalizeCity(draft.city);
  const startYear = isFiniteNumber(raw.startYear) ? raw.startYear : draft.startYear;
  const endYear = isFiniteNumber(raw.endYear) ? raw.endYear : draft.endYear;
  const year = isFiniteNumber(raw.year) ? raw.year : draft.year ?? endYear;
  const targetYear = isFiniteNumber(raw.targetYear) ? raw.targetYear : draft.targetYear ?? ((endYear ?? 0) + 2);
  const scenario = isScenario(raw.scenario) ? raw.scenario : draft.scenario ?? "trend";
  const runAt = isFiniteNumber(raw.runAt) ? raw.runAt : 0;

  if (!city || !startYear || !endYear || !year || !targetYear) return null;
  if (endYear <= startYear || targetYear <= endYear) return null;

  return { city, year, startYear, endYear, targetYear, scenario, runAt };
}

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function getAnalysisDraft(): AnalysisDraft {
  return normalizeDraft(readJson<AnalysisDraft>(ANALYSIS_DRAFT_KEY));
}

export function saveAnalysisDraft(partial: AnalysisDraft): AnalysisDraft {
  const next = normalizeDraft({ ...getAnalysisDraft(), ...partial });
  writeJson(ANALYSIS_DRAFT_KEY, next);
  return next;
}

export function getAnalysisCommand(): AnalysisCommand | null {
  return normalizeCommand(readJson<AnalysisCommand>(ANALYSIS_COMMAND_KEY));
}

export function triggerAnalysis(command: AnalysisCommand): void {
  writeJson(ANALYSIS_COMMAND_KEY, command);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<AnalysisCommand>(ANALYSIS_EVENT, { detail: command }));
  }
}

export function triggerAnalysisFromDraft(): AnalysisCommand | null {
  const draft = getAnalysisDraft();
  if (!draft.city || !draft.startYear || !draft.endYear || draft.endYear <= draft.startYear) return null;

  const command: AnalysisCommand = {
    city: draft.city,
    year: draft.year ?? draft.endYear,
    startYear: draft.startYear,
    endYear: draft.endYear,
    targetYear: draft.targetYear ?? draft.endYear + 2,
    scenario: draft.scenario ?? "trend",
    runAt: Date.now(),
  };
  triggerAnalysis(command);
  return command;
}

export function subscribeAnalysisCommand(callback: (command: AnalysisCommand) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (event: Event) => callback((event as CustomEvent<AnalysisCommand>).detail);
  window.addEventListener(ANALYSIS_EVENT, handler);
  return () => window.removeEventListener(ANALYSIS_EVENT, handler);
}

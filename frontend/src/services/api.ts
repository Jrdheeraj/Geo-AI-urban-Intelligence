import {
  AIHotspotResponse,
  AIInsightsResponse,
  AIRiskResponse,
  AISimulatorResponse,
  ChangeResponse,
  CityAvailability,
  CityOption,
  ConfidenceSummaryResponse,
  LULCAnalyticsResponse,
  LULCResponse,
  Scenario,
} from "@/types/api";
import { API_BASE_URL } from "@/config/api";

const API_BASE = API_BASE_URL.trim().replace(/\/$/, "");
const CACHE_TTL_MS = 120000;
const responseCache = new Map<string, { expires: number; data: unknown }>();
const inflight = new Map<string, Promise<unknown>>();

function cityPath(city: unknown): string {
  if (typeof city !== "string") throw new Error("Invalid city selection.");
  const normalized = city.trim();
  if (!normalized || normalized.toLowerCase() === "[object object]") {
    throw new Error("Invalid city selection.");
  }
  return encodeURIComponent(normalized);
}

function isAbortLikeError(error: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true;
  if (error instanceof DOMException && error.name === "AbortError") return true;
  if (error instanceof Error) {
    if (error.name === "AbortError") return true;
    const message = error.message.toLowerCase();
    if (message.includes("signal is aborted") || message.includes("operation was aborted")) return true;
  }
  return false;
}

function createAbortError(): Error {
  const error = new Error("Request aborted.");
  error.name = "AbortError";
  return error;
}

async function fetchApi<T>(endpoint: string, signal?: AbortSignal): Promise<T> {
  if (!API_BASE) {
    throw new Error("VITE_API_URL is not set. Configure frontend/.env with your backend URL.");
  }

  const cacheKey = `${API_BASE}${endpoint}`;
  const now = Date.now();
  const cached = responseCache.get(cacheKey);
  if (cached && cached.expires > now) {
    return cached.data as T;
  }

  const pending = inflight.get(cacheKey);
  if (pending) {
    return (await pending) as T;
  }

  let response: Response;
  const requestPromise = (async () => {
    response = await fetch(`${API_BASE}${endpoint}`, { signal });
    if (!response.ok) {
      throw response;
    }
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.includes("application/json")) {
      throw new Error(`Invalid response from backend at ${API_BASE}. Expected JSON.`);
    }
    return response.json();
  })();

  inflight.set(cacheKey, requestPromise);
  try {
    const body = (await requestPromise) as T;
    responseCache.set(cacheKey, { expires: now + CACHE_TTL_MS, data: body });
    inflight.delete(cacheKey);
    return body;
  } catch (error) {
    inflight.delete(cacheKey);
    if (isAbortLikeError(error, signal)) {
      throw createAbortError();
    }
    if (error instanceof Response) {
      let detail = `API error: ${error.status}`;
      try {
        const body = await error.json();
        if (body?.detail) detail = body.detail;
      } catch {
        // Ignore non-json error bodies.
      }
      throw new Error(detail);
    }
    if (error instanceof Error) {
      throw new Error(`Cannot reach backend at ${API_BASE}. ${error.message}`);
    }
    throw new Error(`Cannot reach backend at ${API_BASE}.`);
  }
}

export function getMapOverlayUrl(path: string): string {
  return `${API_BASE}${path}`;
}

export const api = {
  getCities: async (signal?: AbortSignal): Promise<CityOption[]> => {
    const response = await fetchApi<{ cities: CityOption[] }>("/meta/cities", signal);
    return response.cities ?? [];
  },

  getAvailability: (city: string, signal?: AbortSignal): Promise<CityAvailability> =>
    fetchApi<CityAvailability>(`/meta/availability/${cityPath(city)}`, signal),

  getLULC: (city: string, year: number, signal?: AbortSignal): Promise<LULCResponse> =>
    fetchApi<LULCResponse>(`/lulc/${cityPath(city)}/${year}`, signal),

  getLULCAnalytics: (
    city: string,
    year: number,
    start: number,
    end: number,
    signal?: AbortSignal
  ): Promise<LULCAnalyticsResponse> =>
    fetchApi<LULCAnalyticsResponse>(
      `/analytics/lulc?city=${cityPath(city)}&year=${year}&start_year=${start}&end_year=${end}&ts=${Date.now()}`,
      signal
    ),

  getChangeDetection: (city: string, start: number, end: number, signal?: AbortSignal): Promise<ChangeResponse> =>
    fetchApi<ChangeResponse>(`/change/${cityPath(city)}/${start}/${end}`, signal),

  getConfidence: (city: string, year: number, signal?: AbortSignal): Promise<ConfidenceSummaryResponse> =>
    fetchApi<ConfidenceSummaryResponse>(`/confidence/${cityPath(city)}/${year}`, signal),

  getInsights: (city: string, start: number, end: number, signal?: AbortSignal): Promise<AIInsightsResponse> =>
    fetchApi<AIInsightsResponse>(`/ai/insights/${cityPath(city)}/${start}/${end}`, signal),

  getRisk: (city: string, start: number, end: number, signal?: AbortSignal): Promise<AIRiskResponse> =>
    fetchApi<AIRiskResponse>(`/ai/risk/${cityPath(city)}/${start}/${end}`, signal),

  getHotspots: (city: string, start: number, end: number, signal?: AbortSignal): Promise<AIHotspotResponse> =>
    fetchApi<AIHotspotResponse>(`/ai/hotspots/${cityPath(city)}/${start}/${end}`, signal),

  getSimulation: (
    city: string,
    start: number,
    end: number,
    target: number,
    scenario: Scenario,
    signal?: AbortSignal
  ): Promise<AISimulatorResponse> =>
    fetchApi<AISimulatorResponse>(
      `/ai/simulator/${cityPath(city)}/${start}/${end}/${target}?scenario=${encodeURIComponent(scenario)}`,
      signal
    ),

  maps: {
    lulc: (city: string, year: number) => `/map/lulc/${cityPath(city)}/${year}`,
    change: (city: string, start: number, end: number) => `/map/change/${cityPath(city)}/${start}/${end}`,
    confidence: (city: string, year: number) => `/map/confidence/${cityPath(city)}/${year}`,
    hotspot: (city: string, start: number, end: number) => `/map/hotspot/${cityPath(city)}/${start}/${end}`,
    risk: (city: string, start: number, end: number) => `/map/risk/${cityPath(city)}/${start}/${end}`,
    simulation: (city: string, start: number, end: number, target: number, scenario: Scenario) =>
      `/map/simulation/${cityPath(city)}/${start}/${end}/${target}?scenario=${encodeURIComponent(scenario)}`,
    bounds: (city: string, signal?: AbortSignal) => fetchApi<{ city: string; bounds: [[number, number], [number, number]] }>(`/map/bounds/${cityPath(city)}`, signal),
  },
};

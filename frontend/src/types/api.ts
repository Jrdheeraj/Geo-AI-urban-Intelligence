export interface CityOption {
  id: string;
  name: string;
  folder: string;
}

export interface CityAvailability {
  city: string;
  lulc_years: number[];
  confidence_years: number[];
  change_pairs: Array<{ start: number; end: number }>;
  bounds: [[number, number], [number, number]];
}

export interface LULCStat {
  class_name: string;
  area_ha: number;
  percentage: number;
}

export interface LULCResponse {
  total_area_ha: number;
  stats: LULCStat[];
}

export interface ChangeBreakdown {
  from_class: string;
  to_class: string;
  area_ha: number;
}

export interface ChangeResponse {
  matrix_area: number[][];
  matrix_percentage: number[][];
  breakdown: ChangeBreakdown[];
}

export interface LULCAnalyticsResponse {
  city: string;
  year: number;
  start_year: number;
  end_year: number;
  distribution: {
    forest: number;
    water: number;
    agriculture: number;
    barren: number;
    builtup: number;
  };
  transition_matrix: number[][];
}

export interface ConfidenceSummaryResponse {
  year: number;
  city: string;
  min: number;
  max: number;
  mean: number;
  median: number;
  valid_pixels: number;
  total_pixels: number;
  coverage_percent: number;
}

export interface AIInsightsResponse {
  city: string;
  period: string;
  insights: string[];
  recommendations: string[];
}

export interface AIRiskResponse {
  city: string;
  period: string;
  high_risk_pixels: number;
  medium_risk_pixels: number;
  alerts: string[];
}

export interface AIHotspotResponse {
  city: string;
  period: string;
  statistics: {
    high_pixels: number;
    medium_pixels: number;
    stable_pixels: number;
    coverage_pixels: number;
  };
}

export interface AISimulatorResponse {
  city: string;
  scenario: string;
  from_year: number;
  target_year: number;
  transition_probability_matrix: number[][];
  stats: LULCResponse;
}

export type Scenario = "trend" | "agriculture_protection" | "green_zone_enforcement";

export const LULC_CLASSES = ["Forest", "Water Bodies", "Agriculture", "Barren Land", "Built-up"] as const;

export const LULC_COLORS: Record<string, string> = {
  Forest: "#22c55e",
  "Water Bodies": "#64748b",
  Agriculture: "#eab308",
  "Barren Land": "#a3a3a3",
  "Built-up": "#ef4444",
};
export interface ReportData {
  city: string;
  cityName: string;
  year: number;
  startYear: number;
  endYear: number;
  analytics: LULCAnalyticsResponse;
  change: ChangeResponse;
  risk?: AIRiskResponse;
  insights?: AIInsightsResponse;
}

import { CityOption } from "@/types/api";

const CITY_STORAGE_KEY = "geoai_selected_city";

export function getSavedCity(): string {
  if (typeof window === "undefined") return "";
  const value = window.localStorage.getItem(CITY_STORAGE_KEY) ?? "";
  if (value.toLowerCase() === "[object object]") return "";
  return value;
}

export function saveCity(city: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CITY_STORAGE_KEY, city);
}

export function resolveInitialCity(cities: CityOption[]): string {
  if (cities.length === 0) return "";
  const saved = getSavedCity();
  if (saved && cities.some((c) => c.id === saved)) return saved;
  return cities[0].id;
}

// Bike-map layer contracts (inventory for #202).
//
// This module fixes the vocabulary every later bike-map task (#203-#209)
// must use. It introduces no map behavior and no network calls: only the
// toggle/data-state model, the "unknown is not absent" rule, and the
// vetted source metadata. The prose inventory lives in
// docs/bike-map-inventory.md.

export type BikeMapLayerId =
  | "cycling-infrastructure"
  | "surface"
  | "services"
  | "weather"
  | "reports";

export type LayerDataState =
  | "idle"
  | "loading"
  | "ready"
  | "empty"
  | "error"
  | "disabled";

export interface BikeMapLayerState {
  id: BikeMapLayerId;
  enabled: boolean;
  data: LayerDataState;
  /** Human-readable reason for empty/error/disabled; null when ready/loading. */
  notice: string | null;
}

export interface BikeMapSourceInfo {
  id: string;
  label: string;
  /** Short attribution string shown next to the layer legend. */
  attribution: string;
  license: string;
  /** How fresh the data can be expected to be (documented, not probed). */
  freshness: string;
  /** Quota / fair-use / cost note relevant for client-side use. */
  limits: string;
}

/**
 * Core honesty rule for every layer: a missing value means "unknown",
 * never "there is no infrastructure here". UI copy must use this wording.
 */
export const UNKNOWN_MEANS_UNKNOWN =
  "Unknown data must not be presented as absence of infrastructure." as const;

export const DEFAULT_LAYER_STATE: Record<BikeMapLayerId, BikeMapLayerState> = {
  "cycling-infrastructure": {
    id: "cycling-infrastructure",
    enabled: false,
    data: "idle",
    notice: null,
  },
  surface: {id: "surface", enabled: false, data: "idle", notice: null},
  services: {id: "services", enabled: false, data: "idle", notice: null},
  weather: {id: "weather", enabled: false, data: "idle", notice: null},
  reports: {id: "reports", enabled: false, data: "idle", notice: null},
};

export const LAYER_SOURCES: Record<BikeMapLayerId, BikeMapSourceInfo> = {
  "cycling-infrastructure": {
    id: "osm-overpass",
    label: "OpenStreetMap (Overpass API)",
    attribution: "© OpenStreetMap contributors",
    license: "ODbL — attribution required, share-alike for the database",
    freshness: "Community-edited; minutes to days depending on the area",
    limits: "Public fair-use instance; one bbox query per route bbox, debounced",
  },
  surface: {
    id: "osm-overpass",
    label: "OpenStreetMap (Overpass API)",
    attribution: "© OpenStreetMap contributors",
    license: "ODbL — attribution required, share-alike for the database",
    freshness: "Community-edited; surface tags are sparse outside cities",
    limits: "Public fair-use instance; one bbox query per route bbox, debounced",
  },
  services: {
    id: "osm-overpass",
    label: "OpenStreetMap (Overpass API)",
    attribution: "© OpenStreetMap contributors",
    license: "ODbL — attribution required, share-alike for the database",
    freshness: "Community-edited; opening hours may be stale",
    limits: "Public fair-use instance; category queries debounced on map move",
  },
  weather: {
    id: "open-meteo",
    label: "Open-Meteo (candidate, not connected)",
    attribution: "Weather data by Open-Meteo.com",
    license: "CC-BY 4.0 — attribution required",
    freshness: "Forecast models updated several times per day; show timestamp",
    limits: "Free non-commercial use, no key; cache per route, never block routing",
  },
  reports: {
    id: "ezda-db",
    label: "Ezda community reports (own database)",
    attribution: "Reported by Ezda cyclists",
    license: "User content; moderation and expiry policy required (#208)",
    freshness: "Time-boxed by expiresAt; stale reports auto-expire",
    limits: "Server-validated, rate-limited; no new table is created by #202",
  },
};

/** MVP source choice for #203 (infrastructure + surface). */
export const MVP_INFRA_SOURCE_ID = "osm-overpass" as const;

export function createLayerState(
  id: BikeMapLayerId,
  partial: Partial<Omit<BikeMapLayerState, "id">> = {},
): BikeMapLayerState {
  return {...DEFAULT_LAYER_STATE[id], ...partial};
}

/** A layer needs user-facing notice exactly when it is not usable. */
export function layerNeedsNotice(state: BikeMapLayerState): boolean {
  return (
    state.data === "empty" ||
    state.data === "error" ||
    state.data === "disabled"
  );
}

/** Legend copy must explain types without implying protection/safety. */
export function legendFor(id: BikeMapLayerId): string[] {
  switch (id) {
    case "cycling-infrastructure":
      return [
        "Cycleway / cycle track (where tagged)",
        "Cycle lane (where tagged)",
        "Bicycle-friendly road section (where tagged)",
        "Unknown — no statement about protection or safety",
      ];
    case "surface":
      return [
        "Asphalt (where tagged)",
        "Unpaved: gravel / ground / grass (where tagged)",
        "Paved other: paving stones / sett (where tagged)",
        "Unknown surface — not shown as paved or unpaved",
      ];
    case "services":
      return [
        "Repair / shop (only fields confirmed by the source)",
        "Parking / rental (only fields confirmed by the source)",
        "Water / toilets / rest (separate toggles, where tagged)",
      ];
    case "weather":
      return [
        "Temperature, precipitation, wind speed and direction",
        "Always with forecast time, units and source",
      ];
    case "reports":
      return [
        "Fresh reports",
        "Confirmed reports",
        "Expired reports are hidden automatically",
      ];
  }
}

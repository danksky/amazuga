import type maplibregl from "maplibre-gl";

const ROAD_CASING_LAYERS = [
  "tunnel-motorway-link-casing",
  "tunnel-secondary-tertiary-casing",
  "tunnel-trunk-primary-casing",
  "tunnel-motorway-casing",
  "highway-motorway-link-casing",
  "highway-link-casing",
  "highway-secondary-tertiary-casing",
  "highway-primary-casing",
  "highway-trunk-casing",
  "highway-motorway-casing",
  "bridge-motorway-link-casing",
  "bridge-secondary-tertiary-casing",
  "bridge-trunk-primary-casing",
  "bridge-motorway-casing",
] as const;

const MAJOR_ROAD_LAYERS = [
  "tunnel-motorway-link",
  "tunnel-secondary-tertiary",
  "tunnel-trunk-primary",
  "tunnel-motorway",
  "highway-motorway-link",
  "highway-link",
  "highway-secondary-tertiary",
  "highway-primary",
  "highway-trunk",
  "highway-motorway",
  "bridge-motorway-link",
  "bridge-secondary-tertiary",
  "bridge-trunk-primary",
  "bridge-motorway",
] as const;

export function applyAmazugaBasemapPalette(map: maplibregl.Map) {
  map.setPaintProperty("background", "background-color", "#fafbfc");
  map.setPaintProperty("landuse-residential", "fill-color", "rgba(226, 232, 240, 0.22)");
  map.setPaintProperty("landuse-suburb", "fill-color", "rgba(226, 232, 240, 0.16)");
  map.setPaintProperty("landuse-railway", "fill-color", "rgba(226, 232, 240, 0.2)");
  map.setPaintProperty("road_area_pier", "fill-color", "#fafbfc");
  map.setPaintProperty("road_pier", "line-color", "#fafbfc");
  map.setPaintProperty("building", "fill-color", "#e5e7eb");
  map.setPaintProperty("building-top", "fill-color", "#eceff3");

  for (const layerId of ROAD_CASING_LAYERS) {
    map.setPaintProperty(layerId, "line-color", "#ddcda7");
  }
  for (const layerId of MAJOR_ROAD_LAYERS) {
    map.setPaintProperty(layerId, "line-color", "#f5edc9");
  }
}

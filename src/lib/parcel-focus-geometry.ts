import type { Feature, FeatureCollection, GeoJsonProperties, MultiPolygon, Polygon } from "geojson";

import { PMTiles } from "pmtiles";
import type { Geom, MultiPolygon as ClippedMultiPolygon, Polygon as ClippedPolygon } from "polygon-clipping";
import polygonClipping from "polygon-clipping";

type ParcelPolygonGeometry = Polygon | MultiPolygon;

export interface FocusedParcelGeometryResult {
  featureCollection: FeatureCollection<ParcelPolygonGeometry, GeoJsonProperties>;
  bbox?: {
    minLng: number;
    minLat: number;
    maxLng: number;
    maxLat: number;
  };
}

const parcelGeometryCache = new Map<string, Promise<FocusedParcelGeometryResult | undefined>>();

function lonToTileX(lon: number, zoom: number) {
  return Math.floor(((lon + 180) / 360) * 2 ** zoom);
}

function latToTileY(lat: number, zoom: number) {
  const radians = (lat * Math.PI) / 180;
  const mercator = Math.log(Math.tan(Math.PI / 4 + radians / 2));
  return Math.floor(((1 - mercator / Math.PI) / 2) * 2 ** zoom);
}

function updateBoundsFromRing(
  ring: number[][],
  bounds: { minLng: number; minLat: number; maxLng: number; maxLat: number },
) {
  for (const coordinate of ring) {
    const [lng, lat] = coordinate;
    if (lng < bounds.minLng) {
      bounds.minLng = lng;
    }
    if (lat < bounds.minLat) {
      bounds.minLat = lat;
    }
    if (lng > bounds.maxLng) {
      bounds.maxLng = lng;
    }
    if (lat > bounds.maxLat) {
      bounds.maxLat = lat;
    }
  }
}

function computeFeatureCollectionBounds(featureCollection: FeatureCollection<ParcelPolygonGeometry, GeoJsonProperties>) {
  if (!featureCollection.features.length) {
    return undefined;
  }

  const bounds = {
    minLng: Number.POSITIVE_INFINITY,
    minLat: Number.POSITIVE_INFINITY,
    maxLng: Number.NEGATIVE_INFINITY,
    maxLat: Number.NEGATIVE_INFINITY,
  };

  for (const feature of featureCollection.features) {
    if (feature.geometry.type === "Polygon") {
      for (const ring of feature.geometry.coordinates) {
        updateBoundsFromRing(ring as number[][], bounds);
      }
      continue;
    }

    for (const polygon of feature.geometry.coordinates) {
      for (const ring of polygon) {
        updateBoundsFromRing(ring as number[][], bounds);
      }
    }
  }

  if (!Number.isFinite(bounds.minLng) || !Number.isFinite(bounds.minLat) || !Number.isFinite(bounds.maxLng) || !Number.isFinite(bounds.maxLat)) {
    return undefined;
  }

  return bounds;
}

function dissolveParcelFeatures(features: Feature<ParcelPolygonGeometry, GeoJsonProperties>[]) {
  if (!features.length) {
    return undefined;
  }

  const geometries = features.map((feature) =>
    feature.geometry.type === "Polygon"
      ? feature.geometry.coordinates as unknown as ClippedPolygon
      : feature.geometry.coordinates as unknown as ClippedMultiPolygon,
  );

  const dissolved = polygonClipping.union(geometries[0] as Geom, ...(geometries.slice(1) as Geom[]));
  if (!dissolved.length) {
    return undefined;
  }

  const geometry: ParcelPolygonGeometry = dissolved.length === 1
    ? {
        type: "Polygon",
        coordinates: dissolved[0] as Polygon["coordinates"],
      }
    : {
        type: "MultiPolygon",
        coordinates: dissolved as MultiPolygon["coordinates"],
      };

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry,
      },
    ],
  } satisfies FeatureCollection<ParcelPolygonGeometry, GeoJsonProperties>;
}

async function loadParcelFeatureCollection(input: {
  bbox?: {
    minLng: number;
    minLat: number;
    maxLng: number;
    maxLat: number;
  };
  parcelKey: string;
  pmtilesUrl: string;
}) {
  const { default: Pbf } = await import("pbf");
  const { VectorTile } = await import("@mapbox/vector-tile");

  const pmtiles = new PMTiles(input.pmtilesUrl);
  const header = await pmtiles.getHeader();
  const zoom = header.minZoom;

  const bbox = input.bbox ?? {
    minLng: header.minLon,
    minLat: header.minLat,
    maxLng: header.maxLon,
    maxLat: header.maxLat,
  };

  const minX = Math.max(0, lonToTileX(bbox.minLng, zoom));
  const maxX = Math.max(minX, lonToTileX(bbox.maxLng, zoom));
  const minY = Math.max(0, latToTileY(bbox.maxLat, zoom));
  const maxY = Math.max(minY, latToTileY(bbox.minLat, zoom));

  const features: Feature<ParcelPolygonGeometry, GeoJsonProperties>[] = [];

  for (let x = minX; x <= maxX; x += 1) {
    for (let y = minY; y <= maxY; y += 1) {
      const tile = await pmtiles.getZxy(zoom, x, y);
      if (!tile) {
        continue;
      }

      const vectorTile = new VectorTile(new Pbf(new Uint8Array(tile.data)));
      const layer = vectorTile.layers.parcels;
      if (!layer) {
        continue;
      }

      for (let index = 0; index < layer.length; index += 1) {
        const feature = layer.feature(index);
        if (feature.properties.parcel_key !== input.parcelKey) {
          continue;
        }

        const geoJsonFeature = feature.toGeoJSON(x, y, zoom) as Feature;
        if (geoJsonFeature.geometry.type !== "Polygon" && geoJsonFeature.geometry.type !== "MultiPolygon") {
          continue;
        }

        features.push(geoJsonFeature as Feature<ParcelPolygonGeometry, GeoJsonProperties>);
      }
    }
  }

  if (!features.length) {
    return undefined;
  }

  const featureCollection = dissolveParcelFeatures(features);
  if (!featureCollection) {
    return undefined;
  }

  return {
    featureCollection,
    bbox: computeFeatureCollectionBounds(featureCollection),
  } satisfies FocusedParcelGeometryResult;
}

export function loadFocusedParcelGeometry(input: {
  bbox?: {
    minLng: number;
    minLat: number;
    maxLng: number;
    maxLat: number;
  };
  parcelKey: string;
  pmtilesUrl: string;
}) {
  const cacheKey = [
    input.pmtilesUrl,
    input.parcelKey,
    input.bbox?.minLng ?? "",
    input.bbox?.minLat ?? "",
    input.bbox?.maxLng ?? "",
    input.bbox?.maxLat ?? "",
  ].join(":");

  const cached = parcelGeometryCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const pending = loadParcelFeatureCollection(input);
  parcelGeometryCache.set(cacheKey, pending);
  return pending;
}

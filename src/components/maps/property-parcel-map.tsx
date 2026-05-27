"use client";

import { useEffect, useRef } from "react";
import maplibregl, { LngLatBoundsLike } from "maplibre-gl";
import { PMTiles, Protocol } from "pmtiles";

import { loadFocusedParcelGeometry } from "@/lib/parcel-focus-geometry";
import type { Property } from "@/types/domain";

import styles from "./property-parcel-map.module.css";

const PMTILES_URL =
  process.env.NEXT_PUBLIC_PARCEL_PMTILES_URL ||
  (process.env.NODE_ENV === "development" ? "/tiles/approved-provisional-parcels.pmtiles" : "");

interface PropertyParcelMapProps {
  property: Property;
}

export function PropertyParcelMap({ property }: PropertyParcelMapProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const parcelKey = property.parcelPublicId ?? property.parcelId ?? property.id;
  const propertyBbox = property.location.bbox;

  useEffect(() => {
    if (!mapRef.current || !PMTILES_URL) {
      return;
    }

    const centroid: [number, number] = [property.location.lng, property.location.lat];

    maplibregl.removeProtocol("pmtiles");
    const protocol = new Protocol();
    maplibregl.addProtocol("pmtiles", protocol.tile);

    const parcelTiles = new PMTiles(PMTILES_URL);
    protocol.add(parcelTiles);

    const map = new maplibregl.Map({
      container: mapRef.current,
      style: {
        version: 8,
        glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
        sources: {
          carto: {
            type: "raster",
            tiles: ["https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
          },
          parcels: {
            type: "vector",
            url: `pmtiles://${PMTILES_URL}`,
          },
          focusedParcel: {
            type: "geojson",
            data: {
              type: "FeatureCollection",
              features: [],
            },
          },
          propertyCentroid: {
            type: "geojson",
            data: {
              type: "FeatureCollection",
              features: [
                {
                  type: "Feature",
                  geometry: {
                    type: "Point",
                    coordinates: centroid,
                  },
                  properties: {},
                },
              ],
            },
          },
        },
        layers: [
          {
            id: "carto",
            type: "raster",
            source: "carto",
          },
          {
            id: "parcel-outline",
            type: "line",
            source: "parcels",
            "source-layer": "parcels",
            minzoom: 16,
            paint: {
              "line-color": "#7ea8f8",
              "line-width": [
                "interpolate",
                ["linear"],
                ["zoom"],
                16,
                0.6,
                18,
                1.8,
              ],
              "line-opacity": 0.65,
            },
          },
          {
            id: "focused-parcel-fill",
            type: "fill",
            source: "focusedParcel",
            paint: {
              "fill-color": "#60a5fa",
              "fill-opacity": 0.18,
            },
          },
          {
            id: "focused-parcel-outline",
            type: "line",
            source: "focusedParcel",
            paint: {
              "line-color": "#2563eb",
              "line-width": [
                "interpolate",
                ["linear"],
                ["zoom"],
                15,
                2,
                18,
                4,
              ],
              "line-opacity": 1,
            },
          },
          {
            id: "property-centroid-halo",
            type: "circle",
            source: "propertyCentroid",
            paint: {
              "circle-radius": 11,
              "circle-color": "rgba(37, 99, 235, 0.16)",
              "circle-stroke-width": 0,
            },
          },
          {
            id: "property-centroid-pin",
            type: "circle",
            source: "propertyCentroid",
            paint: {
              "circle-radius": 6,
              "circle-color": "#2563eb",
              "circle-stroke-color": "#ffffff",
              "circle-stroke-width": 2,
            },
          },
        ],
      },
      center: centroid,
      zoom: 17,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");

    const resizeObserver = new ResizeObserver(() => {
      map.resize();
    });

    resizeObserver.observe(mapRef.current);

    map.on("load", () => {
      map.resize();

      const bbox = propertyBbox;
      if (bbox) {
        const bounds: LngLatBoundsLike = [
          [bbox.minLng, bbox.minLat],
          [bbox.maxLng, bbox.maxLat],
        ];
        map.fitBounds(bounds, { padding: 40, maxZoom: 18, duration: 0 });
      } else {
        map.jumpTo({ center: centroid, zoom: 17 });
      }

      void loadFocusedParcelGeometry({
        bbox: propertyBbox,
        parcelKey,
        pmtilesUrl: PMTILES_URL,
      }).then((focusedParcel) => {
        if (!focusedParcel || !map.getSource("focusedParcel")) {
          return;
        }

        const source = map.getSource("focusedParcel") as maplibregl.GeoJSONSource | undefined;
        if (source) {
          source.setData(focusedParcel.featureCollection);
        }

        if (focusedParcel.bbox) {
          const focusedBounds: LngLatBoundsLike = [
            [focusedParcel.bbox.minLng, focusedParcel.bbox.minLat],
            [focusedParcel.bbox.maxLng, focusedParcel.bbox.maxLat],
          ];
          map.fitBounds(focusedBounds, { padding: 40, maxZoom: 18, duration: 0 });
        }
      }).catch(() => {
        // Fall back to centroid + parcel-context tiles when focused geometry cannot be extracted.
      });
    });

    return () => {
      resizeObserver.disconnect();
      map.remove();
      maplibregl.removeProtocol("pmtiles");
    };
  }, [parcelKey, property, propertyBbox]);

  return <div ref={mapRef} className={styles.map} />;
}

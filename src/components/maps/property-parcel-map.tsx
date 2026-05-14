"use client";

import { useEffect, useRef } from "react";
import maplibregl, { LngLatBoundsLike } from "maplibre-gl";
import { PMTiles, Protocol } from "pmtiles";

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
  const parcelKey = property.publicId ?? property.id;

  useEffect(() => {
    if (!mapRef.current || !PMTILES_URL) {
      return;
    }

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
            id: "selected-parcel-fill",
            type: "fill",
            source: "parcels",
            "source-layer": "parcels",
            filter: ["==", ["get", "parcel_key"], parcelKey],
            minzoom: 15,
            paint: {
              "fill-color": "#60a5fa",
              "fill-opacity": 0.18,
            },
          },
          {
            id: "selected-parcel-outline",
            type: "line",
            source: "parcels",
            "source-layer": "parcels",
            filter: ["==", ["get", "parcel_key"], parcelKey],
            minzoom: 15,
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
        ],
      },
      center: [property.location.lng, property.location.lat],
      zoom: 17,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");

    map.on("load", () => {
      const bbox = property.location.bbox;
      if (bbox) {
        const bounds: LngLatBoundsLike = [
          [bbox.minLng, bbox.minLat],
          [bbox.maxLng, bbox.maxLat],
        ];
        map.fitBounds(bounds, { padding: 40, maxZoom: 18, duration: 0 });
      } else {
        map.jumpTo({ center: [property.location.lng, property.location.lat], zoom: 17 });
      }
    });

    return () => {
      map.remove();
      maplibregl.removeProtocol("pmtiles");
    };
  }, [parcelKey, property]);

  return <div ref={mapRef} className={styles.map} />;
}

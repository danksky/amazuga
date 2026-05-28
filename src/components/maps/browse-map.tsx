"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import maplibregl from "maplibre-gl";
import { PMTiles, Protocol } from "pmtiles";

import type { BrowseMapCard, BrowseMapPin, BrowseMapResult } from "@/lib/server/browse-map";

import styles from "./browse-map.module.css";

export type { BrowseMapCard } from "@/lib/server/browse-map";

const PARCEL_PMTILES_URL =
  process.env.NEXT_PUBLIC_PARCEL_PMTILES_URL ||
  (process.env.NODE_ENV === "development" ? "/tiles/approved-provisional-parcels.pmtiles" : "");

const OFF_MARKET_PMTILES_URL =
  process.env.NEXT_PUBLIC_OFF_MARKET_PMTILES_URL ||
  (process.env.NODE_ENV === "development" ? "/tiles/off-market-preview-v1.pmtiles" : "");

const OFF_MARKET_MIN_ZOOM = 16;
const ZOOM_REFETCH_THRESHOLD = 1;
const FETCH_DEBOUNCE_MS = 300;
const MOBILE_BREAKPOINT = 1100;

const PILL_W = 54; // fixed width — all pills the same size
const PILL_H = 24;
const PILL_R = PILL_H / 2; // full capsule
const PILL_SCALE = 2; // draw at 2× for crisp anti-aliasing

interface Envelope {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

const PIN_COLOR_SALE = "#b42318";
const PIN_COLOR_RENT = "#1d4ed8";
const PIN_COLOR_SELECTED = "#16a34a";

interface BrowseMapProps {
  mode: "buy" | "rent";
  visible?: boolean;
  onResultsChange: (cards: BrowseMapCard[]) => void;
  onLoadingChange?: (loading: boolean) => void;
  selectedListingId: string | null;
  onSelectListing: (listingId: string | null) => void;
}

function formatPinPrice(amount: number, marketingType: "sale" | "rent"): string {
  const rent = marketingType === "rent";
  if (amount >= 1_000_000_000) {
    // e.g. "1.2B" — 1 decimal fits in 4 non-decimal chars for both modes
    return `${(amount / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
  }
  if (amount >= 1_000_000) {
    // Rent: show 1 decimal up to 99M ("3.1M", "12.5M"); above that round ("100M"–"999M")
    if (rent && amount < 100_000_000) {
      return `${(amount / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
    }
    return `${Math.round(amount / 1_000_000)}M`;
  }
  if (amount >= 1_000) {
    // Rent: show 1 decimal up to 99k ("3.5k", "12.5k"); above that round ("100k"–"999k")
    if (rent && amount < 100_000) {
      return `${(amount / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
    }
    return `${Math.round(amount / 1_000)}k`;
  }
  return String(amount);
}

const PILL_FONT = `500 ${13 * PILL_SCALE}px Arial, sans-serif`;

// Draws a fixed-width capsule with the label baked in at PILL_SCALE× resolution.
// Each unique (label, color) pair gets its own sprite — text is part of the icon
// so all symbols share one draw pass and z-order is consistent.
function createPillSprite(label: string, color: string): ImageData {
  const s = PILL_SCALE;
  const w = PILL_W * s;
  const h = PILL_H * s;
  const r = PILL_R * s;

  // Add a gutter around the pill so the shadow blur has room to render.
  const gutter = 4 * s;
  const canvas = document.createElement("canvas");
  canvas.width = w + gutter * 2;
  canvas.height = h + gutter * 2;
  const ctx = canvas.getContext("2d")!;

  // Draw shadow first, then pill on top.
  ctx.shadowColor = "rgba(0,0,0,0.18)";
  ctx.shadowBlur = 5 * s;
  ctx.shadowOffsetY = 2 * s;

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(gutter + r, gutter);
  ctx.lineTo(gutter + w - r, gutter);
  ctx.arc(gutter + w - r, gutter + r, r, -Math.PI / 2, 0);
  ctx.lineTo(gutter + w, gutter + h - r);
  ctx.arc(gutter + w - r, gutter + h - r, r, 0, Math.PI / 2);
  ctx.lineTo(gutter + r, gutter + h);
  ctx.arc(gutter + r, gutter + h - r, r, Math.PI / 2, Math.PI);
  ctx.lineTo(gutter, gutter + r);
  ctx.arc(gutter + r, gutter + r, r, Math.PI, Math.PI * 1.5);
  ctx.closePath();
  ctx.fill();

  ctx.shadowColor = "transparent";

  ctx.fillStyle = "#ffffff";
  ctx.font = PILL_FONT;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const m = ctx.measureText(label);
  const textY = gutter + (h + m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
  ctx.fillText(label, gutter + w / 2, textY);

  return ctx.getImageData(0, 0, w + gutter * 2, h + gutter * 2);
}

export function BrowseMap({ mode, visible, onResultsChange, onLoadingChange, selectedListingId, onSelectListing }: BrowseMapProps) {
  const router = useRouter();
  const routerRef = useRef(router);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const fetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastEnvelopeRef = useRef<Envelope | null>(null);
  const lastZoomRef = useRef<number | null>(null);
  const onResultsChangeRef = useRef(onResultsChange);
  const onLoadingChangeRef = useRef(onLoadingChange);
  const onSelectListingRef = useRef(onSelectListing);
  const fetchBrowseDataRef = useRef<(() => Promise<void>) | null>(null);
  const updatePinsRef = useRef<((pins: BrowseMapPin[]) => void) | null>(null);
  const lastPinsRef = useRef<BrowseMapPin[]>([]);
  const selectedListingIdRef = useRef<string | null>(selectedListingId);
  const selectedParcelIdRef = useRef<string | null>(null);

  useEffect(() => {
    onResultsChangeRef.current = onResultsChange;
  });

  useEffect(() => {
    onLoadingChangeRef.current = onLoadingChange;
  });

  useEffect(() => {
    onSelectListingRef.current = onSelectListing;
  });

  useEffect(() => {
    routerRef.current = router;
  });

  // Re-measure the map canvas whenever it becomes visible (e.g. mobile toggle).
  useEffect(() => {
    if (visible === false) return;
    const map = mapInstanceRef.current;
    if (!map) return;
    requestAnimationFrame(() => map.resize());
  }, [visible]);

  // When selection changes from outside, update the ref and re-draw pins.
  useEffect(() => {
    selectedListingIdRef.current = selectedListingId;
    updatePinsRef.current?.(lastPinsRef.current);
  }, [selectedListingId]);

  const [showSearchArea, setShowSearchArea] = useState(false);
  const [isFetching, setIsFetching] = useState(false);

  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    const apiMode = mode === "buy" ? "sale" : "rent";

    // ---- data update ---------------------------------------------------

    function updatePins(pins: BrowseMapPin[]) {
      const map = mapInstanceRef.current;
      if (!map) return;
      const source = map.getSource("listing-pins") as maplibregl.GeoJSONSource | undefined;
      if (!source) return;

      lastPinsRef.current = pins;
      const activeId = selectedListingIdRef.current;

      // Register any new sprites (normal + selected variants) before updating source data.
      for (const pin of pins) {
        const label = formatPinPrice(pin.priceLabelRwf, pin.marketingType);
        const normalColor = pin.marketingType === "rent" ? PIN_COLOR_RENT : PIN_COLOR_SALE;
        const normalId = `pin-${pin.marketingType}-${label}`;
        const selectedId = `pin-selected-${label}`;
        if (!map.hasImage(normalId)) {
          map.addImage(normalId, createPillSprite(label, normalColor), { pixelRatio: PILL_SCALE });
        }
        if (!map.hasImage(selectedId)) {
          map.addImage(selectedId, createPillSprite(label, PIN_COLOR_SELECTED), { pixelRatio: PILL_SCALE });
        }
      }

      source.setData({
        type: "FeatureCollection",
        features: pins.map((pin) => {
          const label = formatPinPrice(pin.priceLabelRwf, pin.marketingType);
          const isSelected = pin.listingId === activeId;
          return {
            type: "Feature" as const,
            geometry: {
              type: "Point" as const,
              coordinates: [pin.anchorLng, pin.anchorLat],
            },
            properties: {
              listing_id: pin.listingId,
              route_id: pin.routeId,
              image_id: isSelected ? `pin-selected-${label}` : `pin-${pin.marketingType}-${label}`,
            },
          };
        }),
      });
    }

    updatePinsRef.current = updatePins;

    async function fetchBrowseData() {
      const map = mapInstanceRef.current;
      if (!map) return;

      const bounds = map.getBounds();
      const bbox = [
        bounds.getWest(),
        bounds.getSouth(),
        bounds.getEast(),
        bounds.getNorth(),
      ].join(",");

      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      onLoadingChangeRef.current?.(true);
      setIsFetching(true);

      try {
        const res = await fetch(
          `/api/public/browse/map?mode=${apiMode}&bbox=${bbox}`,
          { signal: controller.signal },
        );
        if (!res.ok) {
          onLoadingChangeRef.current?.(false);
          setIsFetching(false);
          return;
        }

        const data = (await res.json()) as BrowseMapResult;

        lastEnvelopeRef.current = data.resultEnvelope;
        lastZoomRef.current = map.getZoom();

        updatePins(data.pins);

        if (map.getLayer("off-market-dots")) {
          map.setFilter("off-market-dots", [
            "!",
            ["in", ["get", "parcel_public_id"], ["literal", data.suppressionKeys]],
          ]);
        }

        onResultsChangeRef.current(data.cards);
        onLoadingChangeRef.current?.(false);
        setIsFetching(false);
        setShowSearchArea(false);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        onLoadingChangeRef.current?.(false);
        setIsFetching(false);
      }
    }

    fetchBrowseDataRef.current = fetchBrowseData;

    function scheduleFetch() {
      if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current);
      fetchTimerRef.current = setTimeout(() => void fetchBrowseData(), FETCH_DEBOUNCE_MS);
    }

    function viewportExceedsEnvelope(): boolean {
      const map = mapInstanceRef.current;
      const env = lastEnvelopeRef.current;
      if (!map || !env) return true;
      const b = map.getBounds();
      return (
        b.getWest() < env.minLng ||
        b.getSouth() < env.minLat ||
        b.getEast() > env.maxLng ||
        b.getNorth() > env.maxLat
      );
    }

    function zoomChangedSignificantly(): boolean {
      const map = mapInstanceRef.current;
      const lastZoom = lastZoomRef.current;
      if (!map || lastZoom === null) return true;
      return Math.abs(map.getZoom() - lastZoom) >= ZOOM_REFETCH_THRESHOLD;
    }

    // ---- PMTiles -------------------------------------------------------

    maplibregl.removeProtocol("pmtiles");
    const protocol = new Protocol();
    maplibregl.addProtocol("pmtiles", protocol.tile);
    if (PARCEL_PMTILES_URL) protocol.add(new PMTiles(PARCEL_PMTILES_URL));
    if (OFF_MARKET_PMTILES_URL) protocol.add(new PMTiles(OFF_MARKET_PMTILES_URL));

    // ---- Map style -----------------------------------------------------

    const sources: Record<string, maplibregl.SourceSpecification> = {
      carto: {
        type: "raster",
        tiles: ["https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png"],
        tileSize: 256,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      },
      // Empty initial GeoJSON; updated via source.setData() after each fetch
      "listing-pins": {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      },
    };

    if (PARCEL_PMTILES_URL) {
      sources.parcels = { type: "vector", url: `pmtiles://${PARCEL_PMTILES_URL}` };
    }
    if (OFF_MARKET_PMTILES_URL) {
      sources["off-market"] = {
        type: "vector",
        url: `pmtiles://${OFF_MARKET_PMTILES_URL}`,
        promoteId: { off_market_parcels: "parcel_public_id" },
      };
    }

    const layers: maplibregl.LayerSpecification[] = [
      { id: "carto", type: "raster", source: "carto" },
    ];

    if (PARCEL_PMTILES_URL) {
      layers.push({
        id: "parcel-outline",
        type: "line",
        source: "parcels",
        "source-layer": "parcels",
        minzoom: 16,
        paint: {
          "line-color": "#7ea8f8",
          "line-width": ["interpolate", ["linear"], ["zoom"], 16, 0.6, 18, 1.8],
          "line-opacity": 0.65,
        },
      });
    }

    if (OFF_MARKET_PMTILES_URL) {
      layers.push({
        id: "off-market-dots",
        type: "circle",
        source: "off-market",
        "source-layer": "off_market_parcels",
        minzoom: OFF_MARKET_MIN_ZOOM,
        paint: {
          "circle-radius": ["case", ["boolean", ["feature-state", "selected"], false], 6, 4],
          "circle-color": ["case", ["boolean", ["feature-state", "selected"], false], PIN_COLOR_SELECTED, "#94a3b8"],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": ["case", ["boolean", ["feature-state", "selected"], false], 2, 1],
          "circle-opacity": 1,
        },
      });
    }

    // Listing pin symbol layer — text baked into each sprite, one draw pass, correct z-order
    layers.push({
      id: "listing-pins",
      type: "symbol",
      source: "listing-pins",
      layout: {
        "icon-image": ["get", "image_id"],
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
    });

    // ---- Map instance --------------------------------------------------

    const map = new maplibregl.Map({
      container,
      style: {
        version: 8,
        sources,
        layers,
      },
      center: [30.06, -1.94],
      zoom: 12,
    });

    mapInstanceRef.current = map;
    map.addControl(new maplibregl.NavigationControl(), "top-right");

    // ---- Events --------------------------------------------------------

    map.on("load", () => {
      map.resize();

      // Tracks whether the current click cycle hit a feature (prevents background deselect)
      let clickHitFeature = false;

      function deselectParcel() {
        const prev = selectedParcelIdRef.current;
        if (prev) {
          map.setFeatureState(
            { source: "off-market", sourceLayer: "off_market_parcels", id: prev },
            { selected: false },
          );
          selectedParcelIdRef.current = null;
        }
      }

      // First click selects; second click on the same pill navigates.
      map.on("click", "listing-pins", (e) => {
        clickHitFeature = true;
        const feature = e.features?.[0];
        if (!feature) return;
        const listingId = feature.properties?.listing_id as string | undefined;
        const routeId = feature.properties?.route_id as string | undefined;
        if (!listingId) return;
        if (selectedListingIdRef.current === listingId) {
          if (routeId) routerRef.current.push(`/property/${encodeURIComponent(routeId)}`);
        } else {
          deselectParcel();
          onSelectListingRef.current(listingId);
        }
      });
      map.on("mouseenter", "listing-pins", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "listing-pins", () => { map.getCanvas().style.cursor = ""; });

      // Off-market dot clicks — first click selects (green), second click navigates
      if (OFF_MARKET_PMTILES_URL && map.getLayer("off-market-dots")) {
        map.on("click", "off-market-dots", (e) => {
          clickHitFeature = true;
          const feature = e.features?.[0];
          if (!feature) return;
          const parcelId = feature.properties?.parcel_public_id as string | undefined;
          const routeId = feature.properties?.route_id as string | undefined;
          if (!parcelId) return;

          if (selectedParcelIdRef.current === parcelId) {
            if (routeId) routerRef.current.push(`/property/${encodeURIComponent(routeId)}`);
          } else {
            deselectParcel();
            onSelectListingRef.current(null);
            selectedParcelIdRef.current = parcelId;
            map.setFeatureState(
              { source: "off-market", sourceLayer: "off_market_parcels", id: parcelId },
              { selected: true },
            );
          }
        });
        map.on("mouseenter", "off-market-dots", () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", "off-market-dots", () => { map.getCanvas().style.cursor = ""; });
      }

      // Clicking the map background clears any selected dot
      map.on("click", () => {
        if (clickHitFeature) {
          clickHitFeature = false;
          return;
        }
        deselectParcel();
      });

      void fetchBrowseData();
    });

    map.on("moveend", () => {
      const isMobile = window.innerWidth < MOBILE_BREAKPOINT;
      if (isMobile) {
        setShowSearchArea(true);
      } else if (viewportExceedsEnvelope() || zoomChangedSignificantly()) {
        scheduleFetch();
      }
    });

    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(container);

    // ---- Cleanup -------------------------------------------------------

    return () => {
      fetchBrowseDataRef.current = null;
      updatePinsRef.current = null;
      resizeObserver.disconnect();
      abortControllerRef.current?.abort();
      if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current);
      map.remove();
      maplibregl.removeProtocol("pmtiles");
      mapInstanceRef.current = null;
    };
  }, [mode]);

  return (
    <div className={styles.container}>
      <div ref={mapContainerRef} className={styles.map} />
      {showSearchArea && !isFetching ? (
        <button
          className={styles.searchAreaButton}
          onClick={() => void fetchBrowseDataRef.current?.()}
          type="button"
        >
          Search this area
        </button>
      ) : null}
    </div>
  );
}

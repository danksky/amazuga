"use client";

import { useCallback, useRef, useState } from "react";

const OG_W = 1200;
const OG_H = 630;
const DISPLAY_W = 840;
const DISPLAY_H = Math.round(OG_H * (DISPLAY_W / OG_W));
const GALLERY_GAP = 2;
const PRIMARY_RATIO = 1.45 / (1.45 + 0.85);

type ListingType = "sale" | "rent";

// ---------- label helpers ----------

function buildPriceLabel(price: string, type: ListingType): string {
  if (!price) return "";
  const n = parseFloat(price);
  if (isNaN(n)) return price;
  const formatted = n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}B` : `${n}M`;
  return type === "rent" ? `${formatted} RWF/mo` : `${formatted} RWF`;
}

function buildFactsLabel(beds: string, baths: string, area: string): string {
  const parts: string[] = [];
  if (beds) parts.push(`${beds} bed${beds === "1" ? "" : "s"}`);
  if (baths) parts.push(`${baths} bath${baths === "1" ? "" : "s"}`);
  if (area) parts.push(`${area} m²`);
  return parts.join("  ·  ");
}

// ---------- image helpers ----------

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawCoverAt(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = img.naturalWidth * scale;
  const sh = img.naturalHeight * scale;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(img, x + (w - sw) / 2, y + (h - sh) / 2, sw, sh);
  ctx.restore();
}

function drawGalleryImages(
  ctx: CanvasRenderingContext2D,
  imgs: HTMLImageElement[],
  w: number,
  h: number,
) {
  if (imgs.length === 0) return;

  if (imgs.length === 1) {
    drawCoverAt(ctx, imgs[0], 0, 0, w, h);
    return;
  }

  const primaryW = Math.floor(w * PRIMARY_RATIO);
  const secondaryX = primaryW + GALLERY_GAP;
  const secondaryW = w - primaryW - GALLERY_GAP;

  drawCoverAt(ctx, imgs[0], 0, 0, primaryW, h);
  ctx.fillStyle = "#e5e7eb";
  ctx.fillRect(primaryW, 0, GALLERY_GAP, h);

  if (imgs.length === 2) {
    drawCoverAt(ctx, imgs[1], secondaryX, 0, secondaryW, h);
  } else {
    const halfH = Math.floor((h - GALLERY_GAP) / 2);
    drawCoverAt(ctx, imgs[1], secondaryX, 0, secondaryW, halfH);
    ctx.fillStyle = "#e5e7eb";
    ctx.fillRect(secondaryX, halfH, secondaryW, GALLERY_GAP);
    drawCoverAt(ctx, imgs[2], secondaryX, halfH + GALLERY_GAP, secondaryW, h - halfH - GALLERY_GAP);
  }
}

// ---------- overlay helpers ----------

function drawGradientOverlays(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const topGrad = ctx.createLinearGradient(0, 0, 0, h * 0.45);
  topGrad.addColorStop(0, "rgba(0,0,0,0.72)");
  topGrad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, w, h * 0.45);
}

// Replicates the CSS split badge:
//   Blue left: clip-path polygon(0 0, 100% 0, calc(100%-D) 100%, 0 100%)
//   Yellow right: clip-path polygon(D 0, 100% 0, 100% 100%, 0 100%), margin-left: -D
function drawSplitBadge(
  ctx: CanvasRenderingContext2D,
  typeLabel: string,
  stateLabel: string,
  x: number,
  y: number,
) {
  const FONT_SIZE = 22;
  const H = 35;
  const r = H / 2;
  const D = 11;
  const PAD_X = 20;

  ctx.save();
  ctx.shadowBlur = 0;
  ctx.font = `700 ${FONT_SIZE}px "Helvetica Neue", Helvetica, Arial, sans-serif`;

  const typeW = ctx.measureText(typeLabel).width;
  const stateW = ctx.measureText(stateLabel).width;

  const blueW = PAD_X + typeW + PAD_X; // content width (without diagonal)
  const yellowX = x + blueW;           // yellow starts where blue content ends (bottom junction)
  const yellowW = D + PAD_X + stateW + PAD_X; // diagonal overhang + content

  // 1. Yellow (drawn first, behind blue)
  //    Trapezoid: top-left at (yellowX + D, y), bottom-left at (yellowX, y+H), right side rounded
  const yellowEndX = yellowX + yellowW;
  ctx.beginPath();
  ctx.moveTo(yellowX + D, y);                              // top-left (angled)
  ctx.lineTo(yellowEndX - r, y);
  ctx.arcTo(yellowEndX, y, yellowEndX, y + r, r);          // top-right arc
  ctx.lineTo(yellowEndX, y + H - r);
  ctx.arcTo(yellowEndX, y + H, yellowEndX - r, y + H, r); // bottom-right arc
  ctx.lineTo(yellowX, y + H);                              // bottom-left (angled)
  ctx.closePath();
  ctx.fillStyle = "#fad201";
  ctx.fill();

  // Yellow text — placed after the diagonal, centered in content area
  ctx.fillStyle = "#000000";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(stateLabel, yellowX + D + PAD_X, y + H / 2);

  // 2. Blue (drawn on top)
  //    Trapezoid: top spans blueW + D, bottom spans blueW; left side fully rounded
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + blueW + D, y);   // top-right (extended by D)
  ctx.lineTo(x + blueW, y + H);   // diagonal to bottom-right
  ctx.lineTo(x + r, y + H);
  // Left semicircle: from bottom-center (PI/2) clockwise → left (PI) → top-center (3PI/2)
  ctx.arc(x + r, y + r, r, Math.PI / 2, 3 * Math.PI / 2, false);
  ctx.closePath();
  ctx.fillStyle = "#00a1de";
  ctx.fill();

  // Blue text
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(typeLabel, x + PAD_X, y + H / 2);

  ctx.restore();
}

function drawTextAndLogo(
  ctx: CanvasRenderingContext2D,
  priceLabel: string,
  factsLabel: string,
  propertyTypeLabel: string,
  listingType: ListingType,
  logo: HTMLImageElement,
  w: number,
  h: number,
) {
  const pad = 52;

  // Badge — top left, above price
  const BADGE_H = 50;
  const PRICE_FONT = 58;
  const BADGE_PRICE_GAP = 16;
  const badgeY = pad;
  const priceY = badgeY + BADGE_H + BADGE_PRICE_GAP;

  const stateLabel = listingType === "rent" ? "FOR RENT" : "FOR SALE";
  drawSplitBadge(ctx, propertyTypeLabel.toUpperCase(), stateLabel, pad, badgeY);

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 12;
  ctx.fillStyle = "#ffffff";

  // Price — top left, below badge
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.font = `700 ${PRICE_FONT}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
  ctx.fillText(priceLabel, pad, priceY);

  // Facts — top right, right-aligned
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  ctx.font = `500 28px "Helvetica Neue", Helvetica, Arial, sans-serif`;
  ctx.fillText(factsLabel, w - pad, pad);

  ctx.restore();

  // Logo — bottom left, 50% opacity
  const logoH = 56;
  const logoW = Math.round(logo.naturalWidth * (logoH / logo.naturalHeight));
  ctx.globalAlpha = 0.5;
  ctx.drawImage(logo, pad, h - logoH - pad, logoW, logoH);
  ctx.globalAlpha = 1.0;
}

async function renderOgCanvas(
  canvas: HTMLCanvasElement,
  photoUrls: string[],
  priceLabel: string,
  factsLabel: string,
  propertyTypeLabel: string,
  listingType: ListingType,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx || photoUrls.length === 0) return;

  canvas.width = OG_W;
  canvas.height = OG_H;

  const [imgs, logo] = await Promise.all([
    Promise.all(photoUrls.map(loadImage)),
    loadImage("/amazuga-logo-white.png"),
  ]);

  ctx.clearRect(0, 0, OG_W, OG_H);
  drawGalleryImages(ctx, imgs, OG_W, OG_H);
  drawGradientOverlays(ctx, OG_W, OG_H);
  drawTextAndLogo(ctx, priceLabel, factsLabel, propertyTypeLabel, listingType, logo, OG_W, OG_H);
}

// ---------- component ----------

function useFileUrl() {
  const [url, setUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setUrl(URL.createObjectURL(f)); setFile(f); }
  }, []);
  return { url, file, inputRef, handleChange };
}

export default function OgDemoPage() {
  const photo1 = useFileUrl();
  const photo2 = useFileUrl();
  const photo3 = useFileUrl();

  const [price, setPrice] = useState("350");
  const [listingType, setListingType] = useState<ListingType>("sale");
  const [propertyType, setPropertyType] = useState("House");
  const [beds, setBeds] = useState("3");
  const [baths, setBaths] = useState("2");
  const [area, setArea] = useState("120");

  const [renderingSingle, setRenderingSingle] = useState(false);
  const [renderedSingle, setRenderedSingle] = useState(false);
  const [renderingCollage, setRenderingCollage] = useState(false);
  const [renderedCollage, setRenderedCollage] = useState(false);

  const [sharpSingleUrl, setSharpSingleUrl] = useState<string | null>(null);
  const [renderingSharpSingle, setRenderingSharpSingle] = useState(false);
  const [sharpCollageUrl, setSharpCollageUrl] = useState<string | null>(null);
  const [renderingSharpCollage, setRenderingSharpCollage] = useState(false);

  const singleCanvasRef = useRef<HTMLCanvasElement>(null);
  const collageCanvasRef = useRef<HTMLCanvasElement>(null);

  const priceLabel = buildPriceLabel(price, listingType);
  const factsLabel = buildFactsLabel(beds, baths, area);

  const handleRenderSingle = useCallback(async () => {
    if (!photo1.url || !singleCanvasRef.current) return;
    setRenderingSingle(true);
    setRenderedSingle(false);
    try {
      await renderOgCanvas(singleCanvasRef.current, [photo1.url], priceLabel, factsLabel, propertyType, listingType);
      setRenderedSingle(true);
    } finally {
      setRenderingSingle(false);
    }
  }, [photo1.url, priceLabel, factsLabel, propertyType, listingType]);

  const handleRenderCollage = useCallback(async () => {
    if (!photo1.url || !collageCanvasRef.current) return;
    setRenderingCollage(true);
    setRenderedCollage(false);
    try {
      const urls = [photo1.url, photo2.url, photo3.url].filter(Boolean) as string[];
      await renderOgCanvas(collageCanvasRef.current, urls, priceLabel, factsLabel, propertyType, listingType);
      setRenderedCollage(true);
    } finally {
      setRenderingCollage(false);
    }
  }, [photo1.url, photo2.url, photo3.url, priceLabel, factsLabel, propertyType, listingType]);

  const buildFormData = useCallback((photoFiles: (File | null)[]) => {
    const fd = new FormData();
    const keys = ["photo1", "photo2", "photo3"] as const;
    photoFiles.forEach((f, i) => { if (f) fd.append(keys[i], f); });
    fd.append("price", price);
    fd.append("listingType", listingType);
    fd.append("propertyType", propertyType);
    fd.append("beds", beds);
    fd.append("baths", baths);
    fd.append("area", area);
    return fd;
  }, [price, listingType, propertyType, beds, baths, area]);

  const handleSharpRenderSingle = useCallback(async () => {
    if (!photo1.file) return;
    setRenderingSharpSingle(true);
    setSharpSingleUrl(null);
    try {
      const res = await fetch("/api/og-generate", { method: "POST", body: buildFormData([photo1.file]) });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      setSharpSingleUrl(URL.createObjectURL(blob));
    } finally {
      setRenderingSharpSingle(false);
    }
  }, [photo1.file, buildFormData]);

  const handleSharpRenderCollage = useCallback(async () => {
    if (!photo1.file) return;
    setRenderingSharpCollage(true);
    setSharpCollageUrl(null);
    try {
      const res = await fetch("/api/og-generate", { method: "POST", body: buildFormData([photo1.file, photo2.file, photo3.file]) });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      setSharpCollageUrl(URL.createObjectURL(blob));
    } finally {
      setRenderingSharpCollage(false);
    }
  }, [photo1.file, photo2.file, photo3.file, buildFormData]);

  const handleDownload = useCallback((canvasRef: React.RefObject<HTMLCanvasElement | null>, name: string) => {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = name;
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  }, []);

  return (
    <div style={{ maxWidth: 920, margin: "0 auto", padding: "40px 24px", fontFamily: "inherit" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>OG Image Preview</h1>
      <p style={{ color: "#666", marginBottom: 32, fontSize: 14 }}>
        Upload listing photos and fill in the details to preview the OG image that would be generated.
      </p>

      {/* Shared controls */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 40, alignItems: "flex-end" }}>
        <PhotoUploadButton label="Photo 1 (primary)" hook={photo1} accent />

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={labelStyle}>Property type</label>
          <select onChange={(e) => setPropertyType(e.target.value)} style={inputStyle} value={propertyType}>
            <option>House</option>
            <option>Apartment</option>
            <option>Land</option>
            <option>Commercial</option>
            <option>Villa</option>
            <option>Office</option>
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={labelStyle}>Listing type</label>
          <select onChange={(e) => setListingType(e.target.value as ListingType)} style={inputStyle} value={listingType}>
            <option value="sale">For sale</option>
            <option value="rent">For rent</option>
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={labelStyle}>Price (M RWF)</label>
          <input onChange={(e) => setPrice(e.target.value)} placeholder="350" style={{ ...inputStyle, width: 100 }} type="text" value={price} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={labelStyle}>Beds</label>
          <input onChange={(e) => setBeds(e.target.value)} placeholder="3" style={{ ...inputStyle, width: 64 }} type="text" value={beds} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={labelStyle}>Baths</label>
          <input onChange={(e) => setBaths(e.target.value)} placeholder="2" style={{ ...inputStyle, width: 64 }} type="text" value={baths} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={labelStyle}>Area (m²)</label>
          <input onChange={(e) => setArea(e.target.value)} placeholder="120" style={{ ...inputStyle, width: 80 }} type="text" value={area} />
        </div>
      </div>

      <input accept="image/*" onChange={photo1.handleChange} ref={photo1.inputRef} style={{ display: "none" }} type="file" />
      <input accept="image/*" onChange={photo2.handleChange} ref={photo2.inputRef} style={{ display: "none" }} type="file" />
      <input accept="image/*" onChange={photo3.handleChange} ref={photo3.inputRef} style={{ display: "none" }} type="file" />

      {!photo1.url && (
        <div
          onClick={() => photo1.inputRef.current?.click()}
          style={{
            border: "2px dashed #d1d5db", borderRadius: 12, padding: "80px 40px",
            textAlign: "center", color: "#9ca3af", cursor: "pointer", fontSize: 15, marginBottom: 40,
          }}
        >
          Click to upload a primary photo to get started
        </div>
      )}

      {photo1.url && (
        <div style={{ display: "flex", flexDirection: "column", gap: 48 }}>

          {/* Single photo */}
          <section>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <h2 style={sectionHeadingStyle}>Single photo</h2>
              <ActionButton disabled={renderingSingle} onClick={handleRenderSingle}>
                {renderingSingle ? "Rendering…" : "Canvas preview"}
              </ActionButton>
              <ActionButton disabled={renderingSharpSingle} onClick={handleSharpRenderSingle}>
                {renderingSharpSingle ? "Rendering…" : "Render (Sharp)"}
              </ActionButton>
              {renderedSingle && <GhostButton onClick={() => handleDownload(singleCanvasRef, "og-single.png")}>Download canvas</GhostButton>}
              {sharpSingleUrl && <GhostButton onClick={() => { const a = document.createElement("a"); a.download = "og-single-sharp.png"; a.href = sharpSingleUrl; a.click(); }}>Download Sharp</GhostButton>}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Preview label="Original">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt="Primary photo" src={photo1.url} style={coverFillStyle} />
              </Preview>
              <Preview label="Canvas preview" badge="client-side">
                <canvas ref={singleCanvasRef} style={{ ...coverFillStyle, display: renderedSingle ? "block" : "none" }} />
                {!renderedSingle && <EmptyState rendering={renderingSingle} />}
              </Preview>
              <Preview label="Sharp render" badge="server-side · 1200 × 630">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {sharpSingleUrl && <img alt="Sharp OG" src={sharpSingleUrl} style={coverFillStyle} />}
                {!sharpSingleUrl && <EmptyState rendering={renderingSharpSingle} />}
              </Preview>
            </div>
          </section>

          {/* Collage */}
          <section>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <h2 style={sectionHeadingStyle}>Collage (up to 3 photos)</h2>
              <PhotoUploadButton label={photo2.url ? "Photo 2 ✓" : "Add photo 2"} hook={photo2} small />
              {photo2.url && <PhotoUploadButton label={photo3.url ? "Photo 3 ✓" : "Add photo 3"} hook={photo3} small />}
              <ActionButton disabled={renderingCollage} onClick={handleRenderCollage}>
                {renderingCollage ? "Rendering…" : "Canvas preview"}
              </ActionButton>
              <ActionButton disabled={renderingSharpCollage} onClick={handleSharpRenderCollage}>
                {renderingSharpCollage ? "Rendering…" : "Render (Sharp)"}
              </ActionButton>
              {renderedCollage && <GhostButton onClick={() => handleDownload(collageCanvasRef, "og-collage.png")}>Download canvas</GhostButton>}
              {sharpCollageUrl && <GhostButton onClick={() => { const a = document.createElement("a"); a.download = "og-collage-sharp.png"; a.href = sharpCollageUrl; a.click(); }}>Download Sharp</GhostButton>}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Preview label="Canvas preview" badge="client-side">
                <canvas ref={collageCanvasRef} style={{ ...coverFillStyle, display: renderedCollage ? "block" : "none" }} />
                {!renderedCollage && <EmptyState rendering={renderingCollage} />}
              </Preview>
              <Preview label="Sharp render" badge="server-side · 1200 × 630">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {sharpCollageUrl && <img alt="Sharp collage OG" src={sharpCollageUrl} style={coverFillStyle} />}
                {!sharpCollageUrl && <EmptyState rendering={renderingSharpCollage} />}
              </Preview>
            </div>
          </section>

        </div>
      )}
    </div>
  );
}

// ---------- sub-components ----------

function PhotoUploadButton({ label, hook, accent, small }: { label: string; hook: ReturnType<typeof useFileUrl>; accent?: boolean; small?: boolean }) {
  const hasFile = !!hook.url;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {!small && <label style={labelStyle}>Photo</label>}
      <button
        onClick={() => hook.inputRef.current?.click()}
        style={{
          ...inputStyle,
          cursor: "pointer",
          backgroundColor: hasFile ? "#f0fdf4" : accent ? "#fafafa" : "#f9fafb",
          borderColor: hasFile ? "#86efac" : "#d1d5db",
          color: hasFile ? "#166534" : "#6b7280",
          minWidth: small ? 110 : 160,
          height: small ? 32 : 36,
          fontSize: small ? 12 : 14,
        }}
        type="button"
      >
        {label}
      </button>
    </div>
  );
}

function ActionButton({ children, onClick, disabled }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      style={{
        padding: "7px 18px", borderRadius: 8, border: "none",
        backgroundColor: disabled ? "#d1d5db" : "#6000FF",
        color: "#fff", fontWeight: 600, fontSize: 13,
        cursor: disabled ? "not-allowed" : "pointer", height: 34,
      }}
      type="button"
    >
      {children}
    </button>
  );
}

function GhostButton({ children, onClick }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "7px 14px", borderRadius: 8,
        border: "1px solid #d1d5db", backgroundColor: "#fff",
        color: "#374151", fontWeight: 500, fontSize: 13,
        cursor: "pointer", height: 34,
      }}
      type="button"
    >
      {children}
    </button>
  );
}

function Preview({ label, badge, children }: { label: string; badge?: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
        {label}{badge && <span style={{ fontWeight: 400, marginLeft: 6 }}>{badge}</span>}
      </div>
      <div style={{ width: DISPLAY_W, height: DISPLAY_H, borderRadius: 10, overflow: "hidden", border: "1px solid #e5e7eb", backgroundColor: "#111", position: "relative" }}>
        {children}
      </div>
    </div>
  );
}

function EmptyState({ rendering }: { rendering: boolean }) {
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#6b7280", fontSize: 13 }}>
      {rendering ? "Rendering…" : "Hit Render to generate the preview"}
    </div>
  );
}

// ---------- styles ----------

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 500, color: "#6b7280",
  textTransform: "uppercase", letterSpacing: "0.05em",
};

const inputStyle: React.CSSProperties = {
  padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db",
  fontSize: 14, color: "#111", backgroundColor: "#fff", height: 36,
};

const sectionHeadingStyle: React.CSSProperties = {
  fontSize: 14, fontWeight: 700, color: "#111", margin: 0,
};

const coverFillStyle: React.CSSProperties = {
  width: "100%", height: "100%", objectFit: "cover", display: "block",
};

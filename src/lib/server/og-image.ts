import "server-only";

import { createHmac, randomUUID } from "node:crypto";
import fs from "fs/promises";
import path from "path";

import sharp from "sharp";

import { getPgPool } from "@/lib/server/postgres";

// ---------- font loading (embedded into SVG so librsvg works on serverless) ----------

let _fontCache: { bold: string; regular: string } | null = null;

async function getFonts(): Promise<{ bold: string; regular: string }> {
  if (_fontCache) return _fontCache;
  const [boldBuf, regularBuf] = await Promise.all([
    fs.readFile(path.join(process.cwd(), "public", "fonts", "Inter-Bold.ttf")),
    fs.readFile(path.join(process.cwd(), "public", "fonts", "Inter-Regular.ttf")),
  ]);
  _fontCache = { bold: boldBuf.toString("base64"), regular: regularBuf.toString("base64") };
  return _fontCache;
}

// ---------- canvas geometry (mirrors property-page.module.css gallery ratios) ----------

const OG_W = 1200;
const OG_H = 630;
const GAP = 2;
const PRIMARY_RATIO = 1.45 / (1.45 + 0.85);

// ---------- image compositing ----------

async function coverCrop(input: Buffer, w: number, h: number): Promise<Buffer> {
  const meta = await sharp(input).metadata();
  const isPortrait = (meta.height ?? 0) > (meta.width ?? 0);
  return sharp(input)
    .resize(w, h, { fit: "cover", position: isPortrait ? "top" : "centre" })
    .jpeg({ quality: 92 })
    .toBuffer();
}

async function buildCollage(photos: Buffer[]): Promise<Buffer> {
  if (photos.length === 1) {
    return coverCrop(photos[0], OG_W, OG_H);
  }

  const primaryW = Math.floor(OG_W * PRIMARY_RATIO);
  const secondaryX = primaryW + GAP;
  const secondaryW = OG_W - primaryW - GAP;

  const composites: sharp.OverlayOptions[] = [];

  const primary = await coverCrop(photos[0], primaryW, OG_H);
  composites.push({ input: primary, top: 0, left: 0 });

  if (photos.length === 2) {
    const sec = await coverCrop(photos[1], secondaryW, OG_H);
    composites.push({ input: sec, top: 0, left: secondaryX });
  } else {
    const halfH = Math.floor((OG_H - GAP) / 2);
    const bottomH = OG_H - halfH - GAP;
    const [sec1, sec2] = await Promise.all([
      coverCrop(photos[1], secondaryW, halfH),
      coverCrop(photos[2], secondaryW, bottomH),
    ]);
    composites.push(
      { input: sec1, top: 0, left: secondaryX },
      { input: sec2, top: halfH + GAP, left: secondaryX },
    );
    const hGap = await sharp({
      create: { width: secondaryW, height: GAP, channels: 4, background: { r: 229, g: 231, b: 235, alpha: 1 } },
    }).png().toBuffer();
    composites.push({ input: hGap, top: halfH, left: secondaryX });
  }

  const vGap = await sharp({
    create: { width: GAP, height: OG_H, channels: 4, background: { r: 229, g: 231, b: 235, alpha: 1 } },
  }).png().toBuffer();
  composites.push({ input: vGap, top: 0, left: primaryW });

  const base = await sharp({
    create: { width: OG_W, height: OG_H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } },
  }).png().toBuffer();

  return sharp(base).composite(composites).png().toBuffer();
}

// ---------- SVG overlay ----------

function escXml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function approxW(text: string, size: number, weight: "400" | "700" = "400"): number {
  return text.length * size * (weight === "700" ? 0.62 : 0.55);
}

function buildOverlaySvg(
  priceLabel: string,
  factsLabel: string,
  propertyType: string,
  listingType: "sale" | "rent",
  fontBoldB64: string,
  fontRegularB64: string,
): string {
  const W = OG_W;
  const H = OG_H;
  const pad = 52;
  const stateLabel = listingType === "rent" ? "FOR RENT" : "FOR SALE";

  const BF = 22;
  const BH = 35;
  const BR = BH / 2;
  const BD = 11;
  const BPX = 20;

  const blueContentW = BPX + approxW(propertyType, BF, "700") + BPX;
  const bx = pad;
  const by = pad;
  const blueTopRight = bx + blueContentW + BD;
  const blueBottomRight = bx + blueContentW;
  const yellowX = blueBottomRight;
  const yellowTopLeft = yellowX + BD;
  const yellowEndX = yellowTopLeft + approxW(stateLabel, BF, "700") + BPX * 2;

  // Blue: left-pill (two 90° quarter arcs) + diagonal right edge
  const bluePath = [
    `M ${bx + BR} ${by}`,
    `L ${blueTopRight} ${by}`,
    `L ${blueBottomRight} ${by + BH}`,
    `L ${bx + BR} ${by + BH}`,
    `A ${BR} ${BR} 0 0 1 ${bx} ${by + BR}`,    // bottom-left quarter (sweep=1 = CW in SVG y-down)
    `A ${BR} ${BR} 0 0 1 ${bx + BR} ${by}`,    // top-left quarter
    "Z",
  ].join(" ");

  // Yellow: angled left edge + right-pill arcs
  const yellowPath = [
    `M ${yellowTopLeft} ${by}`,
    `L ${yellowEndX - BR} ${by}`,
    `A ${BR} ${BR} 0 0 1 ${yellowEndX} ${by + BR}`,
    `L ${yellowEndX} ${by + BH - BR}`,
    `A ${BR} ${BR} 0 0 1 ${yellowEndX - BR} ${by + BH}`,
    `L ${yellowX} ${by + BH}`,
    "Z",
  ].join(" ");

  const priceY = by + BH + 16;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <style>
      @font-face { font-family: 'Inter'; font-weight: 700; src: url('data:font/truetype;base64,${fontBoldB64}') format('truetype'); }
      @font-face { font-family: 'Inter'; font-weight: 400; src: url('data:font/truetype;base64,${fontRegularB64}') format('truetype'); }
    </style>
    <filter id="sh" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="0" stdDeviation="6" flood-color="black" flood-opacity="0.5"/>
    </filter>
    <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(0,0,0,0.72)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
    </linearGradient>
  </defs>

  <rect x="0" y="0" width="${W}" height="${H * 0.45}" fill="url(#tg)"/>

  <path d="${yellowPath}" fill="#fad201" stroke="none"/>
  <path d="${bluePath}" fill="#00a1de" stroke="none"/>

  <text x="${bx + BPX}" y="${by + BH / 2}"
    font-family="Inter"
    font-size="${BF}" font-weight="700" fill="white" dominant-baseline="middle"
  >${escXml(propertyType.toUpperCase())}</text>

  <text x="${yellowTopLeft + BPX}" y="${by + BH / 2}"
    font-family="Inter"
    font-size="${BF}" font-weight="700" fill="black" dominant-baseline="middle"
  >${escXml(stateLabel)}</text>

  <text x="${pad}" y="${priceY}"
    font-family="Inter"
    font-size="58" font-weight="700" fill="white" dominant-baseline="hanging"
    filter="url(#sh)"
  >${escXml(priceLabel)}</text>

  <text x="${W - pad}" y="${pad}"
    font-family="Inter"
    font-size="28" font-weight="400" fill="white"
    text-anchor="end" dominant-baseline="hanging"
    filter="url(#sh)"
  >${escXml(factsLabel)}</text>
</svg>`;
}

// ---------- label helpers ----------

function buildPriceLabel(priceRwf: number, marketingType: "sale" | "rent"): string {
  const m = priceRwf / 1_000_000;
  const formatted = m >= 1000 ? `${(m / 1000).toFixed(m % 1000 === 0 ? 0 : 1)}B` : `${m}M`;
  return marketingType === "rent" ? `${formatted} RWF/mo` : `${formatted} RWF`;
}

function buildFactsLabel(beds?: number | null, baths?: number | null, areaSqm?: number | null): string {
  const parts: string[] = [];
  if (beds) parts.push(`${beds} bed${beds === 1 ? "" : "s"}`);
  if (baths) parts.push(`${baths} bath${baths === 1 ? "" : "s"}`);
  if (areaSqm) parts.push(`${Math.round(areaSqm)} m²`);
  return parts.join("  ·  ");
}

// ---------- public composite entrypoint (used by demo API route) ----------

export interface OgImageParams {
  photoBuffers: Buffer[];
  priceRwf: number;
  marketingType: "sale" | "rent";
  propertyType: string;
  beds?: number | null;
  baths?: number | null;
  areaSqm?: number | null;
}

export async function buildOgImageBuffer(params: OgImageParams): Promise<Buffer> {
  const { photoBuffers, priceRwf, marketingType, propertyType, beds, baths, areaSqm } = params;

  const priceLabel = buildPriceLabel(priceRwf, marketingType);
  const factsLabel = buildFactsLabel(beds, baths, areaSqm);

  const fonts = await getFonts();

  const logoPath = path.join(process.cwd(), "public", "amazuga-logo-white.png");
  const logoRaw = await fs.readFile(logoPath);
  const logoMeta = await sharp(logoRaw).metadata();
  const logoH = 56;
  const logoW = Math.round((logoMeta.width ?? 200) * (logoH / (logoMeta.height ?? 56)));
  const logoResized = await sharp(logoRaw).resize(logoW, logoH).ensureAlpha().png().toBuffer();
  const alphaHalf = await sharp({
    create: { width: logoW, height: logoH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0.5 } },
  }).png().toBuffer();
  const logoBuf = await sharp(logoResized).composite([{ input: alphaHalf, blend: "dest-in" }]).png().toBuffer();

  const collageBuf = await buildCollage(photoBuffers);
  const svgBuf = Buffer.from(buildOverlaySvg(priceLabel, factsLabel, propertyType, marketingType, fonts.bold, fonts.regular));
  const pad = 52;

  return sharp(collageBuf)
    .composite([
      { input: svgBuf, top: 0, left: 0 },
      { input: logoBuf, top: OG_H - logoH - pad, left: pad },
    ])
    .jpeg({ quality: 92 })
    .toBuffer();
}

// ---------- DB query ----------

interface ListingOgData {
  priceRwf: number;
  marketingType: "sale" | "rent";
  propertyType: string;
  beds: number | null;
  baths: number | null;
  areaSqm: number | null;
  imageUrls: string[];
}

async function getListingOgData(listingId: string): Promise<ListingOgData | null> {
  const pool = getPgPool();

  const [listingResult, imageResult, videoResult] = await Promise.all([
    pool.query<{
      asking_price_rwf: string | number | null;
      marketing_type: string | null;
      property_type: string | null;
      bedrooms: string | number | null;
      bathrooms: string | number | null;
      interior_area_sqm: string | number | null;
    }>(
      `SELECT
        l.asking_price_rwf,
        l.marketing_type,
        COALESCE(
          NULLIF(BTRIM(pap.property_type), ''),
          CASE pa.asset_type
            WHEN 'house' THEN 'House'
            WHEN 'apartment_unit' THEN 'Apartment'
            WHEN 'apartment_building' THEN 'Apartment'
            WHEN 'land' THEN 'Land'
            WHEN 'commercial_building' THEN 'Commercial'
            WHEN 'commercial_unit' THEN 'Commercial'
            ELSE 'Property'
          END
        ) AS property_type,
        pap.bedrooms,
        pap.bathrooms,
        pap.interior_area_sqm
      FROM listing l
      JOIN property_asset pa ON pa.id = l.property_asset_id
      LEFT JOIN property_asset_profile pap ON pap.property_asset_id = pa.id
      WHERE l.id = $1`,
      [listingId],
    ),
    pool.query<{ image_url: string }>(
      `SELECT image_url
       FROM listing_image
       WHERE listing_id = $1 AND status = 'ready'
       ORDER BY sort_order ASC, created_at ASC
       LIMIT 3`,
      [listingId],
    ),
    pool.query<{ thumbnail_url: string | null }>(
      `SELECT thumbnail_url FROM listing_video WHERE listing_id = $1 AND status = 'ready' LIMIT 1`,
      [listingId],
    ),
  ]);

  const row = listingResult.rows[0];
  if (!row || row.asking_price_rwf === null || !row.marketing_type) return null;

  const priceRwf = Number(row.asking_price_rwf);
  if (!isFinite(priceRwf) || priceRwf <= 0) return null;

  const imageUrls = imageResult.rows.map((r: { image_url: string }) => r.image_url);
  const videoThumbnailUrl = imageResult.rows[2] === undefined
    ? (videoResult.rows[0]?.thumbnail_url ?? null)
    : null;
  if (videoThumbnailUrl) {
    while (imageUrls.length < 3) imageUrls.push(videoThumbnailUrl);
  }

  return {
    priceRwf,
    marketingType: row.marketing_type as "sale" | "rent",
    propertyType: row.property_type ?? "Property",
    beds: row.bedrooms != null ? Number(row.bedrooms) : null,
    baths: row.bathrooms != null ? Number(row.bathrooms) : null,
    areaSqm: row.interior_area_sqm != null ? Number(row.interior_area_sqm) : null,
    imageUrls,
  };
}

// ---------- storage ----------

async function downloadBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch image ${url}: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function storeOgImage(listingId: string, pngBuffer: Buffer): Promise<string> {
  const uploadUrl = process.env.LISTING_IMAGE_UPLOAD_URL?.trim();
  const signingSecret = process.env.LISTING_IMAGE_UPLOAD_SECRET?.trim();

  if (!uploadUrl || !signingSecret) throw new Error("Listing image upload is not configured");

  const payload = {
    version: 1,
    intentId: randomUUID(),
    listingId,
    userId: "system",
    contentType: "image/jpeg",
    fileName: "og-image.jpg",
    maxBytes: 4 * 1024 * 1024,
    exp: Date.now() + 5 * 60 * 1000,
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", signingSecret).update(encodedPayload).digest("base64url");
  const token = `${encodedPayload}.${signature}`;

  // Derive allowed origin from upload hostname: uploads.amazuga.com → https://amazuga.com
  const uploadHost = new URL(uploadUrl).hostname;
  const origin = `https://${uploadHost.split(".").slice(-2).join(".")}`;

  const form = new FormData();
  form.append("token", token);
  const ab = pngBuffer.buffer.slice(pngBuffer.byteOffset, pngBuffer.byteOffset + pngBuffer.byteLength) as ArrayBuffer;
  form.append("file", new Blob([ab], { type: "image/jpeg" }), "og-image.jpg");

  const res = await fetch(uploadUrl, { method: "POST", body: form, headers: { Origin: origin } });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OG image upload failed: ${res.status} ${body}`);
  }

  const data = await res.json() as { imageUrl?: string };
  if (!data.imageUrl) throw new Error("OG image upload returned no imageUrl");
  return data.imageUrl;
}

async function saveOgImageUrl(listingId: string, url: string): Promise<void> {
  await getPgPool().query(
    `UPDATE listing SET og_image_url = $1, updated_at = NOW() WHERE id = $2`,
    [url, listingId],
  );
}

// ---------- main orchestrator ----------

export async function generateAndStoreOgImage(listingId: string): Promise<void> {
  const data = await getListingOgData(listingId);
  if (!data || data.imageUrls.length === 0) return;

  const photoBuffers = await Promise.all(data.imageUrls.map(downloadBuffer));

  const pngBuffer = await buildOgImageBuffer({
    photoBuffers,
    priceRwf: data.priceRwf,
    marketingType: data.marketingType,
    propertyType: data.propertyType,
    beds: data.beds,
    baths: data.baths,
    areaSqm: data.areaSqm,
  });

  const publicUrl = await storeOgImage(listingId, pngBuffer);
  await saveOgImageUrl(listingId, publicUrl);
}

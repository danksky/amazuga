/**
 * Shared OG image generation logic.
 * Used by both backfill-og-images.mjs and import-listing.mjs.
 */

import { createHmac, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------- canvas geometry ----------

const OG_W = 1200;
const OG_H = 630;
const GAP = 2;
const PRIMARY_RATIO = 1.45 / (1.45 + 0.85);

// ---------- font loading ----------

let _fontCache = null;

async function getFonts() {
  if (_fontCache) return _fontCache;
  const fontsDir = path.join(__dirname, "..", "public", "fonts");
  const [boldBuf, regularBuf] = await Promise.all([
    fs.readFile(path.join(fontsDir, "Inter-Bold.ttf")),
    fs.readFile(path.join(fontsDir, "Inter-Regular.ttf")),
  ]);
  _fontCache = { bold: boldBuf.toString("base64"), regular: regularBuf.toString("base64") };
  return _fontCache;
}

// ---------- image compositing ----------

async function coverCrop(input, w, h) {
  const meta = await sharp(input).metadata();
  const isPortrait = (meta.height ?? 0) > (meta.width ?? 0);
  return sharp(input)
    .resize(w, h, { fit: "cover", position: isPortrait ? "top" : "centre" })
    .jpeg({ quality: 92 })
    .toBuffer();
}

async function buildCollage(photos) {
  if (photos.length === 1) return coverCrop(photos[0], OG_W, OG_H);

  const primaryW = Math.floor(OG_W * PRIMARY_RATIO);
  const secondaryX = primaryW + GAP;
  const secondaryW = OG_W - primaryW - GAP;
  const composites = [];

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

function escXml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function approxW(text, size, weight = "400") {
  return text.length * size * (weight === "700" ? 0.62 : 0.55);
}

function buildOverlaySvg(priceLabel, factsLabel, propertyType, listingType, fontBoldB64, fontRegularB64) {
  const W = OG_W, H = OG_H, pad = 52;
  const stateLabel = listingType === "rent" ? "FOR RENT" : "FOR SALE";
  const BF = 22, BH = 35, BR = BH / 2, BD = 11, BPX = 20;

  const blueContentW = BPX + approxW(propertyType, BF, "700") + BPX;
  const bx = pad, by = pad;
  const blueTopRight = bx + blueContentW + BD;
  const blueBottomRight = bx + blueContentW;
  const yellowX = blueBottomRight;
  const yellowTopLeft = yellowX + BD;
  const yellowEndX = yellowTopLeft + approxW(stateLabel, BF, "700") + BPX * 2;

  const bluePath = [
    `M ${bx + BR} ${by}`,
    `L ${blueTopRight} ${by}`,
    `L ${blueBottomRight} ${by + BH}`,
    `L ${bx + BR} ${by + BH}`,
    `A ${BR} ${BR} 0 0 1 ${bx} ${by + BR}`,
    `A ${BR} ${BR} 0 0 1 ${bx + BR} ${by}`,
    "Z",
  ].join(" ");

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
    font-size="28" font-weight="500" fill="white"
    text-anchor="end" dominant-baseline="hanging"
    filter="url(#sh)"
  >${escXml(factsLabel)}</text>
</svg>`;
}

// ---------- label helpers ----------

function buildPriceLabel(priceRwf, marketingType) {
  const m = priceRwf / 1_000_000;
  const formatted = m >= 1000 ? `${(m / 1000).toFixed(m % 1000 === 0 ? 0 : 1)}B` : `${m}M`;
  return marketingType === "rent" ? `${formatted} RWF/mo` : `${formatted} RWF`;
}

function buildFactsLabel(beds, baths, areaSqm) {
  const parts = [];
  if (beds) parts.push(`${beds} bed${beds === 1 ? "" : "s"}`);
  if (baths) parts.push(`${baths} bath${baths === 1 ? "" : "s"}`);
  if (areaSqm) parts.push(`${Math.round(areaSqm)} m²`);
  return parts.join("  ·  ");
}

// ---------- exports ----------

/**
 * Build a 1200×630 JPEG OG image buffer from listing data.
 *
 * @param {object} options
 * @param {Buffer[]} options.photoBuffers - Up to 3 source photo buffers (first is primary)
 * @param {number}   options.priceRwf
 * @param {string}   options.marketingType - "sale" | "rent"
 * @param {string}   options.propertyType  - Display label e.g. "House", "Land"
 * @param {number|null} options.beds
 * @param {number|null} options.baths
 * @param {number|null} options.areaSqm
 * @returns {Promise<Buffer>} JPEG buffer
 */
export async function buildOgImageBuffer({ photoBuffers, priceRwf, marketingType, propertyType, beds, baths, areaSqm }) {
  const priceLabel = buildPriceLabel(priceRwf, marketingType);
  const factsLabel = buildFactsLabel(beds, baths, areaSqm);

  const fonts = await getFonts();

  const logoPath = path.join(__dirname, "..", "public", "amazuga-logo-white.png");
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

/**
 * Upload a JPEG buffer to the Cloudflare Worker and return the public image URL.
 *
 * @param {string} listingId
 * @param {Buffer} jpegBuffer
 * @param {string} uploadUrl    - LISTING_IMAGE_UPLOAD_URL
 * @param {string} uploadSecret - LISTING_IMAGE_UPLOAD_SECRET
 * @returns {Promise<string>} public image URL
 */
export async function storeOgImage(listingId, jpegBuffer, uploadUrl, uploadSecret) {
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
  const signature = createHmac("sha256", uploadSecret).update(encodedPayload).digest("base64url");
  const token = `${encodedPayload}.${signature}`;

  const uploadHost = new URL(uploadUrl).hostname;
  const origin = `https://${uploadHost.split(".").slice(-2).join(".")}`;

  const form = new FormData();
  form.append("token", token);
  form.append("file", new Blob([jpegBuffer], { type: "image/jpeg" }), "og-image.jpg");

  const res = await fetch(uploadUrl, { method: "POST", body: form, headers: { Origin: origin } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Upload failed: ${res.status} ${body}`);
  }

  const data = await res.json();
  if (!data.imageUrl) throw new Error("Upload returned no imageUrl");
  return data.imageUrl;
}

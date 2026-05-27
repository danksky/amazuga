"use client";

import { useEffect, useRef } from "react";

const PILL_W = 80;
const PILL_H = 34;
const COLOR = "#3b5bdb";

function CanvasPill({ radius, label }: { radius: number; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, PILL_W, PILL_H);
    ctx.fillStyle = COLOR;
    ctx.beginPath();
    ctx.moveTo(radius, 0);
    ctx.lineTo(PILL_W - radius, 0);
    ctx.arc(PILL_W - radius, radius, radius, -Math.PI / 2, 0);
    ctx.lineTo(PILL_W, PILL_H - radius);
    ctx.arc(PILL_W - radius, PILL_H - radius, radius, 0, Math.PI / 2);
    ctx.lineTo(radius, PILL_H);
    ctx.arc(radius, PILL_H - radius, radius, Math.PI / 2, Math.PI);
    ctx.lineTo(0, radius);
    ctx.arc(radius, radius, radius, Math.PI, Math.PI * 1.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 13px 'Arial', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, PILL_W / 2, PILL_H / 2);
  }, [radius, label]);

  return (
    <div style={{ textAlign: "center" }}>
      <canvas ref={ref} width={PILL_W} height={PILL_H} style={{ display: "block", margin: "0 auto 6px", imageRendering: "pixelated" }} />
      <div style={{ fontSize: 11, color: "#888" }}>r = {radius}</div>
    </div>
  );
}

function RoundRectPill({ radius, label }: { radius: number; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, PILL_W, PILL_H);
    ctx.fillStyle = COLOR;
    ctx.beginPath();
    (ctx as CanvasRenderingContext2D & { roundRect: (x: number, y: number, w: number, h: number, r: number) => void })
      .roundRect(0, 0, PILL_W, PILL_H, radius);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 13px 'Arial', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, PILL_W / 2, PILL_H / 2);
  }, [radius, label]);

  return (
    <div style={{ textAlign: "center" }}>
      <canvas ref={ref} width={PILL_W} height={PILL_H} style={{ display: "block", margin: "0 auto 6px", imageRendering: "pixelated" }} />
      <div style={{ fontSize: 11, color: "#888" }}>roundRect r={radius}</div>
    </div>
  );
}

function CssPill({ radius, label }: { radius: number; label: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: PILL_W,
          height: PILL_H,
          background: COLOR,
          borderRadius: radius,
          color: "#fff",
          fontWeight: 700,
          fontSize: 13,
          fontFamily: "Arial, sans-serif",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 11, color: "#888" }}>CSS r={radius}</div>
    </div>
  );
}

const LABEL = "3M";
const RADII = [8, 10, 12, 14, 15, 16, 17];

export default function PillPreviewPage() {
  return (
    <div style={{ padding: 40, fontFamily: "sans-serif", background: "#f5f5f5", minHeight: "100vh" }}>
      <h2 style={{ marginBottom: 8 }}>Pill preview — canvas arc approach</h2>
      <p style={{ color: "#666", marginBottom: 32, fontSize: 14 }}>This is exactly the drawing code used in browse-map.tsx. Each box shows a different corner radius.</p>
      <div style={{ display: "flex", gap: 32, flexWrap: "wrap", marginBottom: 48 }}>
        {RADII.map((r) => (
          <CanvasPill key={r} radius={r} label={LABEL} />
        ))}
      </div>

      <h2 style={{ marginBottom: 8 }}>Canvas roundRect() — browser-native</h2>
      <p style={{ color: "#666", marginBottom: 32, fontSize: 14 }}>Uses the newer roundRect() API (same output as arc approach but simpler code).</p>
      <div style={{ display: "flex", gap: 32, flexWrap: "wrap", marginBottom: 48 }}>
        {RADII.map((r) => (
          <RoundRectPill key={r} radius={r} label={LABEL} />
        ))}
      </div>

      <h2 style={{ marginBottom: 8 }}>CSS reference — what the ideal looks like</h2>
      <p style={{ color: "#666", marginBottom: 32, fontSize: 14 }}>These are pure CSS and will always look crisp. Pick the one closest to what you want, then I'll match it in the canvas version.</p>
      <div style={{ display: "flex", gap: 32, flexWrap: "wrap", marginBottom: 48 }}>
        {RADII.map((r) => (
          <CssPill key={r} radius={r} label={LABEL} />
        ))}
        <CssPill radius={999} label={LABEL} />
      </div>

      <h2 style={{ marginBottom: 8 }}>2× scale canvas (anti-aliasing test)</h2>
      <p style={{ color: "#666", marginBottom: 32, fontSize: 14 }}>Canvas drawn at 2× logical size to check if the boxy look is a resolution issue.</p>
      <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
        {RADII.map((r) => (
          <CanvasPill2x key={r} radius={r} label={LABEL} />
        ))}
      </div>
    </div>
  );
}

function CanvasPill2x({ radius, label }: { radius: number; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const scale = 2;
  const w = PILL_W * scale;
  const h = PILL_H * scale;
  const r = radius * scale;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = COLOR;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(w - r, 0);
    ctx.arc(w - r, r, r, -Math.PI / 2, 0);
    ctx.lineTo(w, h - r);
    ctx.arc(w - r, h - r, r, 0, Math.PI / 2);
    ctx.lineTo(r, h);
    ctx.arc(r, h - r, r, Math.PI / 2, Math.PI);
    ctx.lineTo(0, r);
    ctx.arc(r, r, r, Math.PI, Math.PI * 1.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${13 * scale}px 'Arial', sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, w / 2, h / 2);
  }, [r, label, w, h]);

  return (
    <div style={{ textAlign: "center" }}>
      <canvas
        ref={ref}
        width={w}
        height={h}
        style={{ display: "block", margin: "0 auto 6px", width: PILL_W, height: PILL_H }}
      />
      <div style={{ fontSize: 11, color: "#888" }}>2× r={radius}</div>
    </div>
  );
}

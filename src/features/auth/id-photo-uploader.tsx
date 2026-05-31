"use client";

import { useRef, useState, type ChangeEvent } from "react";

import styles from "./id-photo-uploader.module.css";

const MAX_EDGE_PX = 1800;
const JPEG_QUALITY = 0.82;

function loadImageFromFile(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(objectUrl); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error(`Could not decode ${file.name}.`)); };
    img.src = objectUrl;
  });
}

function canvasToJpegBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("Could not create JPEG.")),
      "image/jpeg",
      JPEG_QUALITY,
    );
  });
}

async function normalizeToJpeg(file: File) {
  const img = await loadImageFromFile(file);
  const scale = Math.min(1, MAX_EDGE_PX / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not access canvas context.");
  ctx.drawImage(img, 0, 0, w, h);
  const blob = await canvasToJpegBlob(canvas);
  return new File([blob], "id-photo.jpg", { type: "image/jpeg", lastModified: Date.now() });
}

interface UploadIntent {
  token: string;
  uploadUrl: string;
}

export function IdPhotoUploader({ name = "nationalIdPhotoUrl" }: { name?: string }) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setPending(true);

    try {
      const normalized = await normalizeToJpeg(file);

      // Get signed upload intent
      const intentRes = await fetch("/api/onboarding/agent-applications/id-photo-intent", {
        method: "POST",
      });
      const intentPayload = await intentRes.json().catch(() => null);
      if (!intentRes.ok || !intentPayload?.intent) {
        throw new Error(intentPayload?.error || "Could not create upload intent.");
      }
      const intent = intentPayload.intent as UploadIntent;

      // Upload to Cloudflare Worker
      const formData = new FormData();
      formData.append("token", intent.token);
      formData.append("file", normalized);

      const uploadRes = await fetch(intent.uploadUrl, { method: "POST", body: formData });
      const uploadPayload = await uploadRes.json().catch(() => null);
      if (!uploadRes.ok || !uploadPayload?.imageUrl) {
        throw new Error(uploadPayload?.error || "Upload failed.");
      }

      setPhotoUrl(uploadPayload.imageUrl as string);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setPending(false);
      event.target.value = "";
    }
  }

  return (
    <div className={styles.root}>
      {/* Hidden input carries the URL into the server action */}
      <input type="hidden" name={name} value={photoUrl ?? ""} />

      {photoUrl ? (
        <div className={styles.preview}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="ID photo preview" className={styles.previewImg} src={photoUrl} />
          <div className={styles.previewMeta}>
            <span className={styles.previewLabel}>ID photo uploaded</span>
            <button
              className={styles.replaceBtn}
              onClick={() => inputRef.current?.click()}
              type="button"
            >
              Replace
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.uploadBox}>
          <div className={styles.uploadTitle}>Upload required document</div>
          <div className={styles.uploadBody}>
            Add a clear photo of your National ID. This is required for admin review and agent approval.
          </div>
          <button
            className={styles.uploadBtn}
            disabled={pending}
            onClick={() => inputRef.current?.click()}
            type="button"
          >
            {pending ? "Uploading…" : "Upload ID photo"}
          </button>
        </div>
      )}

      {error ? <div className={styles.error}>{error}</div> : null}

      <input
        accept="image/*"
        className={styles.fileInput}
        disabled={pending}
        onChange={handleFileSelection}
        ref={inputRef}
        type="file"
      />
    </div>
  );
}

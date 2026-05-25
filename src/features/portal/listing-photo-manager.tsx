"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";

import styles from "./listing-form.module.css";

interface ListingPhoto {
  id: string;
  imageUrl: string;
  width?: number;
  height?: number;
  fileSizeBytes?: number;
  status: "ready" | "processing" | "failed" | "pending_delete" | "delete_failed";
  sortOrder: number;
}

interface UploadIntent {
  token: string;
  uploadUrl: string;
}

interface UploadedImagePayload {
  imageUrl: string;
  storageKey: string;
  width?: number;
  height?: number;
  contentType?: string;
  fileSizeBytes?: number;
}

const MAX_EDGE_PX = 1800;
const JPEG_QUALITY = 0.78;

function formatBytes(bytes?: number) {
  if (!bytes) {
    return undefined;
  }

  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function loadImageFromFile(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Could not decode ${file.name}.`));
    };
    image.src = objectUrl;
  });
}

function canvasToJpegBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Could not create JPEG blob."));
          return;
        }

        resolve(blob);
      },
      "image/jpeg",
      JPEG_QUALITY,
    );
  });
}

async function normalizeImage(file: File) {
  const image = await loadImageFromFile(file);
  const scale = Math.min(1, MAX_EDGE_PX / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Could not access canvas context for image compression.");
  }

  context.drawImage(image, 0, 0, width, height);
  const blob = await canvasToJpegBlob(canvas);
  const safeBaseName = file.name.replace(/\.[^.]+$/, "").replace(/[^a-z0-9-_]+/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "listing-photo";

  return {
    file: new File([blob], `${safeBaseName}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    }),
    width,
    height,
  };
}

export function ListingPhotoManager({
  hasError,
  initialImages,
  listingId,
  onCountChange,
  uploadEnabled,
}: {
  hasError?: boolean;
  initialImages: ListingPhoto[];
  listingId: string;
  onCountChange?: (count: number) => void;
  uploadEnabled: boolean;
}) {
  const [images, setImages] = useState<ListingPhoto[]>(initialImages);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const remainingSlots = useMemo(() => Math.max(0, 12 - images.length), [images.length]);

  useEffect(() => {
    onCountChange?.(images.length);
  }, [images.length, onCountChange]);

  async function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);

    if (selectedFiles.length === 0) {
      return;
    }

    setError(null);
    setStatus(null);

    if (!uploadEnabled) {
      setError("Listing photo uploads are not configured yet.");
      event.target.value = "";
      return;
    }

    if (selectedFiles.length > remainingSlots) {
      setError(`You can only add ${remainingSlots} more photo${remainingSlots === 1 ? "" : "s"} to this listing.`);
      event.target.value = "";
      return;
    }

    setPending(true);

    try {
      const normalizedFiles = [];
      for (const file of selectedFiles) {
        normalizedFiles.push(await normalizeImage(file));
      }

      const intentsResponse = await fetch(`/api/portal/listings/${encodeURIComponent(listingId)}/images/upload-intents`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          files: normalizedFiles.map((file) => ({
            fileName: file.file.name,
            contentType: file.file.type,
          })),
        }),
      });

      const intentPayload = await intentsResponse.json().catch(() => null);
      if (!intentsResponse.ok || !Array.isArray(intentPayload?.intents)) {
        throw new Error(intentPayload?.error || "Could not create listing image upload intents.");
      }

      const intents = intentPayload.intents as UploadIntent[];
      const uploadedImages: ListingPhoto[] = [];

      for (let index = 0; index < normalizedFiles.length; index += 1) {
        const normalized = normalizedFiles[index];
        const intent = intents[index];
        const formData = new FormData();
        formData.append("token", intent.token);
        formData.append("file", normalized.file);
        formData.append("width", String(normalized.width));
        formData.append("height", String(normalized.height));

        const uploadResponse = await fetch(intent.uploadUrl, {
          method: "POST",
          body: formData,
        });
        const uploadPayload = await uploadResponse.json().catch(() => null);

        if (!uploadResponse.ok) {
          throw new Error(uploadPayload?.error || `Could not upload ${normalized.file.name}.`);
        }

        const saveResponse = await fetch(`/api/portal/listings/${encodeURIComponent(listingId)}/images`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            imageUrl: (uploadPayload as UploadedImagePayload).imageUrl,
            storageKey: (uploadPayload as UploadedImagePayload).storageKey,
            width: (uploadPayload as UploadedImagePayload).width ?? normalized.width,
            height: (uploadPayload as UploadedImagePayload).height ?? normalized.height,
            contentType: (uploadPayload as UploadedImagePayload).contentType ?? normalized.file.type,
            fileSizeBytes: (uploadPayload as UploadedImagePayload).fileSizeBytes ?? normalized.file.size,
          }),
        });
        const savePayload = await saveResponse.json().catch(() => null);

        if (!saveResponse.ok || !savePayload?.image) {
          throw new Error(savePayload?.error || `Could not attach ${normalized.file.name} to the listing.`);
        }

        uploadedImages.push(savePayload.image as ListingPhoto);
      }

      setImages((current) => [...current, ...uploadedImages]);
      setStatus(
        uploadedImages.length === 1
          ? "1 photo uploaded."
          : `${uploadedImages.length} photos uploaded.`,
      );
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Listing photo upload failed.");
    } finally {
      setPending(false);
      event.target.value = "";
    }
  }

  async function handleRemove(imageId: string) {
    setError(null);
    setStatus(null);
    setPending(true);

    try {
      const response = await fetch(
        `/api/portal/listings/${encodeURIComponent(listingId)}/images/${encodeURIComponent(imageId)}`,
        { method: "DELETE" },
      );
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || "Could not remove the listing photo.");
      }

      setImages((current) => current.filter((image) => image.id !== imageId));
      setStatus("Photo removed from this listing.");
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Could not remove the listing photo.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className={`${styles.mediaSection}${hasError ? ` ${styles.mediaSectionError}` : ""}`}>
      <div className={styles.mediaHeader}>
        <div>
          <h2 className={styles.mediaTitle}>Listing photos <sup>* Required</sup></h2>
          <div className={styles.mediaBody}>
            Photos are compressed to standardized JPEGs in the browser before upload, then sent through the listing
            media gateway for validation and storage.
          </div>
        </div>
        <div className={styles.mediaMeta}>{images.length} / 12 uploaded</div>
      </div>

      {error ? <div className={styles.mediaError}>{error}</div> : null}
      {status ? <div className={styles.mediaStatus}>{status}</div> : null}

      <div className={styles.mediaActions}>
        <input
          accept="image/*"
          className={styles.mediaInput}
          disabled={pending || !uploadEnabled || remainingSlots === 0}
          multiple
          onChange={handleFileSelection}
          ref={inputRef}
          type="file"
        />
        <button
          className={styles.mediaButton}
          disabled={pending || !uploadEnabled || remainingSlots === 0}
          onClick={() => inputRef.current?.click()}
          type="button"
        >
          {pending ? "Uploading..." : "Add photos"}
        </button>
        <div className={styles.mediaHint}>
          {uploadEnabled
            ? "Use JPG, PNG, HEIC, or phone-camera images. At least one photo is required to publish."
            : "Listing photo upload is not configured yet. Add the Cloudflare Worker and media bucket env values first."}
        </div>
      </div>

      {images.length > 0 ? (
        <div className={styles.mediaGrid}>
          {images.map((image, index) => (
            <article className={styles.mediaCard} key={image.id}>
              <div className={styles.mediaThumbWrap}>
                <img alt={`Listing photo ${index + 1}`} className={styles.mediaThumb} src={image.imageUrl} />
              </div>
              <div className={styles.mediaCardBody}>
                <div className={styles.mediaCardMeta}>
                  Photo {index + 1}
                  {image.width && image.height ? ` · ${image.width}×${image.height}` : ""}
                  {image.fileSizeBytes ? ` · ${formatBytes(image.fileSizeBytes)}` : ""}
                </div>
                <div className={styles.mediaCardStatus}>{image.status}</div>
              </div>
              <button
                className={styles.mediaRemove}
                disabled={pending}
                onClick={() => handleRemove(image.id)}
                type="button"
              >
                Remove
              </button>
            </article>
          ))}
        </div>
      ) : (
        <div className={styles.mediaEmpty}>
          No photos yet.
        </div>
      )}
    </section>
  );
}

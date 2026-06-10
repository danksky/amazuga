"use client";
/* eslint-disable @next/next/no-img-element */

import { useRef, useState, type ChangeEvent } from "react";

import styles from "./listing-form.module.css";

interface ListingVideo {
  id: string;
  videoUrl: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
  contentType?: string;
  fileSizeBytes?: number;
  status: "ready" | "pending_delete" | "delete_failed";
}

interface UploadIntent {
  token: string;
  uploadUrl: string;
}

interface UploadedMediaPayload {
  videoUrl?: string;
  imageUrl?: string;
  storageKey: string;
  fileSizeBytes?: number;
}

const MAX_VIDEO_BYTES = 30 * 1024 * 1024; // 30 MB
const MAX_DURATION_SECONDS = 120; // 2 minutes
const ALLOWED_VIDEO_TYPES = new Set(["video/mp4", "video/quicktime", "video/webm"]);

function formatBytes(bytes?: number) {
  if (!bytes) return undefined;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(seconds?: number) {
  if (!seconds) return undefined;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function getVideoMetadata(file: File): Promise<{ durationSeconds: number }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ durationSeconds: video.duration });
    };
    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Could not read metadata from ${file.name}.`));
    };
    video.src = objectUrl;
  });
}

function captureFirstFrame(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    video.onloadeddata = () => {
      video.currentTime = 0;
    };

    video.onseeked = () => {
      URL.revokeObjectURL(objectUrl);
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext("2d");

      if (!context) {
        reject(new Error("Could not access canvas context for thumbnail."));
        return;
      }

      context.drawImage(video, 0, 0);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Could not create thumbnail."));
            return;
          }
          resolve({ blob, width: video.videoWidth, height: video.videoHeight });
        },
        "image/jpeg",
        0.75,
      );
    };

    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Could not generate thumbnail from ${file.name}.`));
    };

    video.src = objectUrl;
    video.load();
  });
}

export function ListingVideoManager({
  initialVideo,
  listingId,
  uploadEnabled,
}: {
  initialVideo?: ListingVideo;
  listingId: string;
  uploadEnabled: boolean;
}) {
  const [video, setVideo] = useState<ListingVideo | undefined>(initialVideo);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    setError(null);
    setStatus(null);
    event.target.value = "";

    if (!uploadEnabled) {
      setError("Video upload is not configured yet.");
      return;
    }

    if (!ALLOWED_VIDEO_TYPES.has(file.type)) {
      setError(`Unsupported file type: ${file.name}. Please upload an MP4, MOV, or WebM video.`);
      return;
    }

    if (file.size > MAX_VIDEO_BYTES) {
      setError(`${file.name} is too large (${formatBytes(file.size)}). Maximum video size is 30 MB.`);
      return;
    }

    setPending(true);

    try {
      const { durationSeconds } = await getVideoMetadata(file);

      if (durationSeconds > MAX_DURATION_SECONDS) {
        const mins = Math.floor(durationSeconds / 60);
        const secs = Math.round(durationSeconds % 60);
        setError(`Video is too long (${mins}:${String(secs).padStart(2, "0")}). Maximum duration is 2 minutes.`);
        setPending(false);
        return;
      }

      setStatus("Generating thumbnail…");
      const thumbnail = await captureFirstFrame(file);
      const thumbnailFile = new File([thumbnail.blob], "thumbnail.jpg", {
        type: "image/jpeg",
        lastModified: Date.now(),
      });

      setStatus("Requesting upload slots…");
      const intentResponse = await fetch(
        `/api/portal/listings/${encodeURIComponent(listingId)}/video/upload-intent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName: file.name, contentType: file.type }),
        },
      );

      const intentPayload = await intentResponse.json().catch(() => null);

      if (!intentResponse.ok) {
        throw new Error(intentPayload?.error || "Could not create video upload intents.");
      }

      const videoIntent = intentPayload.videoIntent as UploadIntent;
      const thumbnailIntent = intentPayload.thumbnailIntent as UploadIntent;

      setStatus("Uploading video…");
      const videoFormData = new FormData();
      videoFormData.append("token", videoIntent.token);
      videoFormData.append("file", file);

      const videoUploadResponse = await fetch(videoIntent.uploadUrl, {
        method: "POST",
        body: videoFormData,
      });
      const videoUploadPayload = (await videoUploadResponse.json().catch(() => null)) as UploadedMediaPayload | null;

      if (!videoUploadResponse.ok) {
        throw new Error((videoUploadPayload as { error?: string })?.error || `Could not upload ${file.name}.`);
      }

      const uploadedVideoUrl = videoUploadPayload?.videoUrl ?? videoUploadPayload?.imageUrl ?? "";
      const videoStorageKey = videoUploadPayload?.storageKey ?? "";

      setStatus("Uploading thumbnail…");
      const thumbFormData = new FormData();
      thumbFormData.append("token", thumbnailIntent.token);
      thumbFormData.append("file", thumbnailFile);
      thumbFormData.append("width", String(thumbnail.width));
      thumbFormData.append("height", String(thumbnail.height));

      const thumbUploadResponse = await fetch(thumbnailIntent.uploadUrl, {
        method: "POST",
        body: thumbFormData,
      });
      const thumbUploadPayload = (await thumbUploadResponse.json().catch(() => null)) as UploadedMediaPayload | null;

      if (!thumbUploadResponse.ok) {
        throw new Error((thumbUploadPayload as { error?: string })?.error || "Could not upload thumbnail.");
      }

      const thumbnailUrl = thumbUploadPayload?.imageUrl ?? "";
      const thumbnailStorageKey = thumbUploadPayload?.storageKey ?? "";

      setStatus("Saving…");
      const saveResponse = await fetch(
        `/api/portal/listings/${encodeURIComponent(listingId)}/video`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            videoUrl: uploadedVideoUrl,
            videoStorageKey,
            thumbnailUrl: thumbnailUrl || undefined,
            thumbnailStorageKey: thumbnailStorageKey || undefined,
            durationSeconds,
            contentType: file.type,
            fileSizeBytes: file.size,
          }),
        },
      );

      const savePayload = await saveResponse.json().catch(() => null);

      if (!saveResponse.ok) {
        throw new Error(savePayload?.error || "Could not save video.");
      }

      setVideo(savePayload.video as ListingVideo);
      setStatus("Video uploaded.");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Could not upload video.");
    } finally {
      setPending(false);
    }
  }

  async function handleRemove() {
    setError(null);
    setStatus(null);
    setPending(true);

    try {
      const response = await fetch(`/api/portal/listings/${encodeURIComponent(listingId)}/video`, {
        method: "DELETE",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || "Could not remove the listing video.");
      }

      setVideo(undefined);
      setStatus("Video removed.");
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Could not remove the listing video.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className={styles.mediaSection}>
      <div className={styles.mediaHeader}>
        <div>
          <h2 className={styles.mediaTitle}>Listing video</h2>
          <div className={styles.mediaBody}>
            One optional video per listing. Maximum 2 minutes and 30 MB. MP4, MOV, or WebM.
          </div>
        </div>
        {video ? <div className={styles.mediaMeta}>1 / 1 uploaded</div> : <div className={styles.mediaMeta}>0 / 1 uploaded</div>}
      </div>

      {error ? <div className={styles.mediaError}>{error}</div> : null}
      {status ? <div className={styles.mediaStatus}>{status}</div> : null}

      {!video ? (
        <div className={styles.mediaActions}>
          <input
            accept="video/mp4,video/quicktime,video/webm"
            className={styles.mediaInput}
            disabled={pending || !uploadEnabled}
            onChange={handleFileSelection}
            ref={inputRef}
            type="file"
          />
          <button
            className={styles.mediaButton}
            disabled={pending || !uploadEnabled}
            onClick={() => inputRef.current?.click()}
            type="button"
          >
            {pending ? "Uploading…" : "Add video"}
          </button>
          <div className={styles.mediaHint}>
            {uploadEnabled
              ? "Optional. Appears at the end of the photo gallery. Not required to publish."
              : "Listing video upload is not configured yet."}
          </div>
        </div>
      ) : (
        <div className={styles.mediaGrid}>
          <article className={styles.mediaCard} style={{ gridColumn: "1 / -1" }}>
            {video.thumbnailUrl ? (
              <div className={styles.mediaThumbWrap}>
                <img alt="Video thumbnail" className={styles.mediaThumb} src={video.thumbnailUrl} />
              </div>
            ) : null}
            <div className={styles.mediaCardBody}>
              <div className={styles.mediaCardMeta}>
                Video
                {video.durationSeconds ? ` · ${formatDuration(video.durationSeconds)}` : ""}
                {video.fileSizeBytes ? ` · ${formatBytes(video.fileSizeBytes)}` : ""}
              </div>
              <div className={styles.mediaCardStatus}>{video.status}</div>
            </div>
            <div className={styles.mediaCardActions}>
              <button
                className={styles.mediaRemove}
                disabled={pending}
                onClick={handleRemove}
                type="button"
              >
                Remove
              </button>
            </div>
          </article>
        </div>
      )}
    </section>
  );
}

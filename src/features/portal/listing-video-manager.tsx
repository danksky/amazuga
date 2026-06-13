"use client";
/* eslint-disable @next/next/no-img-element */

import { useRef, useState, type ChangeEvent } from "react";

import styles from "./listing-form.module.css";

interface ListingVideo {
  id: string;
  streamUid?: string;
  videoUrl: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
  contentType?: string;
  fileSizeBytes?: number;
  status: "ready" | "pending_delete" | "delete_failed";
}

const MAX_VIDEO_BYTES = 30 * 1024 * 1024; // 30 MB
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
      setStatus("Requesting upload slot…");
      const intentResponse = await fetch(
        `/api/portal/listings/${encodeURIComponent(listingId)}/video/upload-intent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            contentType: file.type,
            fileSizeBytes: file.size,
          }),
        },
      );

      const intentPayload = await intentResponse.json().catch(() => null);

      if (!intentResponse.ok) {
        throw new Error(intentPayload?.error || "Could not create a video upload URL.");
      }

      const streamUid = typeof intentPayload?.streamUid === "string" ? intentPayload.streamUid : "";
      const uploadURL = typeof intentPayload?.uploadURL === "string" ? intentPayload.uploadURL : "";

      if (!streamUid || !uploadURL) {
        throw new Error("Cloudflare did not return a valid video upload URL.");
      }

      setStatus("Uploading video…");
      const uploadBody = new FormData();
      uploadBody.append("file", file, file.name);
      const videoUploadResponse = await fetch(uploadURL, {
        method: "POST",
        body: uploadBody,
      });

      if (!videoUploadResponse.ok) {
        const details = await videoUploadResponse.text().catch(() => "");
        throw new Error(details || `Could not upload ${file.name}.`);
      }

      setStatus("Saving…");
      const saveResponse = await fetch(
        `/api/portal/listings/${encodeURIComponent(listingId)}/video`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ streamUid }),
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
            One optional video per listing. Maximum 30 MB. MP4, MOV, or WebM.
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
            {video.streamUid ? (
              <div className={styles.mediaThumbWrap}>
                <iframe
                  allow="fullscreen; picture-in-picture"
                  allowFullScreen
                  className={styles.mediaStream}
                  src={`https://iframe.videodelivery.net/${encodeURIComponent(video.streamUid)}?muted=true&controls=true&playsinline=true`}
                  title="Listing video"
                />
              </div>
            ) : video.thumbnailUrl ? (
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

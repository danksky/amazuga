import "server-only";

import { randomUUID } from "node:crypto";

import { deleteListingImageFromStorage } from "./listing-image-storage";
import { getPgPool } from "./postgres";

type CleanupJobStatus = "pending" | "processing" | "failed" | "completed";
type ListingImageLifecycleStatus = "ready" | "processing" | "failed" | "pending_delete" | "delete_failed";

interface ListingImageCleanupJobRow {
  id: string;
  image_id: string;
  listing_id: string;
  storage_key: string;
  uploaded_by_user_id: string | null;
  status: CleanupJobStatus;
  attempt_count: number | string;
}

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined) {
    return undefined;
  }

  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function getRetryDelayMinutes(attemptCount: number) {
  return Math.min(60, Math.max(5, 2 ** Math.min(attemptCount, 5)));
}

async function markJobCompleted(jobId: string, imageId: string, listingId: string) {
  const client = await getPgPool().connect();

  try {
    await client.query("BEGIN");
    await client.query(
      `
        DELETE FROM listing_image
        WHERE id = $1
          AND listing_id = $2
          AND status IN ('pending_delete', 'delete_failed')
      `,
      [imageId, listingId],
    );
    await client.query(
      `
        UPDATE listing_image_cleanup_job
        SET status = 'completed',
            completed_at = NOW(),
            locked_at = NULL,
            last_error = NULL,
            updated_at = NOW()
        WHERE id = $1
      `,
      [jobId],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function markJobFailed(job: ListingImageCleanupJobRow, errorMessage: string) {
  const attemptCount = toNumber(job.attempt_count) ?? 1;
  const retryDelayMinutes = getRetryDelayMinutes(attemptCount);
  const client = await getPgPool().connect();

  try {
    await client.query("BEGIN");
    await client.query(
      `
        UPDATE listing_image
        SET status = 'delete_failed'
        WHERE id = $1
          AND listing_id = $2
          AND status = 'pending_delete'
      `,
      [job.image_id, job.listing_id],
    );
    await client.query(
      `
        UPDATE listing_image_cleanup_job
        SET status = 'failed',
            locked_at = NULL,
            last_error = $2,
            run_after = NOW() + ($3::TEXT || ' minutes')::INTERVAL,
            updated_at = NOW()
        WHERE id = $1
      `,
      [job.id, errorMessage.slice(0, 500), String(retryDelayMinutes)],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function processCleanupJob(job: ListingImageCleanupJobRow) {
  try {
    await deleteListingImageFromStorage({
      listingId: job.listing_id,
      imageId: job.image_id,
      storageKey: job.storage_key,
      userId: job.uploaded_by_user_id || "system-cleanup",
    });
    await markJobCompleted(job.id, job.image_id, job.listing_id);
    return { ok: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown storage delete failure";
    await markJobFailed(job, message);
    return { ok: false as const, error: message };
  }
}

async function claimCleanupJobs(limit: number) {
  const result = await getPgPool().query<ListingImageCleanupJobRow>(
    `
      WITH picked AS (
        SELECT id
        FROM listing_image_cleanup_job
        WHERE status IN ('pending', 'failed')
          AND run_after <= NOW()
        ORDER BY run_after ASC, created_at ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE listing_image_cleanup_job job
      SET status = 'processing',
          locked_at = NOW(),
          attempt_count = attempt_count + 1,
          updated_at = NOW()
      FROM picked
      WHERE job.id = picked.id
      RETURNING
        job.id,
        job.image_id,
        job.listing_id,
        job.storage_key,
        job.uploaded_by_user_id,
        job.status,
        job.attempt_count
    `,
    [limit],
  );

  return result.rows;
}

export async function queueListingImageCleanupJob(input: {
  imageId: string;
  listingId: string;
  storageKey: string;
  uploadedByUserId?: string | null;
}) {
  const result = await getPgPool().query<{ id: string }>(
    `
      INSERT INTO listing_image_cleanup_job (
        id,
        image_id,
        listing_id,
        storage_key,
        uploaded_by_user_id,
        status,
        run_after
      )
      VALUES ($1, $2, $3, $4, $5, 'pending', NOW())
      ON CONFLICT (storage_key)
      DO UPDATE
      SET status = 'pending',
          run_after = NOW(),
          locked_at = NULL,
          last_error = NULL,
          updated_at = NOW(),
          uploaded_by_user_id = COALESCE(EXCLUDED.uploaded_by_user_id, listing_image_cleanup_job.uploaded_by_user_id)
      RETURNING id
    `,
    [randomUUID(), input.imageId, input.listingId, input.storageKey, input.uploadedByUserId || null],
  );

  return result.rows[0]?.id ?? null;
}

export async function attemptListingImageCleanupNow(jobId: string) {
  const result = await getPgPool().query<ListingImageCleanupJobRow>(
    `
      UPDATE listing_image_cleanup_job
      SET status = 'processing',
          locked_at = NOW(),
          attempt_count = attempt_count + 1,
          updated_at = NOW()
      WHERE id = $1
        AND status IN ('pending', 'failed')
      RETURNING
        id,
        image_id,
        listing_id,
        storage_key,
        uploaded_by_user_id,
        status,
        attempt_count
    `,
    [jobId],
  );

  const job = result.rows[0];

  if (!job) {
    return { attempted: false, completed: false };
  }

  const outcome = await processCleanupJob(job);
  return {
    attempted: true,
    completed: outcome.ok,
    error: outcome.ok ? undefined : outcome.error,
  };
}

export async function runListingImageCleanupBatch(limit = 20) {
  const jobs = await claimCleanupJobs(limit);
  const summary = {
    claimed: jobs.length,
    completed: 0,
    failed: 0,
  };

  for (const job of jobs) {
    const outcome = await processCleanupJob(job);
    if (outcome.ok) {
      summary.completed += 1;
    } else {
      summary.failed += 1;
    }
  }

  return summary;
}

export type { CleanupJobStatus, ListingImageLifecycleStatus };

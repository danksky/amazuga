-- Rename national_id_photo_url → national_id_photo_key.
-- The column now stores an R2 object key (e.g. "agent-id-photos/{uuid}/gallery.jpg")
-- rather than a public URL, because ID photos are stored in a private bucket and
-- accessed server-side through the /api/admin/id-photo/[...key] proxy route.
ALTER TABLE agent_application
  RENAME COLUMN national_id_photo_url TO national_id_photo_key;

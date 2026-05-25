-- Demote active listings with no ready images back to draft.
-- A listing should not be live without at least one ready photo.
UPDATE listing
SET status = 'draft'
WHERE status = 'active'
  AND NOT EXISTS (
    SELECT 1
    FROM listing_image
    WHERE listing_image.listing_id = listing.id
      AND listing_image.status = 'ready'
  );

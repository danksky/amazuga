-- Update display_id and display_id_base to "Parcel Village, Sector" format.
-- e.g. "3996-A Kabeza, Gatenga" — parcel number leads, village follows without
-- punctuation, sector appended with a comma like a city in a street address.
-- Rows with null sector fall back to the original value unchanged.

UPDATE parcel_app_ready_seed_preview
SET
  display_id = CASE
    WHEN sector IS NOT NULL AND display_id IS NOT NULL
    THEN CONCAT(split_part(display_id, ' · ', 3), ' ', village, ', ', sector)
    ELSE display_id
  END,
  display_id_base = CASE
    WHEN sector IS NOT NULL AND display_id_base IS NOT NULL
    THEN CONCAT(split_part(display_id_base, ' · ', 3), ' ', village, ', ', sector)
    ELSE display_id_base
  END
WHERE display_id IS NOT NULL;

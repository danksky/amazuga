BEGIN;

UPDATE app_user
SET
  mock_persona_label = 'Prospective agent',
  mock_persona_description = 'Has not applied yet and should start the sell flow from scratch.',
  updated_at = NOW()
WHERE id = 'user-3';

COMMIT;

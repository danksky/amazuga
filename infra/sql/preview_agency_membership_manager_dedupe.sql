BEGIN;

DELETE FROM agency_membership agent_membership
USING agency_membership manager_membership
WHERE agent_membership.agency_id = manager_membership.agency_id
  AND agent_membership.user_id = manager_membership.user_id
  AND agent_membership.status = 'active'
  AND manager_membership.status = 'active'
  AND agent_membership.role = 'agent'
  AND manager_membership.role = 'manager';

COMMIT;

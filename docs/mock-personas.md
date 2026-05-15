# Mock Personas

These local test accounts are now seeded into preview DB `app_user` rows and can be used from the mock auth screens without passwords.

The JSON files in `data/` are now reference material only for these personas and associated workflow fixtures. The app runtime should use preview DB state instead.

## Personas

- `daniel.kawalsky@gmail.com`
  - Admin
  - Reviews agency, agent, valuator, and valuation submissions

- `buyer@amazuga.test`
  - Consumer
  - Standard user with saved properties for testing the normal browsing journey

- `new.agent@amazuga.test`
  - New agent applicant
  - No approvals or existing applications; should start from the shared applications hub

- `pending.founder@amazuga.test`
  - Pending agency founder
  - Has a pending agency registration request and no approved agent status yet

- `manager@amazuga.test`
  - Approved agency manager
  - Approved as both agent and agency manager
  - Associated with the approved `Kigali Homes Group` agency and its listings

- `pending.valuator@amazuga.test`
  - Pending valuator
  - Has a pending valuator recognition request and should only see application status

- `valuator@amazuga.test`
  - Approved valuator
  - Has approved valuator recognition, seeded valuation history, and live portal submission access

## Associated records

- `buyer@amazuga.test`
  - Saved properties:
    - `AF49552697`
    - `50714AA28F`

- `pending.founder@amazuga.test`
  - Pending agency application: `agency-application-1`

- `manager@amazuga.test`
  - Approved agency application: `agency-application-2`
  - Approved agent application: `agent-application-1`
  - Active agency: `agency-1`
  - Active listing agent for the Preview-backed agency listing cohort, including `listing-1` through `listing-15`

- `pending.valuator@amazuga.test`
  - Pending valuator application: `valuator-application-1`
  - No valuation submission access until approval

- `valuator@amazuga.test`
  - Approved valuator application: `valuator-application-2`
  - Approved valuation submissions: `valuation-1`, `valuation-2`
  - Can create new pending valuation submissions from `/portal/valuations/new`

## Current flow notes

- Business and professional onboarding now runs through the shared `/advertise` applications hub rather than separate `Advertise` and `Assess` entry experiences.
- Approved agency users should land in the portal listings workspace.
- Approved valuators should land in the valuations workspace and can submit new valuation records for admin review.
- Admin valuation approval affects both the valuator portal history and the public property page valuation history.

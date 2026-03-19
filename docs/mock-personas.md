# Mock Personas

These local test accounts are stored in `data/users.json` and can be used from the mock auth screens without passwords.

## Personas

- `daniel.kawalsky@gmail.com`
  - Admin
  - Reviews agency, agent, and valuator submissions

- `buyer@amazuga.test`
  - Consumer
  - Standard user with saved properties for testing the normal browsing journey

- `new.agent@amazuga.test`
  - New agent applicant
  - No approvals or existing applications; should start the advertise flow from scratch

- `pending.founder@amazuga.test`
  - Pending agency founder
  - Has a pending agency registration request and no approved agent status yet

- `manager@amazuga.test`
  - Approved agency manager
  - Approved as both agent and agency manager
  - Associated with the approved `Kigali Homes Group` agency and its listings

- `pending.valuator@amazuga.test`
  - Pending valuator
  - Has a pending valuator recognition request

- `valuator@amazuga.test`
  - Approved valuator
  - Has approved valuator recognition and seeded valuation history

## Associated records

- `buyer@amazuga.test`
  - Saved properties: `property-1`, `property-2`, `property-3`

- `pending.founder@amazuga.test`
  - Pending agency application: `agency-application-1`

- `manager@amazuga.test`
  - Approved agency application: `agency-application-2`
  - Approved agent application: `agent-application-1`
  - Active agency: `agency-1`
  - Active listing agent for `listing-1` through `listing-8`

- `pending.valuator@amazuga.test`
  - Pending valuator application: `valuator-application-1`

- `valuator@amazuga.test`
  - Approved valuator application: `valuator-application-2`
  - Approved valuation submissions: `valuation-1`, `valuation-2`, `valuation-3`

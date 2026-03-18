# Amazuga Product Spec

## Product Shape

Amazuga is a Rwanda-focused property platform with a Zillow-like browse experience, a canonical property model, authenticated UPI lookup, and role-based business workflows for agents, agency managers, valuators, and admins.

The product should prioritize:

- Geist-style visual language
- intentional component reuse
- mobile-native screen composition
- restrained styling over bespoke UI
- canonical property pages instead of fragmented listing-first UX

## Core Principles

- `Property` is the primary user-facing object.
- A property page exists whether or not the property is actively listed.
- A property can have many historical listings, but only one active listing at a time.
- A property can have many valuation submissions over time.
- Approved valuations become public valuation history.
- UPI is operational lookup input, not a public-facing field.
- Search is the single entry point for public browse and authenticated UPI lookup.

## Geography

- Rwanda only
- UPI is globally unique within Rwanda

## Public Product Areas

- Browse homes for sale
- Browse homes for rent
- View property pages
- View area pages
- View agency profiles
- View agent profiles
- View valuator profiles

## Authenticated User Capabilities

- Save properties
- Search by UPI through the main search bar
- Apply to become an agent
- Apply to become a recognized valuator
- Submit a new agency for review

## Business Roles

### Agent

- Must be approved by admin
- Approval requires National ID photo
- Can belong to only one agency at a time
- Can create and edit listings for their agency

### Agency Manager

- Primary controlling role for an agency
- Agency creator becomes initial manager
- Can add and remove agents from their agency
- Can approve join requests
- Can invite users to join or switch agencies
- Can transfer manager role to another agent in the same agency
- Cannot leave while the agency still has other agents or active listings

### Valuator

- Must be approved by admin
- Approval requires IRPV registration number
- Can submit valuation proposals
- Can revise by submitting new valuation records rather than editing in place
- Can also be an agent

### Admin

- Hard-coded to `daniel.kawalsky@gmail.com` in v1
- Reviews and moderates everything in v1

## Agency Rules

- Agencies require admin approval before they are joinable
- Agency creation requires business name and TIN
- Website is optional
- Google Maps listing is optional
- No logo, branding, registration docs, assigned territory, or proof-of-compliance requirements in v1
- Join flow is request-based or invite-based

## Property Rules

- Canonical property records are seeded manually
- Properties also have Amazuga-generated IDs
- Public property pages should not expose UPI
- Search may internally resolve a UPI to a property for signed-in users
- UPI lookups should be rate-limited to about `20/day/user`

## Listing Rules

- Public browse centers on properties, not separate public listing pages
- Listing data appears on the property page when there is an active listing
- Internal listing views may exist in portal/admin surfaces
- Listings created by approved agents/managers go live immediately
- Use `active` and `inactive`, not `archived`

## Valuation Rules

- Valuation submission shape in v1 is intentionally small:
  - property reference
  - date
  - value
- Approved valuations become public
- Public valuation history appears on the property page
- Future versions may add comps, reports, house features, and reviewer-specific roles

## Search Behavior

- `/` should redirect to `/buy`
- `/buy` and `/rent` are the primary public browse surfaces
- These surfaces combine:
  - top navigation
  - search bar
  - filters
  - map
  - results list
- There should not be a standalone public UPI page
- The search bar should detect UPI input for signed-in users and resolve to a property

## Top Navigation

Primary browse/navigation should stay restrained.

Role entry CTAs:

- `Advertise`
- `Assess`

`Advertise` behavior:

- if already an approved agent or agency manager, route to portal
- otherwise route to a chooser with:
  - `I belong to an agency`
  - `I manage an agency`

`Assess` behavior:

- if already an approved valuator, route to valuation portal
- otherwise route to valuator onboarding

## Property Page Behavior

### Listed property

Show:

- property identity
- parcel map/outline
- active listing summary
- property facts
- valuation history

### Non-listed property

Show:

- property identity
- parcel map/outline
- non-listed state
- `Claim this home`
- valuation history

The downstream claim workflow is intentionally undefined in v1 and can start as a placeholder flow.

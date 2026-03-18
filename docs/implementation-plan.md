# Amazuga Implementation Plan

## Goals

- Keep the first implementation disciplined and reusable.
- Establish a small, Geist-aligned component system before page sprawl.
- Treat docs and domain types as implementation contracts.
- Standardize the project runtime on Node `20.19.6` via `nvm`.

## Recommended Directory Structure

```text
docs/
  product-spec.md
  route-map.md
  implementation-plan.md

src/
  app/
  components/
    ui/
    layout/
    navigation/
    search/
    property/
    agency/
    person/
    portal/
    admin/
    forms/
    map/
  features/
    auth/
    browse/
    properties/
    agencies/
    agents/
    valuators/
    valuations/
    portal/
    admin/
  lib/
    navigation.ts
    routes.ts
  types/
    domain.ts
    permissions.ts
```

## Runtime Baseline

- Use `nvm` with Node `20.19.6`
- Pin framework dependencies rather than using `latest`
- Treat Node and package versions as part of the repo contract

## Build Phases

### Phase 1: Foundation

- create route groups and layout shells
- establish theme tokens and spacing rules
- define core TypeScript domain models
- define route constants and navigation model
- seed mock data for properties, listings, agencies, agents, and valuations

### Phase 2: Public Browse

- implement `/buy` and `/rent`
- shared search bar
- shared filter bar
- map and results layout
- placeholder property cards

### Phase 3: Property Surface

- implement `/property/[propertyId]`
- listed and non-listed states
- parcel outline/map section
- valuation history
- claim-this-home state

### Phase 4: Account and Auth

- sign in/up
- account page
- saved properties
- role application entry points

### Phase 5: Onboarding

- agent approval flow
- agency creation flow
- valuator recognition flow

### Phase 6: Portal

- role-aware portal overview
- listing management
- valuation management
- agency management
- membership management

### Phase 7: Admin

- admin overview
- review queues
- approve/deny workflows

## Key Architectural Rules

- Prefer composition over page-specific components.
- Keep one shared search bar surface across browse routes.
- Keep one shared property detail surface for listed and non-listed properties.
- Keep one shared status vocabulary across public, portal, and admin surfaces.
- Do not surface UPI publicly.
- Do not create a separate public listing page in v1.

## Open Future Features

These are intentionally out of scope for the first build:

- claim-home full workflow
- valuator levels
- focus territories
- valuation reviewer role separate from admin
- comps tooling
- report generation
- broader property-search modes beyond listing search and authenticated UPI lookup

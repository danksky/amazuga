# Preview DB Consolidation Plan

This document sketches the first DB-backed replacement for the current mock property and listing layer.

## Why This Exists

The app currently mixes two different property sources:

- `parcel_app_ready_seed_preview` for parcel identity and UPI lookup
- JSON mock files for listings, agencies, valuations, and most user-linked behavior

That creates conflicts like:

- preview property routes that accept real `public_id` or `parcel_id`
- mock listing records that point at fake IDs like `property-1`
- preview auth and ownership flows that still rely on file-backed users

The goal of this plan is to make preview listings belong to real parcel rows and real preview users without forcing the UI cutover yet.

## Target Model

Keep the parcel seed table as the base property catalog:

- `parcel_app_ready_seed_preview`

Add app-owned tables around it:

- `app_user`
- `agency`
- `agency_membership`
- `property_profile`
- `listing`
- `listing_image`

This keeps the parcel pipeline and the listing app concerns separate.

## Identifier Strategy

- `parcel_id`
  - internal stable join key
  - should be used for app relations
- `public_id`
  - public-safe property route key
  - should remain the route identifier for `/property/[propertyId]`
- `upi`
  - lookup-only input for authenticated search
  - should not be used as the relational key for listings

## Table Roles

### `app_user`

Stores preview users that own or manage listings.

Needed for:

- listing ownership
- agency management
- later auth cutover
- later saved properties and valuations

### `agency`

Stores approved agencies that can publish listings.

Important fields:

- `manager_user_id`
- `pending_manager_user_id`
- `slug`
- `status`

### `agency_membership`

Normalizes membership instead of storing arrays in the DB.

Important fields:

- `agency_id`
- `user_id`
- `role`
- `status`

### `property_profile`

Stores app-owned details that do not belong in the parcel seed table.

Examples:

- marketing title
- narrative description
- bedrooms
- bathrooms
- interior area
- year built
- property type

Keyed by:

- `parcel_id`

### `listing`

Stores the active sale or rent offer for a parcel.

Important fields:

- `parcel_id`
- `agency_id`
- `agent_user_id`
- `marketing_type`
- `status`
- `asking_price_rwf`
- `headline`
- `description`

Rules:

- one active listing per parcel
- many historical inactive listings allowed

### `listing_image`

Stores ordered images for a listing.

Preview can safely use:

- `picsum.photos` URLs

## Why `property_profile` Exists

The parcel source should stay focused on parcel identity, geometry, and land facts. It should not become the place where we write app-specific marketing fields. A profile table lets us enrich a parcel for marketplace use without mutating the upstream parcel contract.

## Why There Is No FK To The Parcel Seed Table Yet

The repo currently treats `parcel_app_ready_seed_preview` as a working seed table rather than a formal app migration target. Because of that, the first DB-backed listing tables should join to `parcel_id` by convention and indexes, but avoid hard foreign keys until the parcel table has a formal app-owned schema lifecycle.

## Suggested Preview Seed Shape

Seed:

- 4 preview users
- 1 approved agency
- 2 agency memberships
- 8 real Kigali parcel-backed property profiles
- 8 active listings
- 16 placeholder listing images

Use Kigali parcels from:

- `Gasabo`
- `Kicukiro`
- `Nyarugenge`

Prefer:

- `inventory_status = 'approved'`
- rows with `sector` and centroid data present
- rows without conflicting active listings from another seed source

The first seed script currently auto-selects the first 8 eligible Kigali parcels ordered by:

- `district`
- `sector`
- `public_id`

and uses deterministic listing IDs derived from `public_id` so the seed can be re-run safely.

## Seed Provenance

Every seeded record should carry:

- `seed_source`

For the first batch:

- `preview_kigali_seed_v1`

That makes cleanup and re-seeding straightforward.

## Recommended Rollout

1. Apply the preview schema SQL.
2. Run the Kigali preview seed SQL.
3. Verify seeded rows manually in preview DB.
4. Add a DB repository that joins parcel rows to profile, listing, image, agency, and user data.
5. Switch public browse and property pages to that repository.
6. Move auth from file-backed users to preview DB users.
7. Remove `src/lib/mock-data.ts` usage from runtime paths.

## Scope Boundary

This plan intentionally does not:

- cut the UI over yet
- replace the parcel ingest pipeline
- formalize real auth
- migrate applications or valuations yet

Those can follow once browse and property surfaces are using real preview records.

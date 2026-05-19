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
- `property_asset`
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
- `property_asset.id`
  - internal stable identifier for the marketable asset
  - should support cases where one parcel contains many units
- `property_asset.display_code`
  - app-owned stable identifier for units or sub-properties when no reliable external sub-parcel identifier exists

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

This is a good fit for parcel-level or building-level enrichment, but not sufficient on its own for many separately marketable units on one parcel.

### `property_asset`

Stores the app-owned real estate object that can be listed, owned, claimed, or valued.

Examples:

- standalone house on a parcel
- vacant land parcel
- apartment building
- apartment unit
- commercial suite

Important fields:

- `id`
- `parcel_id`
- `asset_type`
- `parent_asset_id`
- `display_code`
- `title`
- `description`

Rules:

- one parcel can have many assets
- assets can form a hierarchy, such as building -> apartment unit
- unit and suite records should live here instead of overloading the parcel row

### `listing`

Stores the active sale or rent offer for a marketable asset.

Important fields:

- `property_asset_id`
- `agency_id`
- `agent_user_id`
- `marketing_type`
- `status`
- `asking_price_rwf`
- `description`

Rules:

- one active listing per asset
- many historical inactive listings allowed

### `listing_image`

Stores ordered images for a listing.

Preview can safely use:

- `picsum.photos` URLs

## Why `property_profile` Exists

The parcel source should stay focused on parcel identity, geometry, and land facts. It should not become the place where we write app-specific marketing fields. A profile table lets us enrich a parcel for marketplace use without mutating the upstream parcel contract.

## Why `property_asset` Should Exist

The parcel model is necessary but not sufficient. It identifies land, not every marketable thing that may exist on that land. A `property_asset` layer lets the app represent apartments, suites, and other sub-parcel inventory without forcing the parcel seed table to solve unit identity.

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

Current named cohorts:

- `mock_import_listing_surface_v1`
  - Imported older app mock listings onto real parcel-backed preview rows.
  - Main purpose: preserve the older residential mock catalog while moving identity onto parcel/property records.

- `preview_property_page_variants_v1`
  - Supplemental property-page validation cohort.
  - Main purpose: add `land`, `building`, `commercial_unit`, and unlisted examples that the older mock catalog does not cover.

- `preview_kigali_seed_v1`
  - Original curated Kigali seed script.
  - Remains useful as a reseedable fixture, but should be treated as a separate cohort rather than assumed live preview state.

Each cohort should keep a paired cleanup script so preview DB state can be reset intentionally instead of leaving stray records behind.

## Recommended Rollout

1. Apply the preview schema SQL.
2. Run the Kigali preview seed SQL.
3. Verify seeded rows manually in preview DB.
4. Add a DB repository that joins parcel rows to profile, listing, image, agency, and user data.
5. Add `property_asset` so multi-unit parcels have first-class app identity.
6. Switch listings, ownership, and valuations to attach to assets.
7. Switch public browse and property pages to an asset-aware repository.
8. Preserve parcel context on property pages for map and land facts.
9. Move auth from file-backed users to preview DB users.
10. Remove any remaining JSON-backed runtime stores and leave `data/*.json` as reference-only fixtures.

## Scope Boundary

This plan intentionally does not:

- cut the UI over yet
- replace the parcel ingest pipeline
- formalize real auth
- migrate applications or valuations yet

Those can follow once browse and property surfaces are using real preview records.

# Mock To Preview Seed Mapping

This document maps the current mock JSON data model to the proposed preview DB seed model.

Use it as the checklist for:

- building one-off migration scripts
- validating seed outputs
- deciding what should not be copied forward

## Goal

Move preview/dev listing data off fake property IDs like `property-1` and onto real parcel-backed records from `parcel_app_ready_seed_preview`.

## Core Rule

For listing cutover:

- copy user, agency, listing, and descriptive property fields
- do not copy mock property identity fields directly
- attach seeded property and listing content to real preview `parcel_id` values

## Identity Mapping

### Property Identity

Mock property records currently combine:

- parcel identity
- parcel geometry
- listing state
- home facts
- marketing copy

In preview DB, those concerns split apart:

- parcel identity comes from `parcel_app_ready_seed_preview`
- home facts and marketing copy go into `property_profile`
- listing state comes from `listing`

That means these mock fields are not copied directly:

- `properties[].id`
- `properties[].activeListingId`
- `properties[].valuationHistoryIds`
- `properties[].listingState`

### User Identity

Mock `user-*` IDs can be preserved as seed IDs if we want a simple first pass. The safer long-term model is:

- keep deterministic seed IDs for preview fixtures
- stop depending on file-only IDs once auth becomes DB-backed

## Table Mapping

## `app_user`

Source:

- [data/users.json](/Users/danielkawalsky/Documents/Code/AfricaPropertyPortal/amazuga/data/users.json)

Target:

- `app_user`

| Mock field | Preview column | Action | Notes |
|---|---|---|---|
| `id` | `id` | copy or replace with deterministic seed ID | For first pass, deterministic preview IDs are preferable |
| `email` | `email` | copy | Should remain unique |
| `fullName` | `full_name` | copy | Direct rename |
| `roles` | `roles` | copy | Array shape can stay |
| `avatarUrl` | `avatar_url` | copy if present | Optional |
| `mockPersonaLabel` | none | drop | Mock-only UI aid |
| `mockPersonaDescription` | none | drop | Mock-only UI aid |
| `savedPropertyIds` | none in first pass | defer | Do not seed until saved properties point at real parcel-backed property routes |
| `upiLookupCountToday` | none in first pass | drop or defer | Runtime/account metric, not needed for initial listing cutover |

## `agency`

Source:

- [data/agencies.json](/Users/danielkawalsky/Documents/Code/AfricaPropertyPortal/amazuga/data/agencies.json)

Target:

- `agency`

| Mock field | Preview column | Action | Notes |
|---|---|---|---|
| `id` | `id` | copy or replace with deterministic seed ID | The preview SQL currently uses deterministic seed IDs |
| `slug` | `slug` | copy | Public-safe agency identifier |
| `businessName` | `business_name` | copy | Direct rename |
| `tin` | `tin` | copy | Direct copy |
| `whatsappPhone` | `whatsapp_phone` | copy | Optional |
| `websiteUrl` | `website_url` | copy | Optional |
| `googleMapsUrl` | `google_maps_url` | copy | Optional |
| `status` | `status` | copy | Keep current approval state |
| `pendingManagerUserId` | `pending_manager_user_id` | copy with user ID remap | Must point to seeded preview user ID |
| `managerUserId` | `manager_user_id` | copy with user ID remap | Must point to seeded preview user ID |
| `createdFromApplicationId` | none in first pass | defer | Useful later if application tables move to DB |
| `memberUserIds` | none | transform into `agency_membership` rows | Do not store as array in DB |

## `agency_membership`

Source:

- [data/agencies.json](/Users/danielkawalsky/Documents/Code/AfricaPropertyPortal/amazuga/data/agencies.json)

Target:

- `agency_membership`

| Mock field | Preview column | Action | Notes |
|---|---|---|---|
| `agency.id` | `agency_id` | copy with agency ID remap | One row per membership |
| `agency.memberUserIds[]` | `user_id` | expand to rows | One membership row per user |
| implied manager | `role` | transform | If `managerUserId` matches member, seed `manager` role |
| other members | `role` | transform | Seed `agent` role for non-manager members unless a richer source exists |
| none | `status` | seed default | Usually `active` for preview seed |

## `property_profile`

Source:

- [data/properties.json](/Users/danielkawalsky/Documents/Code/AfricaPropertyPortal/amazuga/data/properties.json)

Target:

- `property_profile`

| Mock field | Preview column | Action | Notes |
|---|---|---|---|
| `id` | none | drop | Fake mock property IDs should not survive |
| matched real parcel | `parcel_id` | transform | Must map each seeded property to a real preview parcel |
| `title` | `title` | copy | Often useful as marketing title |
| `description` | `description` | copy | Narrative property copy |
| `facts.propertyType` | `property_type` | copy | Direct mapping |
| `facts.bedrooms` | `bedrooms` | copy | Optional |
| `facts.bathrooms` | `bathrooms` | copy | Optional |
| `facts.areaSqm` | `interior_area_sqm` | copy | Interior area, not parcel area |
| `facts.yearBuilt` | `year_built` | copy | Optional |
| `facts.landAreaSqm` | none in first pass | do not copy | Parcel land area should come from parcel seed table |
| `facts.zoningLabel` | none in first pass | do not copy | Parcel zoning should come from parcel seed table |
| `location.*` | none in first pass | do not copy | Location should come from parcel seed table |
| `geometry` | none | do not copy | Geometry should come from parcel seed table / tiles |
| `upi` | none | do not copy | UPI stays in parcel seed table only |
| `listingState` | none | do not copy | Derived from listing presence |
| `activeListingId` | none | do not copy | Listing relation should be reverse joined from `listing` |
| `valuationHistoryIds` | none | defer | Later valuation backfill can attach to real parcel IDs |

## `listing`

Source:

- [data/listings.json](/Users/danielkawalsky/Documents/Code/AfricaPropertyPortal/amazuga/data/listings.json)

Target:

- `listing`

| Mock field | Preview column | Action | Notes |
|---|---|---|---|
| `id` | `id` | copy or replace with deterministic seed ID | Current preview SQL derives deterministic IDs from `public_id` |
| `propertyId` | `parcel_id` | transform | Must map fake mock property IDs to real preview parcel IDs |
| `agencyId` | `agency_id` | copy with agency ID remap | Must point at seeded preview agency |
| `agentUserId` | `agent_user_id` | copy with user ID remap | Must point at seeded preview user |
| `status` | `status` | copy | `active` and `inactive` map cleanly |
| `marketingType` | `marketing_type` | copy | `sale` or `rent` |
| `askingPrice` | `asking_price_rwf` | copy | Rename only |
| `currency` | `currency` | copy | Currently always `RWF` |
| `headline` | `headline` | copy | Direct |
| `description` | `description` | copy | Direct |
| `createdAt` | `created_at` | copy or seed fresh | Either approach is acceptable in preview |
| `updatedAt` | `updated_at` | copy or seed fresh | Either approach is acceptable in preview |
| none | `published_at` | transform | Can derive from `createdAt` or set during seeding |

## `listing_image`

Source:

- [data/listings.json](/Users/danielkawalsky/Documents/Code/AfricaPropertyPortal/amazuga/data/listings.json)

Target:

- `listing_image`

| Mock field | Preview column | Action | Notes |
|---|---|---|---|
| `listing.id` | `listing_id` | copy with listing ID remap | One row per image |
| `imageUrls[index]` | `image_url` | expand to rows | Preserve order |
| `index` | `sort_order` | transform | `0`, `1`, `2`, ... |
| none | `alt_text` | synthesize | Use headline/title-based fallback text |

## Later-Phase Tables

These mock files should not block listing cutover, but they are reasonable later seed candidates.

## `valuation_submission`

Source:

- [data/valuations.json](/Users/danielkawalsky/Documents/Code/AfricaPropertyPortal/amazuga/data/valuations.json)

Candidate target:

- `valuation_submission`

| Mock field | Preview column | Action | Notes |
|---|---|---|---|
| `id` | `id` | copy or replace | Either is fine |
| `propertyId` | `parcel_id` | transform | Cannot be copied until fake property IDs are mapped to real parcels |
| `submittedByUserId` | `submitted_by_user_id` | copy with user ID remap | Must point at seeded preview user |
| `isAnonymous` | `is_anonymous` | copy | Direct |
| `effectiveDate` | `effective_date` | copy | Direct |
| `estimatedValue` | `estimated_value_rwf` | copy | Rename only |
| `currency` | `currency` | copy | Likely stays `RWF` |
| `status` | `status` | copy | Direct |
| `createdAt` | `created_at` | copy | Direct |

## `agency_application`

Source:

- [data/agency-applications.json](/Users/danielkawalsky/Documents/Code/AfricaPropertyPortal/amazuga/data/agency-applications.json)

Candidate target:

- `agency_application`

| Mock field | Preview column | Action | Notes |
|---|---|---|---|
| `id` | `id` | copy | Direct |
| `createdByUserId` | `created_by_user_id` | copy with user ID remap | Direct after remap |
| `businessName` | `business_name` | copy | Direct |
| `tin` | `tin` | copy | Direct |
| `websiteUrl` | `website_url` | copy | Optional |
| `googleMapsUrl` | `google_maps_url` | copy | Optional |
| `status` | `status` | copy | Direct |
| `createdAt` | `created_at` | copy | Direct |

## `agent_application`

Source:

- [data/agent-applications.json](/Users/danielkawalsky/Documents/Code/AfricaPropertyPortal/amazuga/data/agent-applications.json)

Candidate target:

- `agent_application`

| Mock field | Preview column | Action | Notes |
|---|---|---|---|
| `id` | `id` | copy | Direct |
| `userId` | `user_id` | copy with user ID remap | Direct after remap |
| `nationalIdPhotoUrl` | `national_id_photo_url` | copy or replace | Current mock value is an SVG placeholder |
| `selectedAgencyId` | `selected_agency_id` | copy with agency ID remap | Direct after remap |
| `status` | `status` | copy | Direct |
| `createdAt` | `created_at` | copy | Direct |

## `valuator_application`

Source:

- [data/valuator-applications.json](/Users/danielkawalsky/Documents/Code/AfricaPropertyPortal/amazuga/data/valuator-applications.json)

Candidate target:

- `valuator_application`

| Mock field | Preview column | Action | Notes |
|---|---|---|---|
| `id` | `id` | copy | Direct |
| `userId` | `user_id` | copy with user ID remap | Direct after remap |
| `irpvRegistrationNumber` | `irpv_registration_number` | copy | Direct |
| `status` | `status` | copy | Direct |
| `createdAt` | `created_at` | copy | Direct |

## Explicitly Deferred

These fields or concepts should not be part of the first preview seed migration:

- file-backed auth cookies
- mock persona labels and descriptions
- mock property IDs
- mock saved property IDs
- mock parcel geometry
- mock parcel location fields when parcel seed data already exists
- SVG placeholder identity-document assets

## First-Pass Seed Checklist

If the goal is only to remove preview listing conflicts, the first pass should seed:

1. `app_user`
2. `agency`
3. `agency_membership`
4. `property_profile`
5. `listing`
6. `listing_image`

That is enough to replace the active mock listing surface while leaving valuations and onboarding workflows for a second pass.

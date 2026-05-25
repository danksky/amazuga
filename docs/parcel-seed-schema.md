# Parcel Seed Schema

This document describes the current working parcel table contract used by Amazuga preview.

## Current Table

The app is currently wired to a preview table named:

- `parcel_app_ready_seed_preview`

This is a seeded parcel table derived from the processed parcel pipeline in `scrape-rwanda-parcels`.

## Current Purpose

Right now this table is used for:

- property detail page lookup by `parcel_id` or `public_id`
- UPI search resolution to a property route

It is **not** yet the source of truth for listings, agencies, valuations, or browse results. Those are still using mock data.

It is also **not** sufficient by itself to represent multiple marketable units on one parcel. That should be handled by an app-owned `property_asset` layer above the parcel table.

## Current Identifier Model

- `parcel_id`
  - internal opaque parcel/property identifier
  - deterministic, non-UPI, and not intended for public map exposure
  - should be used for app-internal relations over time
  - current preview rows may derive this lazily from `upi` until the next full reload
- `public_id`
  - external-safe parcel/property identifier
  - used for public-facing parcel references, map highlighting, and current public routes
- `upi`
  - still present in the preview DB seed
  - used for search lookup
  - should not be exposed in public tile layers

For tile generation and public-facing parcel geometry, the intended safe ID is:

- `parcel_key = public_id`

## Required Columns

These are the columns the current app integration depends on:

- `upi`
- `parcel_id`
- `public_id`
- `display_id`
- `district`
- `sector`
- `cell`
- `village`
- `representative_size`
- `centroid_lon`
- `centroid_lat`
- `bbox_min_lon`
- `bbox_min_lat`
- `bbox_max_lon`
- `bbox_max_lat`
- `zoning`
- `zone_code`
- `gen_lu`
- `inventory_status`

## display_id Derivation

`display_id` encodes the human-readable parcel address in the format:

```
<parcel_number>[-<letter>] <village>, <sector>
```

Examples: `3996-A Kabeza, Gatenga`, `1 Nyanza, Kagarama`

The optional letter suffix disambiguates sibling parcels — parcels that share
the same `parcel_number` within the same `village` and `sector`. This happens
because the Rwandan UPI encodes `Province/District/Sector/Cell/ParcelNumber`,
and two parcels can share a number while sitting in different cells. When that
occurs, parcels are ranked by the cell code (4th UPI segment) ascending and
assigned letters A, B, C, … in that order.

This means `display_id` is **fully reconstructable** from columns already in
the table (`parcel_number`, `village`, `sector`, `upi`) using a window function.
It does not need to be stored. The reconstruction formula is documented and
implemented as a materialized view in:

- `infra/sql/preview_parcel_display_name_view.sql`

That view can serve as a drop-in replacement for the stored column and can be
dropped cleanly if the display name system is replaced.

## Current Semantics

- `inventory_status`
  - one of:
    - `approved`
    - `provisional`
    - `blocked`

The seeded preview table currently contains:

- `approved`
- `provisional`

and excludes:

- `blocked`

## Current App Mapping

The server-side parcel adapter currently maps a DB row into the existing `Property` domain shape like this:

- `Property.id <- parcel_id`
- `Property.publicId <- public_id`
- `Property.upi <- upi`
- `Property.title <- display_id`
- `Property.location <- district/sector/cell/village + centroid`
- `Property.facts.landAreaSqm <- representative_size`

The current `geometry` field on the app `Property` object is **not** real parcel geometry yet.
It is a placeholder polygon derived from:

- bbox if available
- otherwise a tiny square around the centroid

So the property page is DB-backed for parcel identity/location, but not yet rendering the real parcel outline from tiles or DB geometry.

## Relationship To Future Asset Modeling

The parcel table should remain the land identity source.

For multi-unit cases such as:

- apartment buildings
- apartment ownership within a shared parcel
- commercial suites within one building

the app should introduce a separate `property_asset` model keyed to `parcel_id`.

That means:

- parcel rows keep land and zoning facts
- app-owned asset rows represent the thing that can be listed or owned
- if no reliable external apartment-level identifier exists, the app should mint its own stable asset identifier

## Current Indexes

The preview DB currently uses these practical indexes:

- unique on `upi`
- unique on `parcel_id`
- unique on `public_id`
- btree on `inventory_status`
- btree on `district`
- btree on `sector`
- composite btree on `(inventory_status, district, sector)`

The reproducible SQL lives in:

- `/Users/danielkawalsky/Documents/Code/AfricaPropertyPortal/scrape-rwanda-parcels/sql/parcel_app_ready_seed_indexes.sql`

## Source Pipeline

The seed data is derived from the processed parcel pipeline in `scrape-rwanda-parcels`, especially:

- `parcel-listing-inventory.parquet`
- `parcel-app-ready.parquet`

The important policy split is:

- `approved`
- `provisional`
- `blocked`

## Known Caveats

- `nyamagabe-parcels` is excluded from the processed UPI-based parcel pipeline
- `kamonyi` and `rwamagana` can appear as `provisional` due to missing upstream DLUP
- current property pages still mix DB-backed parcel identity with mock-backed listing/valuation data

## Good Next Steps

- switch browse/search results from mock parcel arrays to DB-backed parcel queries
- wire the property page parcel map to real parcel tiles using `public_id` / `parcel_key`
- eventually formalize this table in migrations/schema files instead of relying on a seeded working table name

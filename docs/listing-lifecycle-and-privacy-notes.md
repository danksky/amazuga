# Listing Lifecycle and Privacy Notes

## Goal

Capture the current product decisions and implementation direction for:

- listing lifecycle
- relisting and campaign boundaries
- price history
- listing privacy
- archival behavior

This note is meant to be the branch-level source of truth for what has already been decided, what has already been built, and what is still intentionally unresolved.

## Core Model Tension

A listing currently behaves like two things at once:

- a marketing campaign with a start, price changes, pauses, and relaunches
- a long-lived property-linked record that should preserve history over time

That tension is the reason lifecycle and history need more structure than a single mutable listing row with a plain status toggle.

## Decisions So Far

### Price History

- Price history should be stored both within a single listing run and across relisting attempts for the same property.
- Price changes are treated as first-class history events, not just silent overwrites of the current asking price.
- The current listing row still stores the latest asking price.
- Historical prices live in an append-only `listing_price_history` table.

### Private Listing Access

- Private listings should use explicit user-level access grants.
- The sharing model is invite by user identity, currently implemented by email lookup and grant creation against a user ID.
- Private should not behave like unlisted.
- A private listing is only visible to:
  - the assigned agent
  - explicitly granted users

### Sold Status

- A distinct `sold` status is deferred for now.
- `archived` remains a generic non-public terminal state for the current branch.

### Relisting and Campaigns

- A plain deactivate/reactivate toggle is not enough if we want meaningful history.
- A relaunch after inactivity should create a new campaign boundary.
- We have not yet moved to the full model where every relist creates a brand new listing row.
- For now, the same listing row remains in place and `campaign_index` marks each new run.

## Current Status Vocabulary

The listing status model still uses:

- `draft`
- `active`
- `inactive`
- `archived`

Behavior expectations:

- `draft` is editable and non-public
- `active` is market-live
- `inactive` is paused/off-market but still open
- `archived` is a soft-delete / retired state

## Archival Behavior

Archived listings are intentionally hidden from current user-facing surfaces.

- Public browse and property-page listing surfaces do not show archived listings.
- Portal listings do not show archived listings.
- Portfolio surfaces do not show archived listings.
- Archived listings currently remain visible only in the database.

This means `archived` is functioning as a soft-delete rather than a user-visible historical state.

## What We Have Implemented

### Price History

- Added `listing_price_history`.
- Seeded existing listings with an initial history row based on their current asking price.
- Saving a changed asking price appends a new history row.
- The listing edit form shows price history.

### Private Listing Access

- Added `listing_access_grant`.
- Added server-side add/remove grant flows.
- Added private access management UI on the listing edit page.
- Enforced private listing visibility on the public property page.

### Campaign Boundaries

- Added `campaign_index` to `listing`.
- Added `campaign_index` to `listing_price_history`.
- Reactivating a listing from `inactive` to `active` increments `campaign_index`.
- That reactivation also writes a new price snapshot into `listing_price_history` for the new campaign.
- The listing edit form groups price history by campaign.

### Listing Form and Publishing Fixes

- Publish now saves form changes before attempting status change.
- Asking price formatting uses `RWF` instead of `RF`.
- Mouse-wheel scrolling no longer changes the asking price input.
- Confusing `* Required` superscripts were removed from the listing form.

## Important Implementation Caveat

Current campaign support is a transitional model.

- The listing ID does not change when a listing is reactivated.
- We are marking campaign boundaries on the same listing row, not creating a brand new listing row per campaign.
- Older deactivate/reactivate events are not retroactively split into separate campaigns.

This is good enough to preserve meaningful price history going forward, but it is not yet the fully immutable campaign model.

## Flows We Identified As Important

- Agency or agent change mid-listing.
- Simultaneous sale and rent listings for the same property.
- Automatic archival on ownership transfer.
- Draft staleness and expiry rules.
- A future distinction between `sold` and `archived`.
- Clear relist semantics after an archival event.

## Open Questions

### Agency Transfer

If an owner changes representation from Agency A to Agency B while a listing is still active, we still need a firm rule for whether that should:

- transfer the listing
- archive the old listing and start a new one
- or create a new campaign boundary under the same row

### Dual Marketing Type

We have not yet decided whether one property can have open sale and rent listings at the same time.

Right now the open-listing guard still assumes one open listing or draft at a time per property.

### Ownership Transfer

When ownership changes, current listings should probably be auto-archived so the new owner starts from a clean state.

That workflow is still a product and implementation gap.

### Archived vs Sold

We have intentionally deferred `sold`, but this remains an important future split because:

- sold price is market data
- sold date is market data
- failed/abandoned listings should not be mixed with successful dispositions forever

## Recommended Next Step

The next highest-value lifecycle decision is to define what happens on ownership transfer and agency transfer, because both of those flows affect whether campaign boundaries should remain on the same listing row or become a brand new listing record.

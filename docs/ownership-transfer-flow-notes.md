# Ownership Transfer Flow Notes

## Goal

Define a practical first ownership transfer flow that fits the current Preview architecture.

This flow should let Amazuga represent:

- a current owner giving up ownership
- a new buyer or owner receiving ownership
- admin review before the ownership record changes
- automatic cleanup of the old owner's listings

## Recommendation

The cleanest first implementation is to model ownership transfer as a specialized property-claim workflow, not as a completely separate workflow stack.

Why:

- the app already has `property_claim_request`
- the app already has admin review for ownership decisions
- the app already mutates `property_ownership` on approval
- the main missing piece is transfer-specific intent and transfer-specific side effects

So the first transfer flow should extend claim requests rather than bypass them.

## Product Shape

### Core Principle

Ownership transfer should move the ownership record, but it should not move the seller's listing campaign forward as if nothing changed.

On approval:

- ownership moves to the new owner
- seller-controlled listings for that property are archived
- the buyer starts with a clean off-market property in their portfolio

This keeps listing history attached to the seller's campaign history while letting ownership history move forward.

## Recommended v1 Flow

### 1. Seller initiates transfer

From the owned property card or property management surface, the current owner chooses:

- `Transfer ownership`

The seller provides:

- buyer email
- optional note

For the first version, the buyer should already have an Amazuga account.

### 2. System creates a transfer-flavored claim request

Instead of making a brand new workflow table first, the system creates a property claim request with transfer metadata.

Conceptually:

- `user_id` = buyer user id
- `property_internal_id` = property being transferred
- `parcel_id` = parcel for that property
- `status` = pending
- `request_kind` = transfer
- `transfer_from_user_id` = seller user id
- `transfer_initiated_by_user_id` = seller user id

This keeps the approval target in the same table the admin already uses.

### 3. Buyer confirms

The buyer sees a transfer request in their portal and can:

- confirm transfer
- decline transfer

Admin should not be expected to approve a transfer the buyer has not confirmed.

### 4. Admin reviews and approves

The admin review surface should show:

- seller
- buyer
- target property
- whether the buyer confirmed
- whether the property currently has active or inactive listings

### 5. Approval applies the transfer transaction

Approval should happen transactionally:

1. verify seller still owns the property
2. verify buyer is the intended recipient
3. archive the seller's open listings for that property
4. move `property_ownership.user_id` to the buyer
5. stamp the ownership row with updated transfer provenance
6. grant `private_lister` role to the buyer if needed
7. mark the transfer request approved

## Why This Is Better Than Reusing Listings

The listing belongs to the seller's marketing run, not to the property forever.

If ownership changes:

- the buyer should not inherit the seller's active listing
- the buyer should not inherit the seller's agent assignment
- the buyer should not inherit the seller's private access grants

So transfer approval should archive seller listings instead of reassigning them.

## Minimal Schema Changes

The smallest good version is to extend `property_claim_request` rather than creating a new `property_transfer_request` table immediately.

Suggested additions:

- `request_kind TEXT NOT NULL DEFAULT 'claim' CHECK (request_kind IN ('claim', 'transfer'))`
- `transfer_from_user_id TEXT REFERENCES app_user(id)`
- `transfer_initiated_by_user_id TEXT REFERENCES app_user(id)`
- `buyer_confirmed_at TIMESTAMPTZ`
- `buyer_declined_at TIMESTAMPTZ`
- `transfer_note TEXT`

Optional but useful:

- `approved_transfer_effective_at TIMESTAMPTZ`

## Required Workflow Changes

### Claim / transfer creation

- add a seller-side action to create a transfer request for an existing user
- block transfer creation if seller does not currently own the property
- block duplicate open transfer requests for the same property

### Buyer confirmation

- add buyer-facing accept / decline actions
- require confirmation before admin approval

### Admin approval

- extend claim review copy so transfer requests are visually distinct from ordinary claims
- on approval, branch into transfer-specific side effects

### Listing side effects

When transfer is approved, archive all seller-controlled listings for the property in:

- `draft`
- `active`
- `inactive`

This keeps the property clean for the buyer.

## UI Surfaces

### Seller side

Add a transfer action on owned properties:

- `Transfer ownership`

The first version can be a compact form with:

- buyer email
- note

### Buyer side

Add a section to the portal properties workspace for:

- incoming ownership transfers

Actions:

- `Accept transfer`
- `Decline transfer`

### Admin side

Reuse the existing property-claim review queue, but show:

- request kind
- seller
- buyer
- buyer confirmation status

## Important Rules

- Transfer approval should fail if the seller no longer owns the property.
- Transfer approval should fail if the property target has changed in a conflicting way.
- Transfer should archive old listings rather than reassigning them.
- Transfer should not publish or create a buyer listing automatically.
- Transfer and ordinary claim approval should stay distinct in review copy, even if they share a table.

## What We Can Defer

These can wait until later:

- recording a sold price
- recording a sale date distinct from approval date
- escrow-like multi-step negotiation
- transfer to a user who is not yet registered
- seller and buyer document uploads
- a separate public-market `sold` state

## Recommended Build Order

1. Extend `property_claim_request` with transfer metadata.
2. Add seller-side `Transfer ownership` creation flow.
3. Add buyer accept / decline flow.
4. Extend admin review and approval logic.
5. Archive seller listings automatically on approved transfer.

## Recommendation Summary

Yes, we can make the sale / ownership transfer flow.

The best first version is:

- transfer as a specialized claim request
- buyer confirmation before admin review
- ownership reassignment on approval
- automatic archival of the seller's listings
- buyer starts with a clean owned property, not an inherited listing

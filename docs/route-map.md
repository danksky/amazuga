# Amazuga Route Map

## Public

- `/` -> redirect to `/buy`
- `/buy`
- `/rent`
- `/property/[propertyId]`
- `/area/[slug]`
- `/agencies`
- `/agencies/[agencySlug]`
- `/agents/[agentSlug]`
- `/valuators/[valuatorSlug]`

## Authentication

- `/login`
- `/signup`

## Onboarding

- `/advertise`
- `/assess` -> redirect to `/advertise`
- `/agent/applications/new`
- `/agent/applications/[applicationId]`
- `/agency/registration-requests/new`
- `/agency/registration-requests/[requestId]`
- `/valuator/applications/new`
- `/valuator/applications/[applicationId]`

## Authenticated App

- `/account`
- `/saved`
- `/portal`
- `/portal/listings`
- `/portal/listings/[listingId]/edit`
- `/portal/valuations`
- `/portal/valuations/new`
- `/portal/agency`
- `/portal/agents`
- `/portal/profile`
- `/portal/settings`

## Admin

- `/admin`
- `/admin/agencies`
- `/admin/agents`
- `/admin/valuators`
- `/admin/valuations`
- `/admin/properties`
- `/admin/listings`

## Portal modes

The portal (`/sell/portal/...`) serves two distinct user types whose nav
and entry points differ.

**Agency user** (`hasAgencyPortalAccess`): member or manager of at least one
agency. Lands on `/listings`. Sees Properties, Listings, Agency, Team, and
Valuations (if also a valuator) in the portal nav. The listings page shows
all listings across the agency, not just those tied to properties they
personally own.

**Private lister** (`hasPropertyOwnerListingAccess`): owns at least one
property asset but has no agency membership. Lands on `/properties`. The
Listings nav item is hidden. All listing actions — create, edit, publish,
deactivate, reactivate — surface inline on the portfolio cards on the
Properties page. There is no reason for a private lister to visit a
separate listings page.

**Pending claimant**: has open claim requests but no approved ownership yet.
Lands on `/properties` to track claim status. Cannot create listings until
a claim is approved.

A user can be both an agency member and a property owner. In that case
`hasAgencyPortalAccess` takes precedence and they get the agency experience
with Listings as the entry point.

## Notes

- Public property browsing should live on `/buy` and `/rent`.
- Professional onboarding now centers on `/advertise` as the shared applications hub.
- There is no standalone public listing detail page in v1.
- There is no standalone UPI lookup page in v1.
- UPI resolution should happen from the shared search experience and route to `/property/[propertyId]`.
- Internal maintenance route: `/api/internal/listing-image-cleanup`
  - triggered by Vercel Cron once daily on the current plan to retry queued listing image deletions from R2

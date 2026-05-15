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

## Notes

- Public property browsing should live on `/buy` and `/rent`.
- Professional onboarding now centers on `/advertise` as the shared applications hub.
- There is no standalone public listing detail page in v1.
- There is no standalone UPI lookup page in v1.
- UPI resolution should happen from the shared search experience and route to `/property/[propertyId]`.

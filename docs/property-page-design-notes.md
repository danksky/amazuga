# Property Page Design Notes

## Goal

Document the intended content order and behavior rules for property pages, with special attention to:

- listed vs unlisted state
- property kind differences

## Core Principle

- Most properties on Amazuga will not be actively listed.
- The property page should prioritize the best available context for the property's current state.
- The property page should also adapt its emphasis to the kind of property being shown.
- The ordering rules should be consistent across desktop and mobile.
- This note is about content priority and section order, not final panel sizing.

## Shared Rules

- The key details box should surface the most important factual information about the property.
- Key details should change by property kind instead of forcing one universal fact pattern.
- The Amazuga estimate may be added to the key details box later.
- The map should be the third major section on the page on both desktop and mobile.

## Behavior Axes

The public property page should be driven by two axes at once:

- listing state
  - `listed`
  - `unlisted`
- property kind
  - `house`
  - `apartment_unit`
  - `land`
  - `building`
  - `commercial_unit`

## Listed Property

- The first media panel should be a photo gallery.
- The property summary and key details should appear immediately alongside or after that primary media, depending on screen size.
- The map should appear as the third section, below the initial summary and key details content.

## Unlisted Property

- The first media panel should be the parcel outline on the map.
- This map acts as the primary visual context because unlisted properties typically will not have photos.
- The property summary and key details should appear immediately alongside or after that first panel, depending on screen size.
- The map should still remain the third major section in the page flow.
  - On unlisted properties, this means the top visual map and the later map section may currently represent the same parcel context, but the ordering rule still holds for the overall page structure.

## Desktop Priority

- On wider screens, the key details box should remain above the fold.
- Above the fold should communicate:
  - the primary visual context
  - the property identity and summary
  - the key details
- For listed properties, the primary visual context is the gallery.
- For unlisted properties, the primary visual context is the parcel outline map.

## Mobile Behavior

- Mobile should follow the same section ordering decisions as desktop.
- Preserve the current mobile feel where possible if the stacking and sizing already work well.
- Do not treat this change as a mobile resizing exercise.
- The main mobile requirement is that the ordering logic carries through:
  - listed properties show gallery first
  - unlisted properties show parcel map first
  - the map remains the third major section

## Property Kind Emphasis

- `house`
  - Lead with livability.
  - Prioritize beds, baths, interior size, parcel size, and year built when available.

- `apartment_unit`
  - Lead with the unit.
  - Prioritize interior size, beds, baths, and unit-focused framing, with parcel/building context as support.

- `land`
  - Lead with parcel feasibility.
  - Prioritize parcel size, zoning, and map context.

- `building`
  - Lead with the building as the marketable object.
  - Prioritize building area, parcel context, and future room for child-unit inventory.

- `commercial_unit`
  - Lead with business utility.
  - Prioritize floor area, zoning, and location context before lifestyle-oriented copy.

## Intended Section Order

### Listed

1. Gallery
2. Property summary and key details
3. Map

### Unlisted

1. Parcel outline map
2. Property summary and key details
3. Map

## Out of Scope For This Note

- exact panel heights
- final responsive sizing rules
- final treatment of valuation history
- final treatment of Amazuga estimate

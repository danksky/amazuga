# Property Page Design Notes

## Goal

Document the intended content order for property pages before implementation changes, with special attention to the difference between listed and unlisted properties.

## Core Principle

- Most properties on Amazuga will not be actively listed.
- The property page should prioritize the best available context for the property's current state.
- The ordering rules should be consistent across desktop and mobile.
- This note is about content priority and section order, not final panel sizing.

## Shared Rules

- The key details box should surface the most important factual information about the property.
- Key details should include the essentials such as beds, baths, parcel size, and zone when available.
- The Amazuga estimate may be added to the key details box later.
- The map should be the third major section on the page on both desktop and mobile.

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

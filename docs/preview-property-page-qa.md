# Preview Property Page QA Index

Use this note as a quick click-through list when reviewing property-page behavior in the preview environment.

Route format:

- lookup: `/property/<public_id>`
- canonical: `/property/<public_id>/<slug>`

## Residential

- Listed house
  - `E8A072F884` - Nyarutarama Family Residence
- Listed apartment unit
  - `0A42C2AE33` - Kicukiro Balcony Apartment
- Unlisted house
  - `5974CFE46F` - Unlisted property
- Unlisted apartment unit
  - `ABB6924971` - Unlisted property

## Land

- Listed land
  - `EDDBB70270` - Masaka Preview Hillside Parcel
- Unlisted land
  - `9CF1CE1B90` - Unlisted property

## Building

- Listed building
  - `717BD2CFEB` - Kagarama Preview Apartment Building

## Commercial

- Listed commercial unit
  - `A53411D1C0` - Kimihurura Preview Office Suite
- Listed commercial unit
  - `E73FAFDECE` - Ndera Preview Retail Frontage

## Multi-Unit Parcel Examples

- Apartment building parent asset
  - `5E97CD1028` - Gahanga Court Apartments
- Listed apartment child unit
  - `3C39927443` - Kicukiro · Kabidandi · 313 Unit A-201
- Unlisted apartment child unit
  - `AEE8D507EA` - Kicukiro · Kabidandi · 313 Unit A-302
- Commercial building parent asset
  - `DEBC01AED5` - Kacyiru Market Arcade
- Listed commercial child unit
  - `E6A4CB9300` - Gasabo · Uruhongore · 1993 Unit G-04
- Unlisted commercial child unit
  - `6EA6DEA4F6` - Gasabo · Uruhongore · 1993 Unit G-08

## Seed Cohorts

- `mock_import_listing_surface_v1`
  - Residential baseline imported from the older mock catalog.
- `preview_property_page_variants_v1`
  - Supplemental validation cohort for `land`, `building`, `commercial_unit`, and unlisted property pages.
- `preview_multi_unit_examples_v1`
  - Supplemental validation cohort for true child-unit assets on shared parcels, including apartment and commercial unit examples.

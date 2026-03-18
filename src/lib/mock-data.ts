import type { Agency, AgencyApplication, Listing, Property, User, ValuationSubmission } from "@/types/domain";

export const currentUser: User = {
  id: "user-1",
  email: "daniel.kawalsky@gmail.com",
  fullName: "Daniel Kawalsky",
  roles: ["user", "admin"],
  savedPropertyIds: ["property-1", "property-3"],
  upiLookupCountToday: 3,
};

export const agencies: Agency[] = [
  {
    id: "agency-1",
    slug: "kigali-homes-group",
    businessName: "Kigali Homes Group",
    tin: "107839210",
    websiteUrl: "https://example.com",
    status: "approved",
    managerUserId: "user-2",
    memberUserIds: ["user-2", "user-3"],
  },
];

export const agencyApplications: AgencyApplication[] = [
  {
    id: "agency-application-1",
    createdByUserId: "user-1",
    businessName: "Amazuga Advisory",
    tin: "119000321",
    status: "pending",
    createdAt: "2026-03-17T11:00:00.000Z",
  },
];

export const listings: Listing[] = [
  {
    id: "listing-1",
    propertyId: "property-1",
    agencyId: "agency-1",
    agentUserId: "user-2",
    status: "active",
    marketingType: "sale",
    askingPrice: 185000000,
    currency: "RWF",
    headline: "Modern hillside residence with city views",
    description: "Well-kept family home with an efficient layout, terrace seating, and easy road access.",
    imageUrls: ["/placeholders/house-sale.svg"],
    createdAt: "2026-03-01T10:00:00.000Z",
    updatedAt: "2026-03-12T14:00:00.000Z",
  },
  {
    id: "listing-2",
    propertyId: "property-3",
    agencyId: "agency-1",
    agentUserId: "user-3",
    status: "active",
    marketingType: "rent",
    askingPrice: 950000,
    currency: "RWF",
    headline: "Compact rental near services and transit",
    description: "Bright rental unit with a practical footprint and short travel to neighborhood services.",
    imageUrls: ["/placeholders/apartment-rent.svg"],
    createdAt: "2026-03-05T10:00:00.000Z",
    updatedAt: "2026-03-15T12:00:00.000Z",
  },
  {
    id: "listing-3",
    propertyId: "property-4",
    agencyId: "agency-1",
    agentUserId: "user-2",
    status: "active",
    marketingType: "sale",
    askingPrice: 132000000,
    currency: "RWF",
    headline: "Three-bedroom house with enclosed garden",
    description: "Balanced family layout with a compact landscaped yard and updated finishes.",
    imageUrls: ["/placeholders/house-sale.svg"],
    createdAt: "2026-03-06T10:00:00.000Z",
    updatedAt: "2026-03-16T10:00:00.000Z",
  },
  {
    id: "listing-4",
    propertyId: "property-5",
    agencyId: "agency-1",
    agentUserId: "user-3",
    status: "active",
    marketingType: "sale",
    askingPrice: 248000000,
    currency: "RWF",
    headline: "Large modern home with flexible upper floor",
    description: "Generous home footprint suited for a larger household or mixed live-work use.",
    imageUrls: ["/placeholders/house-sale.svg"],
    createdAt: "2026-03-04T08:00:00.000Z",
    updatedAt: "2026-03-15T16:00:00.000Z",
  },
  {
    id: "listing-5",
    propertyId: "property-6",
    agencyId: "agency-1",
    agentUserId: "user-2",
    status: "active",
    marketingType: "sale",
    askingPrice: 99000000,
    currency: "RWF",
    headline: "Starter home on a quiet interior road",
    description: "Efficient plan with practical room sizes and steady road access.",
    imageUrls: ["/placeholders/house-sale.svg"],
    createdAt: "2026-03-07T12:00:00.000Z",
    updatedAt: "2026-03-17T09:00:00.000Z",
  },
  {
    id: "listing-6",
    propertyId: "property-7",
    agencyId: "agency-1",
    agentUserId: "user-3",
    status: "active",
    marketingType: "sale",
    askingPrice: 158000000,
    currency: "RWF",
    headline: "Corner parcel house near district services",
    description: "A bright house with a clear plan, parking apron, and easy service access.",
    imageUrls: ["/placeholders/house-sale.svg"],
    createdAt: "2026-03-08T11:00:00.000Z",
    updatedAt: "2026-03-17T11:00:00.000Z",
  },
  {
    id: "listing-7",
    propertyId: "property-8",
    agencyId: "agency-1",
    agentUserId: "user-2",
    status: "active",
    marketingType: "rent",
    askingPrice: 1200000,
    currency: "RWF",
    headline: "Two-bedroom rental with balcony",
    description: "Well-lit apartment with a practical kitchen and a sheltered outdoor edge.",
    imageUrls: ["/placeholders/apartment-rent.svg"],
    createdAt: "2026-03-09T10:00:00.000Z",
    updatedAt: "2026-03-17T13:00:00.000Z",
  },
  {
    id: "listing-8",
    propertyId: "property-9",
    agencyId: "agency-1",
    agentUserId: "user-3",
    status: "active",
    marketingType: "rent",
    askingPrice: 1500000,
    currency: "RWF",
    headline: "Larger rental unit with flexible second room",
    description: "Useful rental layout with room for a home office or guest room arrangement.",
    imageUrls: ["/placeholders/apartment-rent.svg"],
    createdAt: "2026-03-10T09:00:00.000Z",
    updatedAt: "2026-03-18T08:00:00.000Z",
  },
];

export const valuations: ValuationSubmission[] = [
  {
    id: "valuation-1",
    propertyId: "property-1",
    submittedByUserId: "user-4",
    effectiveDate: "2026-02-01",
    estimatedValue: 176000000,
    currency: "RWF",
    status: "approved",
    createdAt: "2026-02-01T08:00:00.000Z",
  },
  {
    id: "valuation-2",
    propertyId: "property-1",
    submittedByUserId: "user-4",
    effectiveDate: "2025-11-18",
    estimatedValue: 168000000,
    currency: "RWF",
    status: "approved",
    createdAt: "2025-11-18T08:00:00.000Z",
  },
  {
    id: "valuation-3",
    propertyId: "property-2",
    submittedByUserId: "user-4",
    effectiveDate: "2026-01-10",
    estimatedValue: 92000000,
    currency: "RWF",
    status: "approved",
    createdAt: "2026-01-10T08:00:00.000Z",
  },
];

export const properties: Property[] = [
  {
    id: "property-1",
    upi: "1/02/10/01/1234",
    title: "Kimihurura Ridge Home",
    description: "Detached residence positioned on a sloping parcel with open western views.",
    location: {
      district: "Gasabo",
      sector: "Kimihurura",
      cell: "Rugando",
      village: "Amahoro",
      lat: -1.9441,
      lng: 30.0925,
    },
    geometry: {
      type: "polygon",
      coordinates: [[[30.0917, -1.9445], [30.0931, -1.9444], [30.0932, -1.9437], [30.0918, -1.9438], [30.0917, -1.9445]]],
    },
    facts: {
      bedrooms: 4,
      bathrooms: 3,
      areaSqm: 285,
      landAreaSqm: 540,
      propertyType: "House",
      yearBuilt: 2018,
    },
    listingState: "listed",
    activeListingId: "listing-1",
    valuationHistoryIds: ["valuation-1", "valuation-2"],
  },
  {
    id: "property-2",
    upi: "1/02/10/02/0981",
    title: "Kacyiru Parcel 0981",
    description: "Non-listed parcel with prior approved valuation activity.",
    location: {
      district: "Gasabo",
      sector: "Kacyiru",
      cell: "Kamatamu",
      village: "Intwari",
      lat: -1.9402,
      lng: 30.0822,
    },
    geometry: {
      type: "polygon",
      coordinates: [[[30.0817, -1.9406], [30.0827, -1.9406], [30.0828, -1.9399], [30.0818, -1.9398], [30.0817, -1.9406]]],
    },
    facts: {
      landAreaSqm: 390,
      propertyType: "Parcel",
    },
    listingState: "not_listed",
    valuationHistoryIds: ["valuation-3"],
  },
  {
    id: "property-3",
    upi: "1/03/05/07/4421",
    title: "Kicukiro Rental Flat",
    description: "Rental-ready unit with efficient interior planning and access to nearby services.",
    location: {
      district: "Kicukiro",
      sector: "Niboye",
      cell: "Niboye",
      village: "Isangano",
      lat: -1.9822,
      lng: 30.1111,
    },
    geometry: {
      type: "polygon",
      coordinates: [[[30.1106, -1.9826], [30.1116, -1.9826], [30.1117, -1.9819], [30.1107, -1.9819], [30.1106, -1.9826]]],
    },
    facts: {
      bedrooms: 2,
      bathrooms: 2,
      areaSqm: 88,
      propertyType: "Apartment",
      yearBuilt: 2021,
    },
    listingState: "listed",
    activeListingId: "listing-2",
    valuationHistoryIds: [],
  },
  {
    id: "property-4",
    upi: "1/01/04/05/2144",
    title: "Remera Garden House",
    description: "A mid-size home with enclosed outdoor space and straightforward circulation.",
    location: {
      district: "Gasabo",
      sector: "Remera",
      cell: "Nyarutarama",
      village: "Umucyo",
      lat: -1.9518,
      lng: 30.1093,
    },
    geometry: {
      type: "polygon",
      coordinates: [[[30.1088, -1.9522], [30.1097, -1.9522], [30.1097, -1.9514], [30.1088, -1.9514], [30.1088, -1.9522]]],
    },
    facts: {
      bedrooms: 3,
      bathrooms: 2,
      areaSqm: 198,
      landAreaSqm: 410,
      propertyType: "House",
      yearBuilt: 2017,
    },
    listingState: "listed",
    activeListingId: "listing-3",
    valuationHistoryIds: [],
  },
  {
    id: "property-5",
    upi: "1/01/06/08/3001",
    title: "Nyarutarama Family Residence",
    description: "A larger modern home arranged across multiple levels with broad frontage.",
    location: {
      district: "Gasabo",
      sector: "Remera",
      cell: "Nyarutarama",
      village: "Ubumwe",
      lat: -1.9472,
      lng: 30.1085,
    },
    geometry: {
      type: "polygon",
      coordinates: [[[30.1078, -1.9477], [30.1091, -1.9477], [30.1092, -1.9469], [30.1079, -1.9469], [30.1078, -1.9477]]],
    },
    facts: {
      bedrooms: 5,
      bathrooms: 4,
      areaSqm: 372,
      landAreaSqm: 690,
      propertyType: "House",
      yearBuilt: 2020,
    },
    listingState: "listed",
    activeListingId: "listing-4",
    valuationHistoryIds: [],
  },
  {
    id: "property-6",
    upi: "1/04/02/01/8890",
    title: "Gisozi Starter Home",
    description: "Compact detached house with efficient planning and a manageable parcel.",
    location: {
      district: "Gasabo",
      sector: "Gisozi",
      cell: "Musezero",
      village: "Amahoro",
      lat: -1.9237,
      lng: 30.0744,
    },
    geometry: {
      type: "polygon",
      coordinates: [[[30.074, -1.924], [30.0749, -1.924], [30.0749, -1.9233], [30.074, -1.9233], [30.074, -1.924]]],
    },
    facts: {
      bedrooms: 3,
      bathrooms: 2,
      areaSqm: 154,
      landAreaSqm: 302,
      propertyType: "House",
      yearBuilt: 2016,
    },
    listingState: "listed",
    activeListingId: "listing-5",
    valuationHistoryIds: [],
  },
  {
    id: "property-7",
    upi: "1/05/03/09/6402",
    title: "Kimironko Corner House",
    description: "A practical corner-lot house with a stronger street presence and flexible interior use.",
    location: {
      district: "Gasabo",
      sector: "Kimironko",
      cell: "Bibare",
      village: "Intwari",
      lat: -1.9494,
      lng: 30.1272,
    },
    geometry: {
      type: "polygon",
      coordinates: [[[30.1268, -1.9498], [30.1278, -1.9498], [30.1278, -1.949], [30.1268, -1.949], [30.1268, -1.9498]]],
    },
    facts: {
      bedrooms: 4,
      bathrooms: 3,
      areaSqm: 232,
      landAreaSqm: 435,
      propertyType: "House",
      yearBuilt: 2019,
    },
    listingState: "listed",
    activeListingId: "listing-6",
    valuationHistoryIds: [],
  },
  {
    id: "property-8",
    upi: "1/03/06/04/1288",
    title: "Kicukiro Balcony Apartment",
    description: "A well-lit rental apartment with a clean plan and accessible neighborhood services.",
    location: {
      district: "Kicukiro",
      sector: "Kigarama",
      cell: "Rwampara",
      village: "Twizerane",
      lat: -1.9895,
      lng: 30.1026,
    },
    geometry: {
      type: "polygon",
      coordinates: [[[30.1022, -1.9899], [30.103, -1.9899], [30.103, -1.9892], [30.1022, -1.9892], [30.1022, -1.9899]]],
    },
    facts: {
      bedrooms: 2,
      bathrooms: 2,
      areaSqm: 94,
      propertyType: "Apartment",
      yearBuilt: 2022,
    },
    listingState: "listed",
    activeListingId: "listing-7",
    valuationHistoryIds: [],
  },
  {
    id: "property-9",
    upi: "1/03/08/11/7712",
    title: "Nyarugunga Flexible Rental",
    description: "Larger rental unit with room for a second bedroom, office, or guest use.",
    location: {
      district: "Kicukiro",
      sector: "Nyarugunga",
      cell: "Kamashashi",
      village: "Amahoro",
      lat: -1.9963,
      lng: 30.153,
    },
    geometry: {
      type: "polygon",
      coordinates: [[[30.1526, -1.9968], [30.1535, -1.9968], [30.1535, -1.9961], [30.1526, -1.9961], [30.1526, -1.9968]]],
    },
    facts: {
      bedrooms: 3,
      bathrooms: 2,
      areaSqm: 118,
      propertyType: "Apartment",
      yearBuilt: 2020,
    },
    listingState: "listed",
    activeListingId: "listing-8",
    valuationHistoryIds: [],
  },
];

export function getPropertyById(propertyId: string) {
  return properties.find((property) => property.id === propertyId);
}

export function getListingById(listingId: string) {
  return listings.find((listing) => listing.id === listingId);
}

export function getListingForProperty(propertyId: string) {
  return listings.find((listing) => listing.propertyId === propertyId && listing.status === "active");
}

export function getValuationsForProperty(propertyId: string) {
  return valuations
    .filter((valuation) => valuation.propertyId === propertyId && valuation.status === "approved")
    .sort((left, right) => right.effectiveDate.localeCompare(left.effectiveDate));
}

export function getAgencyById(agencyId: string) {
  return agencies.find((agency) => agency.id === agencyId);
}

export function getAgencyApplicationByUserId(userId: string) {
  return agencyApplications.find((application) => application.createdByUserId === userId);
}

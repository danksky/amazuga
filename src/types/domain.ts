export type Role = "user" | "agent" | "agency_manager" | "valuator" | "admin";

export type ListingStatus = "active" | "inactive";

export type SubmissionStatus = "pending" | "approved" | "denied";

export type PropertyListingState = "listed" | "not_listed";

export type AgencyMembershipRole = "agent" | "manager";

export type PropertyKind =
  | "house"
  | "land"
  | "building"
  | "apartment_unit"
  | "commercial_unit"
  | "mixed_use"
  | "other";

export interface User {
  id: string;
  email: string;
  fullName: string;
  roles: Role[];
  mockPersonaLabel?: string;
  mockPersonaDescription?: string;
  avatarUrl?: string;
  savedPropertyIds: string[];
  upiLookupCountToday: number;
}

export interface PropertyGeometry {
  type: "polygon" | "multipolygon";
  coordinates: number[][][];
}

export interface PropertyLocation {
  district: string;
  sector?: string;
  cell?: string;
  village?: string;
  lat: number;
  lng: number;
  bbox?: {
    minLng: number;
    minLat: number;
    maxLng: number;
    maxLat: number;
  };
}

export interface PropertyFacts {
  bedrooms?: number;
  bathrooms?: number;
  areaSqm?: number;
  landAreaSqm?: number;
  propertyType?: string;
  propertyKind?: PropertyKind;
  yearBuilt?: number;
  zoningLabel?: string;
}

export interface Property {
  id: string;
  internalId?: string;
  parcelId: string;
  parcelPublicId?: string;
  code?: string;
  parentInternalId?: string;
  upi: string;
  title: string;
  description?: string;
  location: PropertyLocation;
  geometry: PropertyGeometry;
  facts: PropertyFacts;
  listingState: PropertyListingState;
  activeListingId?: string;
  valuationHistoryIds: string[];
}

export interface Listing {
  id: string;
  propertyId: string;
  propertyInternalId?: string;
  agencyId: string;
  agentUserId: string;
  status: ListingStatus;
  marketingType: "sale" | "rent";
  askingPrice: number;
  currency: "RWF";
  headline?: string;
  description?: string;
  imageUrls: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Agency {
  id: string;
  slug: string;
  createdFromApplicationId?: string;
  businessName: string;
  tin: string;
  whatsappPhone?: string;
  websiteUrl?: string;
  googleMapsUrl?: string;
  status: SubmissionStatus;
  pendingManagerUserId?: string;
  managerUserId?: string;
  memberUserIds: string[];
}

export interface AgencyMembership {
  id: string;
  agencyId: string;
  userId: string;
  role: AgencyMembershipRole;
  createdAt: string;
}

export interface AgencyJoinRequest {
  id: string;
  agencyId: string;
  userId: string;
  status: SubmissionStatus;
  createdAt: string;
}

export interface AgencyInvite {
  id: string;
  agencyId: string;
  email: string;
  invitedByUserId: string;
  status: "pending" | "accepted" | "cancelled";
  createdAt: string;
}

export interface ManagerTransferRequest {
  id: string;
  agencyId: string;
  fromUserId: string;
  toUserId: string;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  createdAt: string;
}

export interface AgentApplication {
  id: string;
  userId: string;
  nationalIdPhotoUrl: string;
  selectedAgencyId?: string;
  status: SubmissionStatus;
  createdAt: string;
}

export interface ValuatorApplication {
  id: string;
  userId: string;
  irpvRegistrationNumber: string;
  status: SubmissionStatus;
  createdAt: string;
}

export interface AgencyApplication {
  id: string;
  createdByUserId: string;
  businessName: string;
  tin: string;
  websiteUrl?: string;
  googleMapsUrl?: string;
  status: SubmissionStatus;
  createdAt: string;
}

export interface ValuationSubmission {
  id: string;
  propertyId: string;
  submittedByUserId: string;
  isAnonymous?: boolean;
  effectiveDate: string;
  estimatedValue: number;
  currency: "RWF";
  status: SubmissionStatus;
  createdAt: string;
}

export interface PropertyClaimRequest {
  id: string;
  userId: string;
  propertyId: string;
  propertyInternalId: string;
  parcelId: string;
  status: SubmissionStatus;
  createdAt: string;
}

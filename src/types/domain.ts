export type Role = "user" | "agent" | "agency_manager" | "valuator" | "admin" | "private_lister";

export type ListingStatus = "draft" | "active" | "inactive" | "archived";
export type ListingVisibility = "public" | "unlisted" | "private";
export type PropertyClaimRequestKind = "claim" | "transfer";
export type PropertyTransferMode = "sale" | "transfer";
export type PropertyClaimPropertyType =
  | "house"
  | "apartment_building"
  | "land"
  | "apartment_unit"
  | "commercial_building"
  | "commercial_unit";

export type SubmissionStatus = "pending" | "approved" | "denied";

export type PropertyListingState = "listed" | "not_listed";

export type AgencyMembershipRole = "agent" | "manager";
export type PropertyOwnershipScope = "full" | "unit";
export type PropertyClaimScope = "full_parcel" | "unit_partial";
export type PropertyTenureType = "freehold" | "emphyteutic_lease" | "unspecified";
export type PropertyDataSource = "user_provided" | "auto_populated" | "unspecified";

export type PropertyKind =
  | "house"
  | "land"
  | "apartment_building"
  | "commercial_building"
  | "apartment_unit"
  | "commercial_unit";

export interface User {
  id: string;
  email?: string;
  phone?: string;
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
  parcelId?: string;
  parcelPublicId?: string;
  parcelDisplayId?: string;
  code?: string;
  parentInternalId?: string;
  unitLabel?: string;
  upi?: string;
  locationSource?: "parcel" | "admin_unit" | "pin_derived";
  title: string;
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
  agencyId?: string;
  agentUserId: string;
  status: ListingStatus;
  visibility: ListingVisibility;
  marketingType: "sale" | "rent";
  askingPrice: number;
  currency: "RWF";
  /** When true the precise parcel location is suppressed from public surfaces. */
  locationHidden: boolean;
  imageUrls: string[];
  videoUrl?: string;
  videoThumbnailUrl?: string;
  ogImageUrl?: string;
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
  instagramUrl?: string;
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
  nationalIdPhotoKey: string;
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
  instagramUrl?: string;
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

export interface PropertyRecordFactsInput {
  representativeSize?: number;
  zoning?: string;
  bedrooms?: number;
  bathrooms?: number;
  interiorAreaSqm?: number;
  yearBuilt?: number;
}

export interface PropertyClaimRequest {
  id: string;
  userId: string;
  kind: PropertyClaimRequestKind;
  propertyId?: string;
  propertyInternalId?: string;
  parcelId: string;
  upi: string;
  claimScope: PropertyClaimScope;
  unitLabel?: string;
  declaredPropertyType?: PropertyClaimPropertyType;
  tenureType: PropertyTenureType;
  tenureSource: PropertyDataSource;
  declaredAssetType?: PropertyKind;
  propertyFacts?: PropertyRecordFactsInput;
  transferMode?: PropertyTransferMode;
  transferFromUserId?: string;
  transferInitiatedByUserId?: string;
  buyerConfirmedAt?: string;
  buyerDeclinedAt?: string;
  transferNote?: string;
  status: SubmissionStatus;
  createdAt: string;
}

export interface PropertyOwnership {
  id: string;
  userId: string;
  propertyId: string;
  propertyInternalId: string;
  parcelId: string;
  ownershipScope: PropertyOwnershipScope;
  createdAt: string;
}

export type PropertyOwnershipContestStatus =
  | "pending"
  | "resolved_upheld"
  | "resolved_overturned";

export interface PropertyOwnershipContest {
  id: string;
  upi: string;
  contestingUserId: string;
  claimedPropertyAssetId: string;
  claimedPropertyId: string;
  note: string;
  status: PropertyOwnershipContestStatus;
  createdAt: string;
}

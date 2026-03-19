import agenciesData from "../../data/agencies.json";
import agencyApplicationsData from "../../data/agency-applications.json";
import agentApplicationsData from "../../data/agent-applications.json";
import listingsData from "../../data/listings.json";
import propertiesData from "../../data/properties.json";
import usersData from "../../data/users.json";
import valuationsData from "../../data/valuations.json";
import valuatorApplicationsData from "../../data/valuator-applications.json";

import type {
  Agency,
  AgencyApplication,
  AgentApplication,
  Listing,
  Property,
  User,
  ValuationSubmission,
  ValuatorApplication,
} from "@/types/domain";

export const agencies = agenciesData as Agency[];
export const agencyApplications = agencyApplicationsData as AgencyApplication[];
export const agentApplications = agentApplicationsData as AgentApplication[];
export const listings = listingsData as Listing[];
export const properties = propertiesData as Property[];
export const users = usersData as User[];
export const valuations = valuationsData as ValuationSubmission[];
export const valuatorApplications = valuatorApplicationsData as ValuatorApplication[];

export function getPropertyById(propertyId: string) {
  return properties.find((property) => property.id === propertyId);
}

export function getUserById(userId: string) {
  return users.find((user) => user.id === userId);
}

export function getPropertyByUpi(upi: string) {
  const normalizedUpi = upi.trim();
  return properties.find((property) => property.upi === normalizedUpi);
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

export function getAgentApplicationByUserId(userId: string) {
  return agentApplications.find((application) => application.userId === userId);
}

export function getValuatorApplicationByUserId(userId: string) {
  return valuatorApplications.find((application) => application.userId === userId);
}

export function getPendingAgencyApplications() {
  return agencyApplications.filter((application) => application.status === "pending");
}

export function getPendingAgentApplications() {
  return agentApplications.filter((application) => application.status === "pending");
}

export function getPendingValuatorApplications() {
  return valuatorApplications.filter((application) => application.status === "pending");
}

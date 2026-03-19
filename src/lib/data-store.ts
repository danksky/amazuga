import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { Agency, AgencyApplication, AgentApplication, SubmissionStatus, ValuatorApplication } from "@/types/domain";

type ApplicationKind = "agency" | "agent" | "valuator";

const dataDir = path.join(process.cwd(), "data");

function getFilePath(kind: ApplicationKind) {
  switch (kind) {
    case "agency":
      return path.join(dataDir, "agency-applications.json");
    case "agent":
      return path.join(dataDir, "agent-applications.json");
    case "valuator":
      return path.join(dataDir, "valuator-applications.json");
  }
}

function getAgenciesFilePath() {
  return path.join(dataDir, "agencies.json");
}

async function readJsonFile<T>(filePath: string) {
  const file = await readFile(filePath, "utf8");
  return JSON.parse(file) as T;
}

async function writeJsonFile<T>(filePath: string, value: T) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function createRecordId(prefix: string) {
  return `${prefix}-${Date.now()}`;
}

export async function readAgencyApplications() {
  return readJsonFile<AgencyApplication[]>(getFilePath("agency"));
}

export async function readAgencies() {
  return readJsonFile<Agency[]>(getAgenciesFilePath());
}

export async function readAgentApplications() {
  return readJsonFile<AgentApplication[]>(getFilePath("agent"));
}

export async function readValuatorApplications() {
  return readJsonFile<ValuatorApplication[]>(getFilePath("valuator"));
}

function getLatestApplicationForUser<T extends { userId: string; status: SubmissionStatus }>(applications: T[], userId: string) {
  return [...applications].reverse().find((application) => application.userId === userId);
}

export async function updateApplicationStatus(
  kind: ApplicationKind,
  applicationId: string,
  status: SubmissionStatus,
) {
  const filePath = getFilePath(kind);
  const applications = await readJsonFile<
    AgencyApplication[] | AgentApplication[] | ValuatorApplication[]
  >(filePath);
  const nextApplications = applications.map((application) =>
    application.id === applicationId ? { ...application, status } : application,
  );

  await writeJsonFile(filePath, nextApplications);
}

export async function createAgencyApplication(input: {
  createdByUserId: string;
  businessName: string;
  tin: string;
  websiteUrl?: string;
  googleMapsUrl?: string;
}) {
  const applications = await readAgencyApplications();
  const nextApplication: AgencyApplication = {
    id: createRecordId("agency-application"),
    createdByUserId: input.createdByUserId,
    businessName: input.businessName,
    tin: input.tin,
    websiteUrl: input.websiteUrl || undefined,
    googleMapsUrl: input.googleMapsUrl || undefined,
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  await writeJsonFile(getFilePath("agency"), [...applications, nextApplication]);
  return nextApplication;
}

export async function createAgentApplication(input: {
  userId: string;
  nationalIdPhotoUrl: string;
  selectedAgencyId?: string;
}) {
  const applications = await readAgentApplications();
  const nextApplication: AgentApplication = {
    id: createRecordId("agent-application"),
    userId: input.userId,
    nationalIdPhotoUrl: input.nationalIdPhotoUrl,
    selectedAgencyId: input.selectedAgencyId || undefined,
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  await writeJsonFile(getFilePath("agent"), [...applications, nextApplication]);
  return nextApplication;
}

export async function createValuatorApplication(input: {
  userId: string;
  irpvRegistrationNumber: string;
}) {
  const applications = await readValuatorApplications();
  const nextApplication: ValuatorApplication = {
    id: createRecordId("valuator-application"),
    userId: input.userId,
    irpvRegistrationNumber: input.irpvRegistrationNumber,
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  await writeJsonFile(getFilePath("valuator"), [...applications, nextApplication]);
  return nextApplication;
}

function slugifyAgencyName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function ensureAgencyFromApprovedApplication(applicationId: string) {
  const [agencies, applications, agentApplications] = await Promise.all([
    readAgencies(),
    readAgencyApplications(),
    readAgentApplications(),
  ]);
  const application = applications.find((entry) => entry.id === applicationId);

  if (!application || application.status !== "approved") {
    return null;
  }

  const existing = agencies.find((agency) => agency.createdFromApplicationId === applicationId);
  if (existing) {
    return existing;
  }

  const latestAgentApplication = getLatestApplicationForUser(agentApplications, application.createdByUserId);
  const isApprovedAgent = latestAgentApplication?.status === "approved";

  const nextAgency: Agency = {
    id: createRecordId("agency"),
    slug: slugifyAgencyName(application.businessName),
    createdFromApplicationId: application.id,
    businessName: application.businessName,
    tin: application.tin,
    websiteUrl: application.websiteUrl,
    googleMapsUrl: application.googleMapsUrl,
    status: "approved",
    pendingManagerUserId: application.createdByUserId,
    managerUserId: isApprovedAgent ? application.createdByUserId : undefined,
    memberUserIds: isApprovedAgent ? [application.createdByUserId] : [],
  };

  await writeJsonFile(getAgenciesFilePath(), [...agencies, nextAgency]);
  return nextAgency;
}

export async function activatePendingAgencyManager(userId: string) {
  const agencies = await readAgencies();
  let didChange = false;

  const nextAgencies = agencies.map((agency) => {
    if (agency.pendingManagerUserId !== userId || agency.managerUserId) {
      return agency;
    }

    didChange = true;
    return {
      ...agency,
      managerUserId: userId,
      memberUserIds: agency.memberUserIds.includes(userId) ? agency.memberUserIds : [...agency.memberUserIds, userId],
    };
  });

  if (didChange) {
    await writeJsonFile(getAgenciesFilePath(), nextAgencies);
  }
}

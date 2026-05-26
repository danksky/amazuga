import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { routes } from "@/lib/routes";
import { findPortalPropertyClaimTargetByUpi } from "@/lib/server/portal-properties";
import { createPropertyClaimRequestInDb } from "@/lib/server/workflows";
import type { PropertyClaimScope, PropertyKind, PropertyRecordFactsInput, PropertyTenureType } from "@/types/domain";

const FORM_TYPE_TO_PROPERTY_KIND: Record<string, PropertyKind> = {
  house: "house",
  apartment_building: "building",
  land: "land",
  apartment_unit: "apartment_unit",
  commercial_building: "building",
  commercial_unit: "commercial_unit",
};

type ClaimPropertyType = keyof typeof FORM_TYPE_TO_PROPERTY_KIND;

function getOptionalNumber(formData: FormData, key: string) {
  const rawValue = formData.get(key);
  if (typeof rawValue !== "string") {
    return undefined;
  }

  const trimmed = rawValue.trim();
  if (!trimmed) {
    return undefined;
  }

  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function getOptionalString(formData: FormData, key: string) {
  const rawValue = formData.get(key);
  if (typeof rawValue !== "string") {
    return undefined;
  }

  const trimmed = rawValue.trim();
  return trimmed || undefined;
}

function needsInteriorArea(propertyType: ClaimPropertyType) {
  return propertyType !== "land";
}

function needsBedroomsAndBathrooms(propertyType: ClaimPropertyType) {
  return propertyType === "house" || propertyType === "apartment_unit";
}

function getRequiredMissingFacts(propertyType: ClaimPropertyType, propertyFacts: PropertyRecordFactsInput) {
  const missing: string[] = [];

  if (needsInteriorArea(propertyType) && !propertyFacts.interiorAreaSqm) {
    missing.push("interiorAreaSqm");
  }

  if (needsBedroomsAndBathrooms(propertyType)) {
    if (propertyFacts.bedrooms === undefined) {
      missing.push("bedrooms");
    }
    if (propertyFacts.bathrooms === undefined) {
      missing.push("bathrooms");
    }
  }

  return missing;
}

function buildPortalPropertiesStatusHref(input: {
  status: "created" | "pending" | "owned" | "no_match" | "unit_required";
  upi: string;
  claimScope?: PropertyClaimScope;
  unitLabel?: string;
  propertyRouteId?: string;
}) {
  const params = new URLSearchParams({
    claimStatus: input.status,
    claimUpi: input.upi,
  });

  if (input.claimScope) {
    params.set("claimScope", input.claimScope);
  }

  if (input.unitLabel) {
    params.set("claimUnit", input.unitLabel);
  }

  if (input.propertyRouteId) {
    params.set("claimProperty", input.propertyRouteId);
  }

  return `${routes.app.portalProperties}?${params.toString()}`;
}

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    const loginUrl = new URL(routes.auth.login, request.url);
    loginUrl.searchParams.set("next", routes.app.portalProperties);
    return NextResponse.redirect(loginUrl, { status: 303 });
  }

  const formData = await request.formData();
  const rawUpi = formData.get("upi");
  const upi = typeof rawUpi === "string" ? rawUpi.trim() : "";
  const rawClaimScope = formData.get("claimScope");
  const claimScope: PropertyClaimScope = rawClaimScope === "unit_partial" ? "unit_partial" : "full_parcel";
  const rawUnitLabel = formData.get("unitLabel");
  const unitLabel = typeof rawUnitLabel === "string" ? rawUnitLabel.trim() : "";
  const rawTenureType = formData.get("tenureType");
  const tenureType: PropertyTenureType =
    rawTenureType === "freehold" || rawTenureType === "emphyteutic_lease" ? rawTenureType : "unspecified";
  const rawPropertyType = formData.get("propertyType");
  const propertyType = typeof rawPropertyType === "string" ? (rawPropertyType as ClaimPropertyType) : undefined;
  const declaredAssetType: PropertyKind | undefined = propertyType ? FORM_TYPE_TO_PROPERTY_KIND[propertyType] : undefined;
  const propertyFacts: PropertyRecordFactsInput = {
    bedrooms: getOptionalNumber(formData, "bedrooms"),
    bathrooms: getOptionalNumber(formData, "bathrooms"),
    interiorAreaSqm: getOptionalNumber(formData, "interiorAreaSqm"),
    yearBuilt: getOptionalNumber(formData, "yearBuilt"),
    description: getOptionalString(formData, "description"),
  };

  if (!upi) {
    const nextUrl = new URL(buildPortalPropertiesStatusHref({ status: "no_match", upi: "", claimScope, unitLabel }), request.url);
    return NextResponse.redirect(nextUrl, { status: 303 });
  }

  if (claimScope === "unit_partial" && !unitLabel) {
    const nextUrl = new URL(
      buildPortalPropertiesStatusHref({ status: "unit_required", upi, claimScope, unitLabel }),
      request.url,
    );
    return NextResponse.redirect(nextUrl, { status: 303 });
  }

  if (!propertyType || !declaredAssetType) {
    const nextUrl = new URL(buildPortalPropertiesStatusHref({ status: "no_match", upi, claimScope, unitLabel }), request.url);
    return NextResponse.redirect(nextUrl, { status: 303 });
  }

  const missingPropertyFacts = getRequiredMissingFacts(propertyType, propertyFacts);
  if (missingPropertyFacts.length > 0) {
    throw new Error(`Missing required property facts for selected asset type: ${missingPropertyFacts.join(", ")}`);
  }

  const target = await findPortalPropertyClaimTargetByUpi({
    upi,
    claimScope,
    unitLabel: unitLabel || undefined,
  });

  if (!target) {
    const nextUrl = new URL(buildPortalPropertiesStatusHref({ status: "no_match", upi, claimScope, unitLabel }), request.url);
    return NextResponse.redirect(nextUrl, { status: 303 });
  }

  const result = await createPropertyClaimRequestInDb({
    userId: currentUser.id,
    parcelId: target.parcelId,
    upi: target.upi,
    claimScope,
    unitLabel: unitLabel || undefined,
    tenureType,
    tenureSource: tenureType === "unspecified" ? "unspecified" : "user_provided",
    declaredAssetType,
    propertyFacts,
    propertyId: target.status === "resolved" ? target.propertyRouteId : undefined,
    propertyInternalId: target.status === "resolved" ? target.propertyInternalId : undefined,
  });

  const status =
    result.outcome === "already_owned"
      ? "owned"
      : result.outcome === "existing_pending"
        ? "pending"
        : "created";

  const nextUrl = new URL(
    buildPortalPropertiesStatusHref({
      status,
      upi: target.upi,
      claimScope,
      unitLabel: unitLabel || undefined,
      propertyRouteId: target.status === "resolved" ? target.propertyRouteId : undefined,
    }),
    request.url,
  );

  return NextResponse.redirect(nextUrl, { status: 303 });
}

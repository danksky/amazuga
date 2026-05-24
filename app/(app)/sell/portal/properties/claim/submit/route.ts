import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { routes } from "@/lib/routes";
import { findPortalPropertyClaimTargetByUpi } from "@/lib/server/portal-properties";
import { createPropertyClaimRequestInDb } from "@/lib/server/workflows";
import type { PropertyClaimScope, PropertyKind, PropertyTenureType } from "@/types/domain";

const FORM_TYPE_TO_PROPERTY_KIND: Record<string, PropertyKind> = {
  house: "house",
  apartment_building: "building",
  land: "land",
  apartment_unit: "apartment_unit",
  commercial_building: "building",
  commercial_unit: "commercial_unit",
};

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
  const declaredAssetType: PropertyKind | undefined =
    typeof rawPropertyType === "string" ? FORM_TYPE_TO_PROPERTY_KIND[rawPropertyType] : undefined;

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

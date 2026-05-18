import type { PropertyKind } from "@/types/domain";

function normalizeForSlug(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function getPropertySlug(value: string) {
  const slug = normalizeForSlug(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return slug || "property";
}

interface PublicPropertySlugContext {
  propertyTitle?: string | null;
  parcelDisplayId?: string | null;
  propertyKind?: PropertyKind | null;
  unitLabel?: string | null;
}

function isUnitKind(kind?: PropertyKind | null) {
  return kind === "apartment_unit" || kind === "commercial_unit";
}

function buildCanonicalPropertySlug(context: PublicPropertySlugContext) {
  const baseSlug = getPropertySlug(context.parcelDisplayId || context.propertyTitle || "property");

  if (isUnitKind(context.propertyKind) && context.unitLabel?.trim()) {
    return `${baseSlug}-unit-${getPropertySlug(context.unitLabel)}`;
  }

  return baseSlug;
}

export function buildPublicPropertyPath(
  propertyId: string,
  propertyContext?: string | PublicPropertySlugContext | null,
) {
  const encodedId = encodeURIComponent(propertyId);

  if (!propertyContext) {
    return `/property/${encodedId}`;
  }

  if (typeof propertyContext === "string") {
    return `/property/${encodedId}/${getPropertySlug(propertyContext)}`;
  }

  return `/property/${encodedId}/${buildCanonicalPropertySlug(propertyContext)}`;
}

function toCompactToken(value: string) {
  return value.replace(/[^a-z0-9]/gi, "").toUpperCase();
}

export function getPublicListingId(listingId: string) {
  const seededMatch = listingId.match(/^lst[_-]?([a-f0-9]{8,})$/i);
  if (seededMatch) {
    return `LST-${seededMatch[1].slice(0, 8).toUpperCase()}`;
  }

  const uuidMatch = listingId.match(/([a-f0-9]{8})-[a-f0-9-]+$/i);
  if (uuidMatch) {
    return `LST-${uuidMatch[1].toUpperCase()}`;
  }

  const compact = toCompactToken(listingId);
  return `LST-${compact.slice(0, 8) || "UNKNOWN"}`;
}

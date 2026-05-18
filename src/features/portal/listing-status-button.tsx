"use client";

import { useFormStatus } from "react-dom";

export function ListingStatusButton({
  className,
  nextStatus,
}: {
  className: string;
  nextStatus: "active" | "inactive";
}) {
  const { pending } = useFormStatus();

  const idleLabel = nextStatus === "inactive" ? "Deactivate" : "Reactivate";
  const pendingLabel = nextStatus === "inactive" ? "Deactivating..." : "Reactivating...";

  return (
    <button
      aria-busy={pending}
      className={className}
      disabled={pending}
      type="submit"
    >
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}

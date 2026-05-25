"use client";

import { useFormStatus } from "react-dom";

export function ListingStatusButton({
  className,
  currentStatus,
  disabled: disabledProp,
  nextStatus,
}: {
  className: string;
  currentStatus: "draft" | "active" | "inactive" | "archived";
  disabled?: boolean;
  nextStatus: "active" | "inactive" | "archived";
}) {
  const { pending } = useFormStatus();

  const idleLabel =
    currentStatus === "draft" && nextStatus === "active"
      ? "Publish"
      : currentStatus === "draft" && nextStatus === "archived"
        ? "Discard draft"
        : nextStatus === "inactive"
          ? "Deactivate"
          : "Reactivate";
  const pendingLabel =
    currentStatus === "draft" && nextStatus === "active"
      ? "Publishing..."
      : currentStatus === "draft" && nextStatus === "archived"
        ? "Discarding..."
        : nextStatus === "inactive"
          ? "Deactivating..."
          : "Reactivating...";

  return (
    <button
      aria-busy={pending}
      className={className}
      disabled={pending || disabledProp}
      type="submit"
    >
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}

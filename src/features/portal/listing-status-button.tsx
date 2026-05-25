"use client";

import { useFormStatus } from "react-dom";

export function ListingStatusButton({
  className,
  currentStatus,
  disabled: disabledProp,
  formAction,
  nextStatus,
  submitName,
  submitValue,
}: {
  className: string;
  currentStatus: "draft" | "active" | "inactive" | "archived";
  disabled?: boolean;
  formAction?: string | ((formData: FormData) => void | Promise<void>);
  nextStatus: "active" | "inactive" | "archived";
  submitName?: string;
  submitValue?: string;
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
      formAction={formAction}
      name={submitName}
      type="submit"
      value={submitValue}
    >
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}

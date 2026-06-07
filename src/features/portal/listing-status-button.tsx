"use client";

import { useTransition } from "react";

import { Button } from "@/components/ui/button";

export function ListingStatusButton({
  className,
  currentStatus,
  disabled: disabledProp,
  formAction,
  nextStatus,
  submitName,
  submitValue,
}: {
  className?: string;
  currentStatus: "draft" | "active" | "inactive" | "archived";
  disabled?: boolean;
  formAction?: ((formData: FormData) => void | Promise<void>);
  nextStatus: "active" | "inactive" | "archived";
  submitName?: string;
  submitValue?: string;
}) {
  const [pending, startTransition] = useTransition();

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

  function handleClick() {
    if (!formAction) return;
    const formData = new FormData();
    if (submitName) formData.set(submitName, submitValue ?? "");
    startTransition(() => formAction(formData));
  }

  return (
    <Button
      aria-busy={pending}
      className={className}
      disabled={pending || disabledProp}
      onClick={handleClick}
      type="button"
      variant="secondary"
    >
      {pending ? pendingLabel : idleLabel}
    </Button>
  );
}

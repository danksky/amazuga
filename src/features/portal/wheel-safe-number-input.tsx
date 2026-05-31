"use client";

import type { ComponentPropsWithoutRef, WheelEvent } from "react";

type WheelSafeNumberInputProps = Omit<ComponentPropsWithoutRef<"input">, "type">;

export function WheelSafeNumberInput(props: WheelSafeNumberInputProps) {
  const { onWheel, ...rest } = props;

  const handleWheel = (event: WheelEvent<HTMLInputElement>) => {
    if (document.activeElement === event.currentTarget) {
      event.preventDefault();
      event.currentTarget.blur();
    }

    onWheel?.(event);
  };

  return <input {...rest} onWheel={handleWheel} type="number" />;
}

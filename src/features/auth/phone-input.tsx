"use client";

import { useState } from "react";

import styles from "./auth-page.module.css";

const DEFAULT_PREFIX = "+250";
const US_PREFIX = "+1";

function parseInitialValue(value?: string): { prefix: string; local: string } {
  if (!value) return { prefix: DEFAULT_PREFIX, local: "" };
  if (value.startsWith("+1")) return { prefix: US_PREFIX, local: value.slice(2).trim() };
  if (value.startsWith("+250")) return { prefix: DEFAULT_PREFIX, local: value.slice(4).trim() };
  return { prefix: DEFAULT_PREFIX, local: value.replace(/^\+/, "") };
}

export function PhoneInput({ initialValue }: { initialValue?: string }) {
  const parsed = parseInitialValue(initialValue);
  const [prefix, setPrefix] = useState(parsed.prefix);
  const [local, setLocal] = useState(parsed.local);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;

    // +1… → switch to US
    if (raw.startsWith("+1")) {
      setPrefix(US_PREFIX);
      setLocal(raw.slice(2).trimStart());
      return;
    }

    // +250… → confirm/switch to Rwanda
    if (raw.startsWith("+250")) {
      setPrefix(DEFAULT_PREFIX);
      setLocal(raw.slice(4).trimStart());
      return;
    }

    // +, +2, +25 — hold in place; user may still be completing +250
    if (/^\+2?5?$/.test(raw)) {
      setLocal(raw);
      return;
    }

    // Anything else starting with + that isn't a known prefix → strip the +
    setLocal(raw.replace(/^\+/g, ""));
  }

  const fullPhone = local.trim() ? `${prefix}${local.replace(/\s/g, "") ? " " + local.trim() : ""}` : "";

  return (
    <div className={styles.phoneWrapper}>
      <span className={styles.phonePrefix}>{prefix}</span>
      <input
        autoComplete="tel-national"
        className={styles.phoneLocal}
        inputMode="tel"
        onChange={handleChange}
        placeholder="788 000 000"
        type="tel"
        value={local}
      />
      <input name="phone" type="hidden" value={fullPhone} />
    </div>
  );
}

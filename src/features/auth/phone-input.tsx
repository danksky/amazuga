"use client";

import { useState } from "react";

import styles from "./auth-page.module.css";

const DEFAULT_PREFIX = "+250";
const US_PREFIX = "+1";

export function PhoneInput() {
  const [prefix, setPrefix] = useState(DEFAULT_PREFIX);
  const [local, setLocal] = useState("");

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;

    // Easter egg: +1 prefix switch
    if (raw.startsWith("+1")) {
      setPrefix(US_PREFIX);
      setLocal(raw.slice(2).trimStart());
      return;
    }

    // Allow bare "+" to sit while the user might still be typing "+1"
    if (raw === "+") {
      setLocal("+");
      return;
    }

    // Strip accidental re-entry of the country code prefix
    setLocal(raw.replace(/^\+250\s*/g, "").replace(/^\+/g, ""));
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

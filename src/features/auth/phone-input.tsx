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

    // Easter egg: typing +1 anywhere switches to US prefix
    if (raw.includes("+1")) {
      setPrefix(US_PREFIX);
      setLocal(raw.replace(/\+1/g, "").trimStart());
      return;
    }

    // Strip any accidental leading + or country code re-entry
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

"use client";

import { useEffect, useRef, useState } from "react";

import styles from "./auth-page.module.css";

type TurnstileApi = {
  remove: (widgetId: string) => void;
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      callback: (token: string) => void;
      "error-callback": () => void;
      "expired-callback": () => void;
    },
  ) => string;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const turnstileScriptUrl = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export function Turnstile({ action }: { action: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | undefined>(undefined);
  const [token, setToken] = useState("");

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;

    let active = true;
    const render = () => {
      if (!active || !containerRef.current || !window.turnstile || widgetIdRef.current) return;

      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        action,
        callback: setToken,
        "error-callback": () => setToken(""),
        "expired-callback": () => setToken(""),
      });
    };

    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${turnstileScriptUrl}"]`);
    const script = existingScript ?? document.createElement("script");

    if (!existingScript) {
      script.src = turnstileScriptUrl;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    script.addEventListener("load", render);
    render();

    return () => {
      active = false;
      script.removeEventListener("load", render);
      if (widgetIdRef.current && window.turnstile) window.turnstile.remove(widgetIdRef.current);
    };
  }, [action]);

  if (!siteKey) return null;

  return (
    <div className={styles.captcha}>
      <div ref={containerRef} />
      <input name="captchaToken" type="hidden" value={token} />
    </div>
  );
}

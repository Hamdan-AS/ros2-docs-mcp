"use client";

import Script from "next/script";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

const apiOrigin = "https://ros2-docs-mcp.notriful-beligum.workers.dev";

declare global {
  interface Window {
    turnstile?: {
      render(container: HTMLElement, options: Record<string, unknown>): string;
      remove(widgetId: string): void;
      reset(widgetId: string): void;
    };
  }
}

export default function SignupForm() {
  const [stage, setStage] = useState<"signup" | "verify" | "complete">("signup");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [siteKey, setSiteKey] = useState<string | null>(null);
  const [publicEnabled, setPublicEnabled] = useState(false);
  const [scriptReady, setScriptReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Preparing secure signup...");
  const widgetContainer = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    fetch(`${apiOrigin}/signup/config`, { headers: { accept: "application/json" } })
      .then(async (response) => {
        if (!response.ok) throw new Error("configuration unavailable");
        return response.json() as Promise<{ enabled?: boolean; mode?: "disabled" | "operator_test" | "public"; turnstile_site_key?: string | null }>;
      })
      .then((config) => {
        if (config.mode === "operator_test") {
          setMessage("Private operator testing is active. Public signup opens after a sending domain is verified.");
          return;
        }
        if (!config.enabled || config.mode !== "public" || !config.turnstile_site_key) throw new Error("signup is not enabled");
        setSiteKey(config.turnstile_site_key);
        setPublicEnabled(true);
        setMessage("Complete the security check, then enter your email.");
      })
      .catch(() => setMessage("Self-serve signup is temporarily unavailable. Please try again later."));
  }, []);

  const renderWidget = useCallback(() => {
    if (!scriptReady || !siteKey || !window.turnstile || !widgetContainer.current || stage === "complete") return;
    if (widgetId.current) window.turnstile.remove(widgetId.current);
    setToken(null);
    widgetId.current = window.turnstile.render(widgetContainer.current, {
      sitekey: siteKey,
      action: stage,
      callback: (nextToken: string) => setToken(nextToken),
      "expired-callback": () => setToken(null),
      "error-callback": () => setToken(null),
      theme: "light",
    });
  }, [scriptReady, siteKey, stage]);

  useEffect(() => {
    renderWidget();
    return () => {
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [renderWidget]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || busy) return;
    setBusy(true);
    setMessage("Processing securely...");
    try {
      const response = await fetch(`${apiOrigin}/${stage}`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ email, otp: stage === "verify" ? otp : undefined, turnstile_token: token }),
      });
      const result = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to continue.");
      if (stage === "signup") {
        setStage("verify");
        setMessage("If eligible, a six-digit code is on its way. Check spam too.");
      } else {
        setStage("complete");
        setMessage("If verification succeeded, your private MCP key is being delivered by email.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to continue. Please retry.");
      if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current);
      setToken(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {siteKey && <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
      />}
      <form className="signupForm" onSubmit={submit}>
        <div className="formField">
          <label htmlFor="signup-email">Email address</label>
          <input
            id="signup-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            value={email}
            disabled={!publicEnabled || stage !== "signup" || busy}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        {stage === "verify" && (
          <div className="formField">
            <label htmlFor="signup-otp">Six-digit verification code</label>
            <input
              id="signup-otp"
              name="otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              minLength={6}
              maxLength={6}
              required
              value={otp}
              disabled={busy}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
            />
          </div>
        )}
        {stage !== "complete" && <div className="turnstileSlot" ref={widgetContainer} aria-label="Bot protection check" />}
        <p className="formMessage" role="status" aria-live="polite">{message}</p>
        {stage !== "complete" && (
          <button className="button primary" type="submit" disabled={!publicEnabled || !token || busy || !siteKey}>
            {busy ? "Please wait..." : stage === "signup" ? "Email me a code" : "Verify and email my key"}
          </button>
        )}
      </form>
    </>
  );
}

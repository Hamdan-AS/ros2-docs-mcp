import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import { authenticateBearer, bearerToken, consumeQuota, effectiveCreditLimit } from "./access.js";
import { buildServer } from "./mcp.js";
import { NeonHttpRepository } from "./worker-repository.js";
import { localeForCountry, quotaError, quotaHeaders, signupMode, supportUrl } from "./runtime-policy.js";
import {
  hashSignupValue,
  requestSignup,
  secureHexEqual,
  SignupInputError,
  SignupUnavailableError,
  verifySignup,
  type SignupDependencies,
} from "./signup.js";

export interface Env {
  DATABASE_URL: string;
  CREDIT_LIMIT?: string;
  /** Deprecated deployment alias retained during the credit-model rollout. */
  RATE_LIMIT_DAILY?: string;
  /** Comma-separated browser origins allowed to call /mcp. */
  ALLOWED_ORIGINS?: string;
  /** Public Turnstile site key returned by /signup/config. */
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
  TURNSTILE_HOSTNAME?: string;
  OTP_PEPPER?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  SIGNUP_MODE?: string;
  SIGNUP_TEST_EMAIL_HASH?: string;
  SUPPORT_URL?: string;
}

function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("content-type", "application/json; charset=utf-8");
  responseHeaders.set("cache-control", "no-store");
  return new Response(JSON.stringify(body), { status, headers: responseHeaders });
}

function creditLimit(value: string | undefined): number {
  const parsed = Number(value ?? 75);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 75;
}

function retryAfterSeconds(resetAt: string): number {
  const remaining = Math.ceil((new Date(resetAt).getTime() - Date.now()) / 1000);
  return Math.max(1, remaining);
}

function allowedOrigins(env: Env): string[] {
  return (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function originResponse(request: Request, env: Env): Response | undefined {
  const origin = request.headers.get("origin");
  // Non-browser MCP clients normally have no Origin header. Browser requests
  // must be explicitly allow-listed to prevent DNS-rebinding/cross-origin use.
  if (!origin) return undefined;
  if (!allowedOrigins(env).includes(origin)) {
    return json({ error: "Forbidden origin." }, 403);
  }
  return undefined;
}

function corsHeaders(request: Request, env: Env): HeadersInit {
  const origin = request.headers.get("origin");
  if (!origin || !allowedOrigins(env).includes(origin)) return {};
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-headers": "authorization, content-type, accept, mcp-protocol-version, mcp-session-id, last-event-id",
    "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
    "access-control-expose-headers": "retry-after, x-ratelimit-limit, x-ratelimit-remaining, x-ratelimit-reset-at, x-ros2-docs-warning",
    vary: "Origin",
  };
}

function addCors(response: Response, request: Request, env: Env): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders(request, env))) headers.set(key, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function signupConfigured(env: Env): boolean {
  const mode = signupMode(env.SIGNUP_MODE);
  const baseConfigured = Boolean(
    env.DATABASE_URL && env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET_KEY &&
    env.OTP_PEPPER && env.RESEND_API_KEY && env.RESEND_FROM_EMAIL
  );
  return baseConfigured && mode !== "disabled" &&
    (mode !== "operator_test" || /^[a-f0-9]{64}$/i.test(env.SIGNUP_TEST_EMAIL_HASH ?? ""));
}

function requestCountry(request: Request): string | null | undefined {
  return (request as Request & { cf?: { country?: string | null } }).cf?.country;
}

async function readSmallJson(request: Request): Promise<Record<string, unknown>> {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > 8192) throw new SignupInputError("Invalid signup input.");
  const text = await request.text();
  if (text.length > 8192) throw new SignupInputError("Invalid signup input.");
  const body: unknown = JSON.parse(text);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new SignupInputError("Invalid signup input.");
  }
  return body as Record<string, unknown>;
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

async function sendResendEmail(
  env: Env,
  message: { to: string; subject: string; text: string; html: string; idempotencyKey: string }
): Promise<void> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
      "idempotency-key": message.idempotencyKey,
    },
    body: JSON.stringify({
      from: env.RESEND_FROM_EMAIL,
      to: [message.to],
      subject: message.subject,
      text: message.text,
      html: message.html,
    }),
  });
  if (!response.ok) throw new Error("Email provider rejected request.");
}

function signupDependencies(env: Env, repository: NeonHttpRepository): SignupDependencies {
  return {
    repository,
    otpPepper: env.OTP_PEPPER!,
    async emailAllowed(email) {
      const mode = signupMode(env.SIGNUP_MODE);
      if (mode === "public") return true;
      if (mode !== "operator_test" || !env.SIGNUP_TEST_EMAIL_HASH) return false;
      const actual = await hashSignupValue(`allow:${email}`, env.OTP_PEPPER!);
      return secureHexEqual(actual, env.SIGNUP_TEST_EMAIL_HASH.toLowerCase());
    },
    async verifyHuman(token, action, remoteIp) {
      const form = new FormData();
      form.set("secret", env.TURNSTILE_SECRET_KEY!);
      form.set("response", token);
      if (remoteIp) form.set("remoteip", remoteIp);
      form.set("idempotency_key", crypto.randomUUID());
      const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        body: form,
      });
      if (!response.ok) return false;
      const result = await response.json() as { success?: boolean; action?: string; hostname?: string };
      return result.success === true && result.action === action &&
        (!env.TURNSTILE_HOSTNAME || result.hostname === env.TURNSTILE_HOSTNAME);
    },
    async sendOtp(email, otp) {
      await sendResendEmail(env, {
        to: email,
        subject: "Your ROS2-Docs verification code",
        text: `Your ROS2-Docs verification code is ${otp}. It expires in 10 minutes. If you did not request it, ignore this email.`,
        html: `<p>Your ROS2-Docs verification code is <strong>${escapeHtml(otp)}</strong>.</p><p>It expires in 10 minutes. If you did not request it, ignore this email.</p>`,
        idempotencyKey: `signup-otp-${await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${email}:${otp}`)).then((bytes) => Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join(""))}`,
      });
    },
    async sendKey(email, apiKey, idempotencyKey) {
      await sendResendEmail(env, {
        to: email,
        subject: "Your ROS2-Docs MCP access key",
        text: `Your ROS2-Docs MCP key is ${apiKey}\n\nStore it in a password manager. It is shown only in this private email. Never post it publicly.`,
        html: `<p>Your ROS2-Docs MCP key is:</p><p><code>${escapeHtml(apiKey)}</code></p><p>Store it in a password manager. It is shown only in this private email. Never post it publicly.</p>`,
        idempotencyKey,
      });
    },
  };
}

async function handleSignup(request: Request, env: Env, verify: boolean): Promise<Response> {
  const deniedOrigin = originResponse(request, env);
  if (deniedOrigin) return deniedOrigin;
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request, env) });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, { ...corsHeaders(request, env), allow: "POST, OPTIONS" });
  if (!signupConfigured(env)) return json({ error: "Signup is temporarily unavailable." }, 503, corsHeaders(request, env));

  try {
    const body = await readSmallJson(request);
    const repository = new NeonHttpRepository(env.DATABASE_URL);
    const dependencies = signupDependencies(env, repository);
    const remoteIp = request.headers.get("cf-connecting-ip") ?? undefined;
    if (verify) {
      await verifySignup(
        { email: body.email, otp: body.otp, turnstileToken: body.turnstile_token },
        dependencies,
        remoteIp
      );
    } else {
      await requestSignup(
        { email: body.email, turnstileToken: body.turnstile_token },
        dependencies,
        remoteIp
      );
    }
    return json(
      { message: verify ? "If verification succeeds, your key will arrive by email." : "If eligible, a verification code will arrive by email." },
      202,
      corsHeaders(request, env)
    );
  } catch (error) {
    if (error instanceof SignupInputError || error instanceof SyntaxError) {
      return json({ error: "Unable to process signup." }, 400, corsHeaders(request, env));
    }
    if (error instanceof SignupUnavailableError) {
      return json({ error: "Signup is temporarily unavailable. Please retry later." }, 503, corsHeaders(request, env));
    }
    throw error;
  }
}

async function handleMcp(request: Request, env: Env): Promise<Response> {
  const deniedOrigin = originResponse(request, env);
  if (deniedOrigin) return deniedOrigin;

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request, env) });
  }

  const authorization = request.headers.get("authorization");
  if (!bearerToken(authorization)) {
    return json({ error: "Unauthorized: missing or invalid API key." }, 401, corsHeaders(request, env));
  }
  if (!env.DATABASE_URL) {
    return json({ error: "Service temporarily unavailable." }, 503, corsHeaders(request, env));
  }

  const repository = new NeonHttpRepository(env.DATABASE_URL);
  const identity = await authenticateBearer(authorization, repository);
  if (!identity) return json({ error: "Unauthorized: missing or invalid API key." }, 401, corsHeaders(request, env));

  const limit = effectiveCreditLimit(identity.user, creditLimit(env.CREDIT_LIMIT ?? env.RATE_LIMIT_DAILY));
  const quota = await consumeQuota(identity.user.id, limit, repository);
  if (!quota.allowed) {
    if (!quota.cooldown_until) throw new Error("Rejected quota result omitted cooldown_until.");
    const configuredSupportUrl = supportUrl(env.SUPPORT_URL);
    return json(
      {
        error: quotaError(localeForCountry(requestCountry(request))),
        reason: "self_funded_capacity",
        reset_at: quota.cooldown_until,
        ...(configuredSupportUrl ? { support_url: configuredSupportUrl } : {}),
      },
      429,
      {
        ...corsHeaders(request, env),
        ...quotaHeaders(limit, quota),
        "retry-after": String(retryAfterSeconds(quota.cooldown_until)),
      }
    );
  }

  const transport = new WebStandardStreamableHTTPServerTransport({
    // Each request gets a fresh server and transport, so no Worker-instance
    // session state is required or retained.
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  const server = buildServer(repository);
  await server.connect(transport);
  const response = addCors(await transport.handleRequest(request), request, env);
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(quotaHeaders(limit, quota))) headers.set(key, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      if (request.method !== "GET") return json({ error: "Method not allowed." }, 405, { allow: "GET" });
      return json({ status: "ok", service: "ros2-docs-mcp" });
    }
    if (url.pathname === "/signup/config") {
      const deniedOrigin = originResponse(request, env);
      if (deniedOrigin) return deniedOrigin;
      if (request.method !== "GET") return json({ error: "Method not allowed." }, 405, { allow: "GET" });
      const configured = signupConfigured(env);
      const mode = configured ? signupMode(env.SIGNUP_MODE) : "disabled";
      return json({
        enabled: configured && mode === "public",
        mode,
        turnstile_site_key: configured ? env.TURNSTILE_SITE_KEY ?? null : null,
      }, 200, corsHeaders(request, env));
    }
    if (url.pathname === "/signup" || url.pathname === "/verify") {
      try {
        return await handleSignup(request, env, url.pathname === "/verify");
      } catch {
        console.error("Signup request failed");
        return json({ error: "Internal server error." }, 500, corsHeaders(request, env));
      }
    }
    if (url.pathname !== "/mcp") return json({ error: "Not found." }, 404);

    try {
      return await handleMcp(request, env);
    } catch {
      // Do not expose database URLs, API keys, or driver errors in the public API.
      console.error("MCP request failed");
      return json({ error: "Internal server error." }, 500, corsHeaders(request, env));
    }
  },
} satisfies ExportedHandler<Env>;

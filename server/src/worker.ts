import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import { authenticateBearer, bearerToken, consumeQuota, effectiveCreditLimit } from "./access.js";
import { buildServer } from "./mcp.js";
import { NeonHttpRepository } from "./worker-repository.js";

export interface Env {
  DATABASE_URL: string;
  CREDIT_LIMIT?: string;
  /** Deprecated deployment alias retained during the credit-model rollout. */
  RATE_LIMIT_DAILY?: string;
  /** Comma-separated browser origins allowed to call /mcp. */
  ALLOWED_ORIGINS?: string;
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
    vary: "Origin",
  };
}

function addCors(response: Response, request: Request, env: Env): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders(request, env))) headers.set(key, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
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
    return json(
      {
        error: `Credit limit reached. Access is paused for 48 hours after credit ${limit} was consumed.`,
        reset_at: quota.cooldown_until,
      },
      429,
      { ...corsHeaders(request, env), "retry-after": String(retryAfterSeconds(quota.cooldown_until)) }
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
  return addCors(await transport.handleRequest(request), request, env);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      if (request.method !== "GET") return json({ error: "Method not allowed." }, 405, { allow: "GET" });
      return json({ status: "ok", service: "ros2-docs-mcp" });
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

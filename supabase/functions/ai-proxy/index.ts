/**
 * AI proxy — transport layer.
 *
 * Responsibilities: CORS, method and size checks, task dispatch, timeout policy,
 * neutral error mapping, and PII-free logging. It knows nothing about any
 * specific AI provider.
 *
 * SECURITY POSTURE (accurate as of this stage — do not overstate it):
 *   Real guarantees
 *     - The provider credential exists only in Supabase secrets. It is never
 *       sent to any client and never appears in a build artifact.
 *     - Only the four predefined tasks are callable. There is no free-form
 *       prompt path, so this endpoint cannot be repurposed as a general chat
 *       service.
 *     - Request bodies are never logged, so candidate PII does not reach logs.
 *     - Request size is capped server-side.
 *   Best-effort only (reduces abuse probability, does NOT authenticate anyone)
 *     - CORS blocks other websites from calling this from a user's browser. It
 *       does nothing against a direct request from a script.
 *     - Per-IP rate limiting is per-instance and in-memory. Edge instances are
 *       ephemeral and horizontally scaled, so the effective limit is looser than
 *       the constant suggests, and it does not survive an IP rotation.
 *     - Supabase's gateway requires a publishable anon key. That key ships in
 *       the client, so it is public by design and is NOT caller authentication.
 *   Not solved at this stage
 *     - Caller identity. Until Supabase Auth is wired up, anyone who has the
 *       function URL and the public anon key can invoke it. The real spend
 *       control is the hard quota cap set on the provider side.
 *   Upgrade path: enable JWT verification for this function and read the
 *     authenticated user from the request. No structural change required.
 */

import { ProxyError } from "./provider.ts";
import { resolveProvider } from "./providers/index.ts";
import { isTaskName, TASKS } from "./tasks.ts";

/** Hard ceiling on the whole JSON envelope, checked before parsing. */
const MAX_BODY_BYTES = 8 * 1024 * 1024;

/** Upstream call budget. Keeps a hung provider from pinning the instance. */
const PROVIDER_TIMEOUT_MS = 60_000;

/** Best-effort in-memory throttle. See the posture note above. */
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 30;
const recentCalls = new Map<string, number[]>();

/**
 * Origins allowed to call this from a browser or native WebView.
 *
 * Capacitor's WebViews use fixed non-http origins: `capacitor://localhost` on
 * iOS and `https://localhost` on Android. These are the values for the current
 * default Capacitor scheme config; confirm against a real device build before
 * relying on them, since Capacitor has changed defaults across major versions.
 */
const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "capacitor://localhost",
  "https://localhost",
];

const allowedOrigins = (): string[] => {
  const configured = Deno.env.get("ALLOWED_ORIGINS");
  if (!configured) return DEFAULT_ALLOWED_ORIGINS;
  return configured.split(",").map((value) => value.trim()).filter(Boolean);
};

const corsHeaders = (origin: string | null): Record<string, string> => {
  const headers: Record<string, string> = {
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type, apikey",
    "Access-Control-Max-Age": "86400",
  };
  if (origin && allowedOrigins().includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
};

const json = (
  body: unknown,
  status: number,
  origin: string | null,
): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });

const fail = (error: ProxyError, origin: string | null): Response =>
  json({ error: { code: error.code, message: error.message } }, error.httpStatus, origin);

/** Returns true when the caller is over budget for the current window. */
const isRateLimited = (key: string): boolean => {
  const now = Date.now();
  const window = (recentCalls.get(key) ?? []).filter(
    (at) => now - at < RATE_LIMIT_WINDOW_MS,
  );
  window.push(now);
  recentCalls.set(key, window);

  // Opportunistic sweep so an ephemeral instance cannot grow this map forever.
  if (recentCalls.size > 5_000) {
    for (const [entryKey, timestamps] of recentCalls) {
      if (timestamps.every((at) => now - at >= RATE_LIMIT_WINDOW_MS)) {
        recentCalls.delete(entryKey);
      }
    }
  }

  return window.length > RATE_LIMIT_MAX_REQUESTS;
};

const clientKey = (request: Request): string =>
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
  request.headers.get("cf-connecting-ip") ||
  "unknown";

/**
 * Structured, PII-free log line. Only the task name, outcome, duration, and
 * provider id are recorded — never request content, never the credential.
 */
const logOutcome = (fields: {
  task: string;
  provider: string;
  outcome: "ok" | "error";
  code?: string;
  ms: number;
}): void => {
  console.log(JSON.stringify({ event: "ai_proxy", ...fields }));
};

Deno.serve(async (request: Request): Promise<Response> => {
  const origin = request.headers.get("origin");
  const startedAt = Date.now();

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (request.method !== "POST") {
    return fail(
      new ProxyError("METHOD_NOT_ALLOWED", "Only POST is supported.", 405),
      origin,
    );
  }

  let task = "unknown";
  let providerId = "unknown";

  try {
    if (isRateLimited(clientKey(request))) {
      throw new ProxyError(
        "PROVIDER_RATE_LIMITED",
        "Too many requests. Please retry shortly.",
        429,
      );
    }

    const declaredLength = Number(request.headers.get("content-length") ?? "0");
    if (declaredLength > MAX_BODY_BYTES) {
      throw new ProxyError("PAYLOAD_TOO_LARGE", "Request body is too large.", 413);
    }

    const rawBody = await request.arrayBuffer();
    if (rawBody.byteLength > MAX_BODY_BYTES) {
      // Re-checked after reading: content-length can be absent or dishonest.
      throw new ProxyError("PAYLOAD_TOO_LARGE", "Request body is too large.", 413);
    }

    let envelope: unknown;
    try {
      envelope = JSON.parse(new TextDecoder().decode(rawBody));
    } catch {
      throw new ProxyError("BAD_REQUEST", "Request body must be valid JSON.", 400);
    }

    if (typeof envelope !== "object" || envelope === null) {
      throw new ProxyError("BAD_REQUEST", "Request body must be a JSON object.", 400);
    }

    const { task: requestedTask, input } = envelope as Record<string, unknown>;

    if (!isTaskName(requestedTask)) {
      throw new ProxyError(
        "UNSUPPORTED_TASK",
        "Unknown task. Supported: " + Object.keys(TASKS).join(", ") + ".",
        400,
      );
    }
    task = requestedTask;

    if (typeof input !== "object" || input === null || Array.isArray(input)) {
      throw new ProxyError("BAD_REQUEST", 'Field "input" must be an object.', 400);
    }

    const definition = TASKS[task];
    const parts = definition.buildParts(input as Record<string, unknown>);

    const provider = resolveProvider();
    providerId = provider.id;

    const timeout = AbortSignal.timeout(PROVIDER_TIMEOUT_MS);
    const raw = await provider.generateStructured({
      parts,
      schema: definition.schema,
      signal: timeout,
    });

    if (typeof raw !== "object" || raw === null) {
      throw new ProxyError(
        "INVALID_PROVIDER_OUTPUT",
        "AI provider returned an unexpected shape.",
        502,
      );
    }

    const data = definition.pick(raw as Record<string, unknown>);
    logOutcome({
      task,
      provider: providerId,
      outcome: "ok",
      ms: Date.now() - startedAt,
    });
    return json({ data }, 200, origin);
  } catch (error) {
    const proxyError = error instanceof ProxyError
      ? error
      : new ProxyError("PROVIDER_ERROR", "Unexpected server error.", 500);

    logOutcome({
      task,
      provider: providerId,
      outcome: "error",
      code: proxyError.code,
      ms: Date.now() - startedAt,
    });

    if (!(error instanceof ProxyError)) {
      // Log the class only. The message could embed request content.
      console.error(
        JSON.stringify({
          event: "ai_proxy_unexpected",
          errorName: error instanceof Error ? error.name : typeof error,
        }),
      );
    }

    return fail(proxyError, origin);
  }
});

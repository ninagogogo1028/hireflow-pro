/**
 * Provider contract (provider-neutral).
 *
 * This module defines the vocabulary the task layer is allowed to use. It must
 * stay free of any vendor-specific concept: no model names, no endpoints, no
 * SDK types, no vendor schema dialects.
 *
 * Adding a new provider (OpenAI / Anthropic / DeepSeek / Kimi / GLM ...) means
 * adding a file under ./providers that satisfies `AiProvider`, then listing it
 * in `resolveProvider`. Nothing else in the function should need to change.
 */

/** Minimal JSON Schema subset used to describe the shape we want back. */
export type JsonSchema =
  | { type: "string"; description?: string }
  | { type: "number"; description?: string }
  | { type: "boolean"; description?: string }
  | { type: "array"; description?: string; items: JsonSchema }
  | {
    type: "object";
    description?: string;
    properties: Record<string, JsonSchema>;
    /** Property names in the order we want them emitted, when supported. */
    order?: string[];
    required?: string[];
  };

/** One piece of model input. Files stay base64 here; providers re-encode. */
export type Part =
  | { kind: "text"; text: string }
  | { kind: "file"; mimeType: string; dataBase64: string };

export interface StructuredRequest {
  parts: Part[];
  /** Shape the provider must return, expressed in the neutral subset above. */
  schema: JsonSchema;
  /** Abort signal so the transport layer owns the timeout policy. */
  signal?: AbortSignal;
}

export interface AiProvider {
  /** Stable identifier, safe to log. */
  readonly id: string;
  /**
   * Runs the request and returns parsed JSON matching `schema`.
   * Implementations must throw `ProxyError` on failure and must never include
   * request content or credentials in thrown messages.
   */
  generateStructured(request: StructuredRequest): Promise<unknown>;
}

/**
 * Error codes are provider-neutral on purpose: clients switch on these, so
 * swapping providers must not change the client's error handling.
 */
export type ErrorCode =
  | "BAD_REQUEST"
  | "METHOD_NOT_ALLOWED"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_TASK"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "SERVER_MISCONFIGURED"
  | "PROVIDER_ERROR"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_RATE_LIMITED"
  | "INVALID_PROVIDER_OUTPUT";

export class ProxyError extends Error {
  constructor(
    readonly code: ErrorCode,
    /** Safe for clients and logs: must not embed request content. */
    message: string,
    readonly httpStatus: number,
  ) {
    super(message);
    this.name = "ProxyError";
  }
}

/**
 * Which provider is active. A single env-backed constant is deliberate: this is
 * the seam for future work, not a plugin system. There is no per-request or
 * per-user provider selection yet, and no BYOK.
 */
export const activeProviderId = (): string =>
  Deno.env.get("AI_PROVIDER")?.trim() || "gemini";

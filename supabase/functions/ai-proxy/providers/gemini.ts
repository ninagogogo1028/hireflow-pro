/**
 * Gemini provider — the ONLY file that knows Gemini exists.
 *
 * Everything vendor-specific lives here: endpoint, model name, request body
 * shape, schema dialect, error payload shape, credential env var.
 *
 * Deliberately uses the REST API over `fetch` rather than @google/genai so the
 * function has no third-party dependencies to audit or update.
 */

import {
  type AiProvider,
  type JsonSchema,
  type Part,
  ProxyError,
  type StructuredRequest,
} from "../provider.ts";

const MODEL = "gemini-3-flash-preview";
const ENDPOINT_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/** Neutral schema subset -> Gemini's uppercase OpenAPI-ish dialect. */
const toGeminiSchema = (schema: JsonSchema): Record<string, unknown> => {
  switch (schema.type) {
    case "string":
    case "number":
    case "boolean":
      return {
        type: schema.type.toUpperCase(),
        ...(schema.description ? { description: schema.description } : {}),
      };
    case "array":
      return {
        type: "ARRAY",
        ...(schema.description ? { description: schema.description } : {}),
        items: toGeminiSchema(schema.items),
      };
    case "object": {
      const properties: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(schema.properties)) {
        properties[key] = toGeminiSchema(value);
      }
      return {
        type: "OBJECT",
        ...(schema.description ? { description: schema.description } : {}),
        properties,
        ...(schema.order ? { propertyOrdering: schema.order } : {}),
        ...(schema.required ? { required: schema.required } : {}),
      };
    }
  }
};

const toGeminiPart = (part: Part): Record<string, unknown> =>
  part.kind === "text"
    ? { text: part.text }
    : { inlineData: { mimeType: part.mimeType, data: part.dataBase64 } };

/**
 * Maps upstream HTTP status to a neutral code. Upstream response bodies are
 * intentionally NOT propagated: they can echo back submitted content, which
 * would leak candidate PII into client responses and logs.
 */
const mapUpstreamStatus = (status: number): ProxyError => {
  if (status === 429) {
    return new ProxyError(
      "PROVIDER_RATE_LIMITED",
      "AI provider rate limit or quota reached.",
      503,
    );
  }
  if (status === 401 || status === 403) {
    // Almost always a bad/revoked key or a quota-disabled project. This is an
    // operator problem, not a caller problem.
    return new ProxyError(
      "SERVER_MISCONFIGURED",
      "AI provider rejected the server credential.",
      500,
    );
  }
  return new ProxyError(
    "PROVIDER_ERROR",
    `AI provider returned an unexpected status (${status}).`,
    502,
  );
};

export const createGeminiProvider = (): AiProvider => {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    throw new ProxyError(
      "SERVER_MISCONFIGURED",
      "Server credential is not configured.",
      500,
    );
  }

  return {
    id: "gemini",

    async generateStructured(
      { parts, schema, signal }: StructuredRequest,
    ): Promise<unknown> {
      const body = {
        contents: [{ role: "user", parts: parts.map(toGeminiPart) }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: toGeminiSchema(schema),
        },
      };

      let response: Response;
      try {
        response = await fetch(
          `${ENDPOINT_BASE}/${MODEL}:generateContent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              // Header rather than query string: keeps the key out of any
              // URL that might be logged by an intermediary.
              "x-goog-api-key": apiKey,
            },
            body: JSON.stringify(body),
            signal,
          },
        );
      } catch {
        // Check the signal rather than the thrown error: runtimes disagree on
        // how an aborted fetch surfaces (Deno raises a TypeError, not a
        // DOMException named "AbortError"), but the signal state is definitive.
        if (signal?.aborted) {
          throw new ProxyError(
            "PROVIDER_TIMEOUT",
            "AI provider did not respond in time.",
            504,
          );
        }
        throw new ProxyError(
          "PROVIDER_ERROR",
          "Could not reach the AI provider.",
          502,
        );
      }

      if (!response.ok) {
        // Drain so the connection can be reused; discard the body unread.
        await response.body?.cancel();
        throw mapUpstreamStatus(response.status);
      }

      let payload: {
        candidates?: Array<
          { content?: { parts?: Array<{ text?: string }> } }
        >;
      };
      try {
        payload = await response.json();
      } catch {
        throw new ProxyError(
          "INVALID_PROVIDER_OUTPUT",
          "AI provider returned a malformed response.",
          502,
        );
      }

      const text = payload.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? "")
        .join("")
        .trim();

      if (!text) {
        // Typically a safety block or an empty candidate list.
        throw new ProxyError(
          "INVALID_PROVIDER_OUTPUT",
          "AI provider returned no usable content.",
          502,
        );
      }

      try {
        return JSON.parse(text);
      } catch {
        throw new ProxyError(
          "INVALID_PROVIDER_OUTPUT",
          "AI provider returned content that was not valid JSON.",
          502,
        );
      }
    },
  };
};

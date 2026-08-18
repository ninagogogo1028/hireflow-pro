/**
 * Provider resolution.
 *
 * Deliberately a switch, not a registry: adding a provider is one import and one
 * case. There is no dynamic loading, no per-request selection, and no BYOK — the
 * active provider is a server-side setting only.
 */

import { activeProviderId, type AiProvider, ProxyError } from "../provider.ts";
import { createGeminiProvider } from "./gemini.ts";

export const resolveProvider = (): AiProvider => {
  const id = activeProviderId();
  switch (id) {
    case "gemini":
      return createGeminiProvider();
    default:
      throw new ProxyError(
        "SERVER_MISCONFIGURED",
        `Unknown AI provider "${id}".`,
        500,
      );
  }
};

/**
 * Types for the build-time environment variables this app reads.
 *
 * Declared explicitly rather than via `vite/client` so the set of variables the
 * frontend depends on is visible in one place.
 *
 * Only `VITE_`-prefixed variables are exposed to client code by Vite. That
 * prefix is a deliberate safety boundary: anything carrying it is baked into the
 * bundle and is therefore public. Never put a provider credential here — that is
 * exactly the mistake this architecture removed. Server-side secrets belong in
 * Supabase Edge Function secrets.
 *
 * Both are optional: a missing value must fail with a clear message at call time
 * rather than being assumed present.
 */
interface ImportMetaEnv {
  /** Public URL of our own AI proxy function. */
  readonly VITE_AI_PROXY_URL?: string;
  /** Supabase publishable (anon) key. Public by design; grants no privileges. */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

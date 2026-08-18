import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// No `define` block for credentials here, on purpose.
//
// This config previously inlined GEMINI_API_KEY into the bundle via `define`,
// which put the key in plain text in every build artifact and every deployed
// asset. Any browser-visible value is public, so a client that calls an AI
// provider directly has nowhere to hide a key.
//
// AI calls now go through supabase/functions/ai-proxy, which holds the
// credential server-side. The client reads only `VITE_`-prefixed values, which
// Vite exposes by design and which are all public (see env.d.ts).
export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});

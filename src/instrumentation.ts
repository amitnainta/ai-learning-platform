// Next.js instrumentation hook — runs once per server runtime instance at
// startup, before any request is handled. Used to initialize Sentry for
// error tracking + performance/latency capture (NFR-OBS-001, NFR-OBS-003).
//
// This only covers the server and edge runtimes. The `register()` hook below
// is a Next.js server-side convention and never runs in the browser; the
// client-side Sentry init lives in `src/instrumentation-client.ts`, which
// Next.js loads natively into the client bundle (see that file's comment for
// why it isn't `sentry.client.config.ts`).
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;

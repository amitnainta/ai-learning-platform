// Next.js instrumentation hook — runs once per server runtime instance at
// startup, before any request is handled. Used to initialize Sentry for
// error tracking + performance/latency capture (NFR-OBS-001, NFR-OBS-003).
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

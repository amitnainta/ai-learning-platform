// Server-side (Node.js runtime) Sentry init. Loaded from
// src/instrumentation.ts. No-op when SENTRY_DSN is unset — see
// sentry.client.config.ts for the rationale.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  tracesSampleRate: 1.0,
});

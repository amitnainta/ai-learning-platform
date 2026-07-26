// Client-side Sentry init. Runs in the browser bundle.
//
// This is a deliberate no-op when NEXT_PUBLIC_SENTRY_DSN is unset (local
// dev, CI, and any environment before the human has provisioned a Sentry
// project) — Sentry.init() with `enabled: false` never opens a
// connection, so nothing errors and nothing is sent. See
// docs/runbooks/provisioning-checklist.md for how the DSN gets set.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  // Performance/latency capture (NFR-OBS-001). Tune down once real
  // traffic exists; 1.0 is fine for a low-traffic beta.
  tracesSampleRate: 1.0,
});

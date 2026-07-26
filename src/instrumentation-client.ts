// Client-side Sentry init. Runs in the browser bundle.
//
// This lives at `src/instrumentation-client.ts` (not `sentry.client.config.ts`)
// because that is the file Next.js itself natively loads into the client
// entrypoint (see https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation-client),
// independent of whichever bundler is in play. The older
// `sentry.client.config.ts` convention is only picked up by a webpack plugin
// that `withSentryConfig()` installs, and stops working entirely under
// Turbopack (which is what `next build`/`next dev` use in this project) — see
// the "ACTION REQUIRED"/deprecation warning `@sentry/nextjs` itself emits for
// that file name. Using this file means client Sentry works without needing
// to wrap `next.config.ts` in `withSentryConfig()` at all.
//
// Deliberate no-op when NEXT_PUBLIC_SENTRY_DSN is unset (local dev, CI, and
// any environment before the human has provisioned a Sentry project) —
// Sentry.init() with `enabled: false` never opens a connection, so nothing
// errors and nothing is sent. See docs/runbooks/provisioning-checklist.md for
// how the DSN gets set.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  // Performance/latency capture (NFR-OBS-001). Tune down once real
  // traffic exists; 1.0 is fine for a low-traffic beta.
  tracesSampleRate: 1.0,
});

// Required by @sentry/nextjs so client-side route transitions (App Router
// navigations) are captured as part of performance/latency monitoring.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

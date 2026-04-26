import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT ?? "demo",
  tracesSampleRate: 1.0, // 100% sampling — it's a demo
  sendDefaultPii: false,
  // Auto-propagate sentry-trace + baggage to fetches headed at the backend.
  // Localhost is included by default; we add the configured BACKEND_URL too.
  tracePropagationTargets: [
    "localhost",
    /^http:\/\/localhost:\d+/,
    ...(process.env.BACKEND_URL ? [process.env.BACKEND_URL] : []),
  ],
});

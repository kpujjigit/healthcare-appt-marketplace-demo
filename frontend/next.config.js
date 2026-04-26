/** @type {import('next').NextConfig} */
const { withSentryConfig } = require("@sentry/nextjs");

const nextConfig = {
  reactStrictMode: true,
};

module.exports = withSentryConfig(nextConfig, {
  // Suppresses Sentry CLI output during build (we don't upload sourcemaps in this demo).
  silent: true,
  // Disable everything that requires auth tokens — this is a public demo repo.
  disableLogger: true,
  hideSourceMaps: true,
  widenClientFileUpload: false,
  // No org/project here — sourcemap upload requires auth tokens, which the demo
  // intentionally avoids.
});

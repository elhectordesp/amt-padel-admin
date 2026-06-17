import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http",  hostname: "localhost" },
    ],
  },
};

export default withSentryConfig(nextConfig, {
  // URL del proyecto en Sentry (necesaria para source maps en producción)
  // Sustituir por la URL real del proyecto cuando se cree en https://sentry.io
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Subir source maps solo en CI/CD (SENTRY_AUTH_TOKEN como secret de GitHub)
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  sourcemaps: { disable: true },
  disableLogger: true,
  automaticVercelMonitors: false,
});

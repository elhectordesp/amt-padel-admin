import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http",  hostname: "localhost" },
    ],
  },
};

export default withSentryConfig(nextConfig, {
  // Source maps: se suben a Sentry al compilar en Vercel Production (donde
  // están SENTRY_ORG, SENTRY_PROJECT y SENTRY_AUTH_TOKEN) y el SDK los borra
  // del despliegue. Sin token (previews, CI de GitHub) no se sube nada.
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  // Los eventos del navegador pasan por el propio panel: los bloqueadores de
  // anuncios cortan *.ingest.sentry.io. Excluida del middleware.
  tunnelRoute: "/monitoring",
  // disableLogger y automaticVercelMonitors: obsoletos y sin efecto con
  // Turbopack (el segundo ya era false por defecto).
});

import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

// Páginas que leen un token del enlace de un email: el navegador no manda su
// URL (con el token) como Referer a nadie.
const TOKEN_LINK_PAGES = ["/restablecer", "/aceptar-invitacion"];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http",  hostname: "localhost" },
    ],
  },
  headers() {
    return TOKEN_LINK_PAGES.map((source) => ({
      source,
      headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
    }));
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
  // Los eventos del navegador pasan por el propio panel: los bloqueadores de
  // anuncios cortan *.ingest.sentry.io. Excluida del middleware.
  tunnelRoute: "/monitoring",
  // disableLogger y automaticVercelMonitors: obsoletos y sin efecto con
  // Turbopack (el segundo ya era false por defecto).
});

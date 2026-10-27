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
  // Source maps: se suben a Sentry al compilar en Vercel Production (donde
  // están SENTRY_ORG, SENTRY_PROJECT y SENTRY_AUTH_TOKEN) y el SDK borra los
  // públicos (.next/static); los del servidor se quedan dentro de la función,
  // que no se sirve. Sin token (previews, CI de GitHub) no se sube nada.
  // Una subida fallida no rompe el build: solo se ve en el log, así que en
  // CI y en Vercel (CI=1) el log no va en silencio.
  silent: !process.env.CI,
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

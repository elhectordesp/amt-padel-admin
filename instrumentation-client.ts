import * as Sentry from '@sentry/nextjs';
import { scrubEvent } from './lib/sentry-scrub';

// Next carga este archivo en el navegador antes de que la app sea
// interactiva (también con Turbopack, que no inyectaba el antiguo
// sentry.client.config.ts: Sentry no llegaba a iniciarse en el cliente).

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  // production / preview / development en Vercel (las previews compilan con
  // NODE_ENV=production y se mezclarían con producción).
  environment:
    process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  // No capturar errores de red esperados (401, 403) como eventos de Sentry
  ignoreErrors: [
    'No tienes permisos de administrador',
    'Network Error',
  ],
  // Sin los tokens de los enlaces de los emails (/restablecer, /aceptar-invitacion)
  beforeSend: (event) => scrubEvent(event),
  beforeSendTransaction: (event) => scrubEvent(event),
  beforeBreadcrumb: (breadcrumb) => scrubEvent(breadcrumb),
});

// Navegaciones del App Router (rendimiento en Sentry).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

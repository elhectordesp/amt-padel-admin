import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  environment: process.env.NODE_ENV ?? 'development',
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  // No capturar errores de red esperados (401, 403) como eventos de Sentry
  ignoreErrors: [
    'No tienes permisos de administrador',
    'Network Error',
  ],
});

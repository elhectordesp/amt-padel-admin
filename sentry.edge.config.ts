import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  // production / preview / development en Vercel (las previews compilan con
  // NODE_ENV=production y se mezclarían con producción).
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',
  enabled: !!process.env.SENTRY_DSN,
});

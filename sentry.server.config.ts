import * as Sentry from '@sentry/nextjs';
import { scrubEvent } from './lib/sentry-scrub';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  // production / preview / development en Vercel (las previews compilan con
  // NODE_ENV=production y se mezclarían con producción).
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',
  enabled: !!process.env.SENTRY_DSN,
  // Sin los tokens de los enlaces de los emails (?token=…)
  beforeSend: (event) => scrubEvent(event),
  beforeSendTransaction: (event) => scrubEvent(event),
});

import * as Sentry from "@sentry/nextjs";

// Next llama a register() al arrancar cada servidor. Sin este archivo,
// sentry.server.config.ts y sentry.edge.config.ts no se ejecutaban nunca y
// los errores del servidor no llegaban a Sentry.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Errores de Server Components, route handlers y proxy.
export const onRequestError = Sentry.captureRequestError;

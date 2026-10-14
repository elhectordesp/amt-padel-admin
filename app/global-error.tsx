"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// Error en el layout raíz: sustituye a toda la app, así que lleva su propio
// <html> y estilos mínimos (no carga los globales).
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    // Con digest es un error del servidor: ya lo envió onRequestError
    // (instrumentation.ts) con el error real; aquí llega uno genérico.
    if (!error.digest) Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          fontFamily: "system-ui, sans-serif",
          background: "#0C0C0C",
          color: "#F5F5F5",
          textAlign: "center",
          padding: 24,
        }}
      >
        <h2 style={{ margin: 0 }}>Algo salió mal</h2>
        <p style={{ margin: 0, opacity: 0.7 }}>
          Ha ocurrido un error inesperado. Si vuelve a pasar, avísanos.
        </p>
        <button
          onClick={() => retry()}
          style={{
            padding: "8px 20px",
            borderRadius: 6,
            border: "none",
            background: "#D4AF37",
            color: "#0C0C0C",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Intentar de nuevo
        </button>
      </body>
    </html>
  );
}

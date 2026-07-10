export const metadata = {
  title: "Soporte y ayuda — AMT Pádel",
  description:
    "Centro de ayuda de AMT Pádel: cómo contactar con nosotros y resolver las dudas más frecuentes sobre cuenta, torneos, ranking y resultados.",
};

/* Misma línea visual que /privacidad y /eliminar-cuenta: tema oscuro + dorado. */
const card = {
  background: "#1a1a1a",
  border: "1px solid #2a2a2a",
  borderRadius: 12,
  padding: 24,
  marginBottom: 20,
} as const;

const h2 = { fontSize: 17, fontWeight: 800, color: "#fff", margin: "0 0 14px", display: "flex", alignItems: "center", gap: 10 } as const;
const p = { fontSize: 14, color: "#ccc", margin: "0 0 12px", lineHeight: 1.7 } as const;
const q = { fontSize: 14, fontWeight: 700, color: "#fff", margin: "16px 0 6px" } as const;
const a = { color: "#D4AF37", textDecoration: "none" } as const;

export default function SoportePage() {
  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, Arial, sans-serif",
          background: "#0f0f0f",
          color: "#e5e5e5",
          minHeight: "100vh",
        }}
      >
        <div style={{ maxWidth: 680, margin: "0 auto", padding: "48px 24px 64px" }}>
          {/* Header */}
          <div style={{ marginBottom: 32 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: "#D4AF37",
                letterSpacing: 2,
                textTransform: "uppercase",
                marginBottom: 16,
              }}
            >
              AMT Pádel Circuit
            </div>
            <h1 style={{ fontSize: 30, fontWeight: 800, color: "#fff", margin: "0 0 10px" }}>
              Soporte y ayuda
            </h1>
            <p style={{ fontSize: 14, color: "#999", margin: 0, lineHeight: 1.6 }}>
              ¿Necesitas ayuda con la app? Estamos para echarte una mano. Aquí tienes cómo
              contactarnos y las dudas más frecuentes.
            </p>
          </div>

          {/* Contacto */}
          <section style={card}>
            <h2 style={h2}>✉️ Contacto</h2>
            <p style={p}>
              La forma más rápida de contactar con nosotros es por correo electrónico. Escríbenos y
              te responderemos lo antes posible (normalmente en un plazo máximo de 48 horas
              laborables):
            </p>
            <a
              href="mailto:info@amtpadel.es?subject=Soporte%20AMT%20P%C3%A1del"
              style={{
                display: "inline-block",
                background: "#D4AF37",
                color: "#111",
                fontWeight: 700,
                fontSize: 14,
                padding: "10px 20px",
                borderRadius: 8,
                textDecoration: "none",
              }}
            >
              info@amtpadel.es
            </a>
            <p style={{ ...p, margin: "14px 0 0", fontSize: 13, color: "#999" }}>
              Para agilizar tu consulta, indícanos tu nombre de usuario y, si es un problema técnico,
              el modelo de tu móvil y una breve descripción de lo que ocurre.
            </p>
          </section>

          {/* Preguntas frecuentes */}
          <section style={card}>
            <h2 style={h2}>💬 Preguntas frecuentes</h2>

            <div style={q}>No puedo iniciar sesión o no me llega el email de verificación</div>
            <p style={p}>
              Revisa la carpeta de spam o correo no deseado. Comprueba que el correo esté bien
              escrito. Si aun así no lo recibes, escríbenos a{" "}
              <a href="mailto:info@amtpadel.es" style={a}>
                info@amtpadel.es
              </a>{" "}
              y te ayudamos a activar la cuenta.
            </p>

            <div style={q}>He olvidado mi contraseña</div>
            <p style={p}>
              En la pantalla de inicio de sesión pulsa «¿Has olvidado tu contraseña?» e introduce tu
              correo. Te enviaremos un enlace para restablecerla.
            </p>

            <div style={q}>¿Cómo me inscribo en un torneo?</div>
            <p style={p}>
              Entra en la pestaña de Torneos, elige el torneo, pulsa «Inscribirme» y selecciona tu
              pareja. Podrás ver el estado de tu inscripción y, cuando se genere, el cuadro y los
              horarios.
            </p>

            <div style={q}>¿Cómo funciona el ranking y la puntuación?</div>
            <p style={p}>
              Tu puntuación SPA y tu posición se calculan automáticamente a partir de los resultados
              de los torneos del circuito. Puedes consultar tu evolución y tu historial de partidos
              desde tu perfil.
            </p>

            <div style={q}>No quiero recibir notificaciones</div>
            <p style={p}>
              Puedes desactivar las notificaciones desde los ajustes de tu dispositivo o desde la
              sección de perfil de la aplicación en cualquier momento.
            </p>

            <div style={q}>Quiero eliminar mi cuenta</div>
            <p style={p}>
              Puedes solicitarlo desde la propia app (Perfil → Eliminar cuenta) o siguiendo las
              instrucciones en{" "}
              <a href="/eliminar-cuenta" style={a}>
                esta página
              </a>
              .
            </p>
          </section>

          {/* Footer */}
          <div
            style={{
              marginTop: 32,
              fontSize: 12,
              color: "#666",
              borderTop: "1px solid #1a1a1a",
              paddingTop: 20,
              lineHeight: 1.7,
            }}
          >
            AMT Padel Circuit ·{" "}
            <a href="/privacidad" style={a}>
              Política de privacidad
            </a>{" "}
            ·{" "}
            <a href="/eliminar-cuenta" style={a}>
              Eliminar cuenta
            </a>
            <br />
            Contacto:{" "}
            <a href="mailto:info@amtpadel.es" style={a}>
              info@amtpadel.es
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}

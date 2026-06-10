export const metadata = {
  title: "Delete Account / Eliminar cuenta — AMT Pádel",
  description: "How to request the deletion of your AMT Pádel account and personal data",
};

export default function EliminarCuentaPage() {
  return (
    <html lang="es">
      <body style={{ margin: 0, fontFamily: "system-ui, Arial, sans-serif", background: "#0f0f0f", color: "#e5e5e5", minHeight: "100vh" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "48px 24px" }}>

          {/* Header */}
          <div style={{ marginBottom: 40 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#D4AF37", letterSpacing: 2, textTransform: "uppercase", marginBottom: 16 }}>
              AMT Pádel
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: "#fff", margin: "0 0 8px" }}>
              Delete Account · Eliminar cuenta
            </h1>
            <p style={{ fontSize: 14, color: "#999", margin: 0, lineHeight: 1.6 }}>
              You can request the deletion of your account and all associated personal data in two ways.<br />
              <span style={{ color: "#777" }}>Puedes solicitar la eliminación de tu cuenta y datos personales de dos formas.</span>
            </p>
          </div>

          {/* Option 1 — from the app */}
          <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 12, padding: 24, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 20 }}>📱</span>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#fff", margin: 0 }}>
                From the app · Desde la app
              </h2>
            </div>
            <ol style={{ margin: 0, paddingLeft: 20, color: "#ccc", fontSize: 14, lineHeight: 2.2 }}>
              <li>Open the <strong style={{ color: "#fff" }}>AMT Pádel</strong> app · Abre la app</li>
              <li>Go to your <strong style={{ color: "#fff" }}>Profile</strong> (bottom-right icon) · Ve a tu <strong style={{ color: "#fff" }}>Perfil</strong></li>
              <li>Scroll down and tap <strong style={{ color: "#D4AF37" }}>Delete account</strong> · Pulsa <strong style={{ color: "#D4AF37" }}>Eliminar cuenta</strong></li>
              <li>Confirm — your account will be permanently deleted · Confirma la acción</li>
            </ol>
          </div>

          {/* Option 2 — by email */}
          <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 12, padding: 24, marginBottom: 32 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 20 }}>✉️</span>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#fff", margin: 0 }}>
                By email · Por correo electrónico
              </h2>
            </div>
            <p style={{ fontSize: 14, color: "#ccc", margin: "0 0 12px", lineHeight: 1.6 }}>
              Send an email from the address associated with your account · Envíanos un email desde la dirección asociada a tu cuenta:
            </p>
            <a
              href="mailto:hectordura74@gmail.com?subject=Account%20deletion%20request%20%2F%20Solicitud%20eliminaci%C3%B3n%20de%20cuenta"
              style={{ display: "inline-block", background: "#D4AF37", color: "#111", fontWeight: 700, fontSize: 14, padding: "10px 20px", borderRadius: 8, textDecoration: "none" }}
            >
              hectordura74@gmail.com
            </a>
            <p style={{ fontSize: 12, color: "#666", margin: "12px 0 0", lineHeight: 1.6 }}>
              Subject: <em>Account deletion request</em>. Requests are processed within 30 days ·
              Procesamos las solicitudes en un plazo máximo de 30 días.
            </p>
          </div>

          {/* What gets deleted */}
          <div style={{ borderTop: "1px solid #2a2a2a", paddingTop: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: "0 0 12px" }}>
              What data is deleted · ¿Qué datos se eliminan?
            </h3>
            <ul style={{ margin: 0, paddingLeft: 20, color: "#999", fontSize: 13, lineHeight: 2 }}>
              <li>Name, email, profile photo and contact details · Nombre, email, foto y contacto</li>
              <li>Tournament history and registration records · Historial de torneos e inscripciones</li>
              <li>SPA score and match statistics · Puntuación SPA y estadísticas</li>
              <li>Session tokens and push notification tokens · Tokens de sesión y notificaciones</li>
            </ul>
            <p style={{ fontSize: 12, color: "#666", margin: "16px 0 0", lineHeight: 1.6 }}>
              Internal audit logs may be retained for up to 12 months for legal purposes.
              Anonymised aggregate data may be retained indefinitely.
            </p>
          </div>

          <div style={{ marginTop: 40, fontSize: 11, color: "#555", borderTop: "1px solid #1a1a1a", paddingTop: 16 }}>
            AMT Pádel · <a href="/privacidad.pdf" style={{ color: "#D4AF37" }}>Privacy Policy</a>
          </div>

        </div>
      </body>
    </html>
  );
}

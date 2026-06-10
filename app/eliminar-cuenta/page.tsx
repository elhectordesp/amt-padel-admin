export const metadata = {
  title: "Delete Account — AMT Pádel",
  description: "How to request the deletion of your AMT Pádel account and personal data",
};

export default function EliminarCuentaPage() {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, Arial, sans-serif", background: "#0f0f0f", color: "#e5e5e5", minHeight: "100vh" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "48px 24px" }}>

          {/* Header */}
          <div style={{ marginBottom: 40 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#D4AF37", letterSpacing: 2, textTransform: "uppercase", marginBottom: 16 }}>
              AMT Pádel
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: "#fff", margin: "0 0 8px" }}>
              Account Deletion
            </h1>
            <p style={{ fontSize: 14, color: "#999", margin: 0, lineHeight: 1.6 }}>
              You can request the deletion of your account and all associated personal data
              in two ways: directly from the app or by sending us an email.
            </p>
          </div>

          {/* Option 1 — from the app */}
          <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 12, padding: 24, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 20 }}>📱</span>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#fff", margin: 0 }}>
                From the app (immediate)
              </h2>
            </div>
            <ol style={{ margin: 0, paddingLeft: 20, color: "#ccc", fontSize: 14, lineHeight: 2 }}>
              <li>Open the <strong style={{ color: "#fff" }}>AMT Pádel</strong> app</li>
              <li>Go to your <strong style={{ color: "#fff" }}>Profile</strong> (bottom-right icon)</li>
              <li>Tap the <strong style={{ color: "#fff" }}>Settings</strong> icon (gear)</li>
              <li>Scroll to the bottom and tap <strong style={{ color: "#D4AF37" }}>Delete account</strong></li>
              <li>Confirm the action — your account will be permanently deleted</li>
            </ol>
          </div>

          {/* Option 2 — by email */}
          <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 12, padding: 24, marginBottom: 32 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 20 }}>✉️</span>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#fff", margin: 0 }}>
                By email
              </h2>
            </div>
            <p style={{ fontSize: 14, color: "#ccc", margin: "0 0 12px", lineHeight: 1.6 }}>
              If you no longer have access to the app, send us an email from the address
              associated with your account:
            </p>
            <a
              href="mailto:hola@amtpadel.com?subject=Account%20deletion%20request"
              style={{ display: "inline-block", background: "#D4AF37", color: "#111", fontWeight: 700, fontSize: 14, padding: "10px 20px", borderRadius: 8, textDecoration: "none" }}
            >
              hola@amtpadel.com
            </a>
            <p style={{ fontSize: 12, color: "#666", margin: "12px 0 0", lineHeight: 1.6 }}>
              Subject: <em>Account deletion request</em>. We process requests within 30 days.
            </p>
          </div>

          {/* What gets deleted */}
          <div style={{ borderTop: "1px solid #2a2a2a", paddingTop: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: "0 0 12px" }}>
              What data is deleted?
            </h3>
            <ul style={{ margin: 0, paddingLeft: 20, color: "#999", fontSize: 13, lineHeight: 2 }}>
              <li>Name, email address, profile photo and contact details</li>
              <li>Tournament history and registration records</li>
              <li>SPA score and match statistics</li>
              <li>Session tokens and push notification tokens</li>
            </ul>
            <p style={{ fontSize: 12, color: "#666", margin: "16px 0 0", lineHeight: 1.6 }}>
              Internal audit logs may be retained for up to 12 months for legal purposes.
              Anonymised aggregate data (tournament statistics with no personal identifiers)
              may be retained indefinitely.
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

export const metadata = {
  title: "Política de Privacidad — AMT Pádel",
  description:
    "Información sobre el tratamiento de tus datos personales en AMT Padel Circuit, conforme al RGPD (UE 2016/679) y la LOPDGDD.",
};

/* Estilos reutilizables (misma línea que /eliminar-cuenta: tema oscuro + dorado). */
const card = {
  background: "#1a1a1a",
  border: "1px solid #2a2a2a",
  borderRadius: 12,
  padding: 24,
  marginBottom: 20,
} as const;

const h2 = {
  fontSize: 18,
  fontWeight: 800,
  color: "#fff",
  margin: "0 0 14px",
  display: "flex",
  alignItems: "center",
  gap: 10,
} as const;

const num = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 26,
  height: 26,
  borderRadius: "50%",
  background: "#D4AF37",
  color: "#111",
  fontSize: 13,
  fontWeight: 800,
  flexShrink: 0,
} as const;

const p = { fontSize: 14, color: "#ccc", margin: "0 0 12px", lineHeight: 1.7 } as const;
const tableWrap = { overflowX: "auto" as const, margin: "0 0 4px", WebkitOverflowScrolling: "touch" as const };
const table = { width: "100%", borderCollapse: "collapse" as const, fontSize: 13, minWidth: 480 };
const th = {
  textAlign: "left" as const,
  background: "#242424",
  color: "#D4AF37",
  fontWeight: 700,
  padding: "10px 12px",
  borderBottom: "1px solid #2a2a2a",
  whiteSpace: "nowrap" as const,
};
const td = { padding: "10px 12px", color: "#ccc", borderBottom: "1px solid #222", verticalAlign: "top" as const, lineHeight: 1.55 };
const tdHead = { ...td, color: "#fff", fontWeight: 700, whiteSpace: "nowrap" as const };
const note = {
  background: "#141414",
  borderLeft: "3px solid #D4AF37",
  borderRadius: 6,
  padding: "12px 16px",
  fontSize: 13,
  color: "#bbb",
  lineHeight: 1.6,
  margin: "12px 0 0",
} as const;

export default function PrivacidadPage() {
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
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px 64px" }}>
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
              Política de Privacidad
            </h1>
            <p style={{ fontSize: 14, color: "#999", margin: 0, lineHeight: 1.6 }}>
              Información sobre el tratamiento de tus datos personales de conformidad con el
              Reglamento (UE) 2016/679 (RGPD) y la LOPDGDD.
            </p>
            <div style={{ fontSize: 12, color: "#666", marginTop: 12 }}>
              Versión 1.0 · Última actualización: julio 2026 · Ámbito: España (Unión Europea)
            </div>
          </div>

          {/* Intro */}
          <div
            style={{
              background: "rgba(212,175,55,0.08)",
              border: "1px solid rgba(212,175,55,0.25)",
              borderRadius: 12,
              padding: 20,
              marginBottom: 32,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: "#D4AF37", marginBottom: 8 }}>
              🔒 Tu privacidad nos importa
            </div>
            <p style={{ ...p, margin: 0 }}>
              En AMT Padel Circuit tratamos tus datos personales con total transparencia y de
              acuerdo con la normativa europea de protección de datos (RGPD) y la legislación
              española (LOPDGDD). Te explicamos qué datos recogemos, por qué y cómo puedes ejercer
              tus derechos en todo momento.
            </p>
          </div>

          {/* 1. Responsable */}
          <section style={card}>
            <h2 style={h2}>
              <span style={num}>1</span> Responsable del tratamiento
            </h2>
            <p style={p}>El responsable del tratamiento de tus datos personales es:</p>
            <div style={tableWrap}>
              <table style={table}>
                <tbody>
                  <tr>
                    <td style={tdHead}>Denominación</td>
                    <td style={td}>AMT Padel Circuit</td>
                  </tr>
                  <tr>
                    <td style={tdHead}>Email</td>
                    <td style={td}>
                      <a href="mailto:info@amtpadel.es" style={{ color: "#D4AF37" }}>
                        info@amtpadel.es
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td style={tdHead}>Web</td>
                    <td style={td}>amtpadel.com</td>
                  </tr>
                  <tr>
                    <td style={tdHead}>Ámbito</td>
                    <td style={td}>España (Unión Europea)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* 2. Datos */}
          <section style={card}>
            <h2 style={h2}>
              <span style={num}>2</span> Datos que recogemos
            </h2>
            <p style={p}>
              Recogemos únicamente los datos necesarios para prestar el servicio de gestión del
              circuito. A continuación detallamos las categorías:
            </p>
            <div style={tableWrap}>
              <table style={table}>
                <thead>
                  <tr>
                    <th style={th}>Categoría</th>
                    <th style={th}>Datos concretos</th>
                    <th style={th}>Origen</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={tdHead}>Identificación</td>
                    <td style={td}>Nombre, apellidos, nombre de usuario (alias), foto de perfil (opcional)</td>
                    <td style={td}>Facilitados por el usuario al registrarse</td>
                  </tr>
                  <tr>
                    <td style={tdHead}>Contacto</td>
                    <td style={td}>Dirección de correo electrónico, número de teléfono (opcional)</td>
                    <td style={td}>Facilitados por el usuario al registrarse</td>
                  </tr>
                  <tr>
                    <td style={tdHead}>Ubicación</td>
                    <td style={td}>
                      Ciudad / provincia aproximada. Con tu permiso, la app usa la ubicación del
                      dispositivo solo para detectar automáticamente tu ciudad y mostrarte torneos
                      cercanos; no registramos tu posición GPS continua
                    </td>
                    <td style={td}>Permiso de ubicación del dispositivo (opcional)</td>
                  </tr>
                  <tr>
                    <td style={tdHead}>Deportivos</td>
                    <td style={td}>Categoría, puntuación SPA, historial de partidos, resultados, estadísticas, posición en ranking</td>
                    <td style={td}>Generados automáticamente durante la participación en torneos</td>
                  </tr>
                  <tr>
                    <td style={tdHead}>Inscripciones</td>
                    <td style={td}>Torneos en los que participas, pareja de juego, estado de pago de inscripción</td>
                    <td style={td}>Generados al inscribirse en torneos</td>
                  </tr>
                  <tr>
                    <td style={tdHead}>Técnicos</td>
                    <td style={td}>Token de sesión (JWT), token de notificaciones push (Expo), dirección IP (logs de servidor), timestamps de última actividad</td>
                    <td style={td}>Generados automáticamente por el uso de la aplicación</td>
                  </tr>
                  <tr>
                    <td style={tdHead}>Comunicaciones</td>
                    <td style={td}>Mensajes enviados al soporte a través de la aplicación</td>
                    <td style={td}>Facilitados voluntariamente por el usuario</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div style={note}>
              ℹ️ <strong style={{ color: "#ddd" }}>Datos especiales:</strong> no tratamos categorías
              especiales de datos (salud, origen étnico, ideología, etc.) en ningún momento.
            </div>
            <div style={note}>
              📅 <strong style={{ color: "#ddd" }}>Calendario:</strong> con tu permiso, la app puede
              añadir tus partidos al calendario de tu dispositivo. Esta acción ocurre en local; no
              recogemos ni almacenamos datos de tu calendario en nuestros servidores.
            </div>
          </section>

          {/* 3. Finalidades */}
          <section style={card}>
            <h2 style={h2}>
              <span style={num}>3</span> Finalidades y base jurídica del tratamiento
            </h2>
            <div style={tableWrap}>
              <table style={table}>
                <thead>
                  <tr>
                    <th style={th}>Finalidad</th>
                    <th style={th}>Descripción</th>
                    <th style={th}>Base jurídica (Art. 6 RGPD)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={tdHead}>Gestión de cuenta</td>
                    <td style={td}>Registro, autenticación, verificación de correo y acceso a la aplicación</td>
                    <td style={td}>Ejecución de un contrato (6.1.b)</td>
                  </tr>
                  <tr>
                    <td style={tdHead}>Participación en el circuito</td>
                    <td style={td}>Inscripción a torneos, publicación de resultados, cálculo de rankings y estadísticas</td>
                    <td style={td}>Ejecución de un contrato (6.1.b)</td>
                  </tr>
                  <tr>
                    <td style={tdHead}>Ranking público</td>
                    <td style={td}>Publicación del nombre, alias y puntuación SPA en el ranking visible para otros usuarios</td>
                    <td style={td}>Interés legítimo (6.1.f) — el ranking es inherente a la naturaleza competitiva del circuito</td>
                  </tr>
                  <tr>
                    <td style={tdHead}>Comunicaciones del servicio</td>
                    <td style={td}>Envío de emails transaccionales: bienvenida, confirmación de inscripción, resultados, notificaciones de torneo</td>
                    <td style={td}>Ejecución de un contrato (6.1.b)</td>
                  </tr>
                  <tr>
                    <td style={tdHead}>Notificaciones push</td>
                    <td style={td}>Alertas sobre partidos, resultados y novedades del circuito en el dispositivo móvil</td>
                    <td style={td}>Consentimiento (6.1.a) — puede retirarse en cualquier momento desde la app</td>
                  </tr>
                  <tr>
                    <td style={tdHead}>Soporte</td>
                    <td style={td}>Atención a consultas, reportes de incidencias y resolución de disputas</td>
                    <td style={td}>Interés legítimo (6.1.f)</td>
                  </tr>
                  <tr>
                    <td style={tdHead}>Seguridad y antifraude</td>
                    <td style={td}>Registro de accesos y actividad para detectar usos fraudulentos o abusivos</td>
                    <td style={td}>Interés legítimo (6.1.f)</td>
                  </tr>
                  <tr>
                    <td style={tdHead}>Obligaciones legales</td>
                    <td style={td}>Conservación de datos cuando sea requerido por ley</td>
                    <td style={td}>Obligación legal (6.1.c)</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div style={note}>
              ⚠️ <strong style={{ color: "#ddd" }}>Ranking y visibilidad:</strong> tu nombre de
              usuario (alias), puntuación y posición en el ranking son visibles para todos los
              participantes del circuito. Si deseas que tu información no aparezca en el ranking
              público, contacta con nosotros antes de inscribirte.
            </div>
          </section>

          {/* 4. Plazos */}
          <section style={card}>
            <h2 style={h2}>
              <span style={num}>4</span> Plazos de conservación
            </h2>
            <p style={p}>
              Conservamos tus datos durante el tiempo estrictamente necesario para cumplir las
              finalidades indicadas:
            </p>
            <div style={tableWrap}>
              <table style={table}>
                <thead>
                  <tr>
                    <th style={th}>Tipo de dato</th>
                    <th style={th}>Plazo de conservación</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={tdHead}>Datos de cuenta (nombre, email)</td>
                    <td style={td}>Mientras la cuenta esté activa + 3 años tras la baja</td>
                  </tr>
                  <tr>
                    <td style={tdHead}>Historial deportivo y estadísticas</td>
                    <td style={td}>Indefinidamente de forma anonimizada tras la baja; con nombre identificable mientras la cuenta esté activa</td>
                  </tr>
                  <tr>
                    <td style={tdHead}>Resultados de torneos (publicados)</td>
                    <td style={td}>Indefinidamente como parte del historial del circuito</td>
                  </tr>
                  <tr>
                    <td style={tdHead}>Tokens de sesión (JWT)</td>
                    <td style={td}>Hasta expiración o cierre de sesión explícito</td>
                  </tr>
                  <tr>
                    <td style={tdHead}>Tokens push (Expo)</td>
                    <td style={td}>Mientras las notificaciones estén activadas o la cuenta esté activa</td>
                  </tr>
                  <tr>
                    <td style={tdHead}>Logs de servidor / IPs</td>
                    <td style={td}>90 días máximo</td>
                  </tr>
                  <tr>
                    <td style={tdHead}>Mensajes de soporte</td>
                    <td style={td}>2 años desde la resolución</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p style={{ ...p, margin: "12px 0 0", color: "#999" }}>
              Transcurridos estos plazos, los datos serán eliminados de forma segura o anonimizados
              de manera que no permitan su vinculación a una persona identificable.
            </p>
          </section>

          {/* 5. Destinatarios */}
          <section style={card}>
            <h2 style={h2}>
              <span style={num}>5</span> Destinatarios y transferencias internacionales
            </h2>
            <p style={p}>
              No vendemos ni cedemos tus datos a terceros con fines comerciales. Tus datos pueden ser
              accedidos por los siguientes encargados del tratamiento con los que operamos:
            </p>
            <div style={tableWrap}>
              <table style={table}>
                <thead>
                  <tr>
                    <th style={th}>Proveedor</th>
                    <th style={th}>Servicio</th>
                    <th style={th}>Ubicación</th>
                    <th style={th}>Garantía</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={tdHead}>Railway</td>
                    <td style={td}>Alojamiento del servidor backend y base de datos</td>
                    <td style={td}>EE.UU.</td>
                    <td style={td}>Cláusulas contractuales estándar (SCC)</td>
                  </tr>
                  <tr>
                    <td style={tdHead}>Vercel</td>
                    <td style={td}>Alojamiento del panel de administración</td>
                    <td style={td}>EE.UU.</td>
                    <td style={td}>Cláusulas contractuales estándar (SCC)</td>
                  </tr>
                  <tr>
                    <td style={tdHead}>Expo (Notifications)</td>
                    <td style={td}>Envío de notificaciones push a dispositivos móviles</td>
                    <td style={td}>EE.UU.</td>
                    <td style={td}>Cláusulas contractuales estándar (SCC)</td>
                  </tr>
                  <tr>
                    <td style={tdHead}>Proveedor SMTP</td>
                    <td style={td}>Envío de emails transaccionales</td>
                    <td style={td}>Variable</td>
                    <td style={td}>Sujeto al proveedor configurado</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div style={note}>
              🌍 <strong style={{ color: "#ddd" }}>Transferencias internacionales:</strong> algunas
              transferencias se realizan a países fuera del Espacio Económico Europeo (EEE). En todos
              los casos exigimos a nuestros proveedores la firma de las Cláusulas Contractuales
              Estándar aprobadas por la Comisión Europea u otras garantías equivalentes.
            </div>
          </section>

          {/* 6. Derechos */}
          <section style={card}>
            <h2 style={h2}>
              <span style={num}>6</span> Tus derechos
            </h2>
            <p style={p}>
              Como interesado, el RGPD te reconoce los siguientes derechos, que puedes ejercitar de
              forma gratuita:
            </p>
            <ul style={{ margin: 0, paddingLeft: 20, color: "#ccc", fontSize: 14, lineHeight: 1.9 }}>
              <li><strong style={{ color: "#fff" }}>Acceso</strong> — obtener confirmación de si tratamos tus datos y acceder a una copia.</li>
              <li><strong style={{ color: "#fff" }}>Rectificación</strong> — corregir datos inexactos o incompletos.</li>
              <li><strong style={{ color: "#fff" }}>Supresión</strong> — eliminar tus datos cuando ya no sean necesarios o retires el consentimiento.</li>
              <li><strong style={{ color: "#fff" }}>Limitación</strong> — restringir el tratamiento en determinadas circunstancias.</li>
              <li><strong style={{ color: "#fff" }}>Portabilidad</strong> — recibir tus datos en formato estructurado y de uso común.</li>
              <li><strong style={{ color: "#fff" }}>Oposición</strong> — oponerte al tratamiento basado en interés legítimo o con fines de marketing directo.</li>
            </ul>
            <div style={note}>
              📧 <strong style={{ color: "#ddd" }}>Cómo ejercer tus derechos:</strong> envía un email
              a{" "}
              <a href="mailto:info@amtpadel.es" style={{ color: "#D4AF37" }}>
                info@amtpadel.es
              </a>{" "}
              indicando el derecho que deseas ejercitar y adjuntando una copia de tu documento de
              identidad. Responderemos en un plazo máximo de 30 días.
            </div>
            <p style={{ ...p, margin: "12px 0 0", color: "#999", fontSize: 13 }}>
              Algunos derechos pueden estar limitados cuando el tratamiento sea necesario para el
              cumplimiento de obligaciones legales o para la defensa de reclamaciones (por ejemplo, el
              historial de resultados deportivos publicados en el circuito).
            </p>
          </section>

          {/* 7. Push */}
          <section style={card}>
            <h2 style={h2}>
              <span style={num}>7</span> Notificaciones push
            </h2>
            <p style={p}>
              La aplicación móvil de AMT Pádel puede enviarte notificaciones push a tu dispositivo.
              Este servicio se basa en tu consentimiento expreso, que la app te solicitará la primera
              vez que inicies sesión.
            </p>
            <ul style={{ margin: 0, paddingLeft: 20, color: "#ccc", fontSize: 14, lineHeight: 1.9 }}>
              <li><strong style={{ color: "#fff" }}>Qué notificamos:</strong> nuevos partidos programados, publicación de resultados, cambios en el torneo, novedades del circuito.</li>
              <li><strong style={{ color: "#fff" }}>Cómo desactivarlas:</strong> puedes revocar el permiso en cualquier momento desde los ajustes de notificaciones de tu dispositivo o desde la sección de perfil de la aplicación.</li>
              <li><strong style={{ color: "#fff" }}>Token push:</strong> tu dispositivo genera un token único (Expo Push Token) que utilizamos exclusivamente para enviarte notificaciones. Este token no identifica a la persona y no se comparte con terceros salvo con Expo para la entrega técnica del mensaje.</li>
            </ul>
          </section>

          {/* 8. Seguridad */}
          <section style={card}>
            <h2 style={h2}>
              <span style={num}>8</span> Seguridad de los datos
            </h2>
            <p style={p}>
              Aplicamos medidas técnicas y organizativas apropiadas para proteger tus datos frente a
              accesos no autorizados, pérdida, alteración o divulgación:
            </p>
            <ul style={{ margin: 0, paddingLeft: 20, color: "#ccc", fontSize: 14, lineHeight: 1.9 }}>
              <li><strong style={{ color: "#fff" }}>Cifrado en tránsito:</strong> toda la comunicación entre la app y nuestros servidores se realiza a través de HTTPS/TLS.</li>
              <li><strong style={{ color: "#fff" }}>Autenticación segura:</strong> las contraseñas se almacenan cifradas con bcrypt. El acceso se gestiona mediante tokens JWT con expiración configurada.</li>
              <li><strong style={{ color: "#fff" }}>Verificación de correo:</strong> se requiere verificar el email antes de poder acceder al circuito.</li>
              <li><strong style={{ color: "#fff" }}>Acceso restringido:</strong> solo el personal autorizado de AMT Padel Circuit tiene acceso al panel de administración, protegido con autenticación propia.</li>
              <li><strong style={{ color: "#fff" }}>Infraestructura gestionada:</strong> utilizamos proveedores de nube con certificaciones de seguridad reconocidas (SOC 2, ISO 27001).</li>
            </ul>
            <div style={note}>
              ⚠️ <strong style={{ color: "#ddd" }}>Notificación de brechas:</strong> en caso de
              violación de seguridad que afecte a tus datos personales, lo notificaremos a la Agencia
              Española de Protección de Datos (AEPD) en el plazo de 72 horas y a ti directamente
              cuando exista riesgo elevado para tus derechos.
            </div>
          </section>

          {/* 9. Menores */}
          <section style={card}>
            <h2 style={h2}>
              <span style={num}>9</span> Menores de edad
            </h2>
            <p style={p}>
              El servicio de AMT Padel Circuit está dirigido a personas mayores de 14 años, en
              consonancia con lo establecido en el artículo 7 de la LOPDGDD para el consentimiento del
              menor en el ámbito digital.
            </p>
            <p style={{ ...p, margin: 0 }}>
              Si tienes conocimiento de que un menor de 14 años ha facilitado datos personales sin el
              consentimiento de sus tutores legales, te rogamos que nos lo comuniques a{" "}
              <a href="mailto:info@amtpadel.es" style={{ color: "#D4AF37" }}>
                info@amtpadel.es
              </a>{" "}
              para proceder a su eliminación inmediata.
            </p>
          </section>

          {/* 10. Cambios */}
          <section style={card}>
            <h2 style={h2}>
              <span style={num}>10</span> Cambios en esta política
            </h2>
            <p style={p}>
              Podemos actualizar esta Política de Privacidad para reflejar cambios normativos, nuevas
              funcionalidades o mejoras en nuestras prácticas de privacidad.
            </p>
            <ul style={{ margin: 0, paddingLeft: 20, color: "#ccc", fontSize: 14, lineHeight: 1.9 }}>
              <li>Los cambios <strong style={{ color: "#fff" }}>no sustanciales</strong> se publicarán en esta misma URL sin notificación previa.</li>
              <li>Los cambios <strong style={{ color: "#fff" }}>sustanciales</strong> (nuevas finalidades, nuevos destinatarios, ampliación de plazos) se comunicarán por email y/o mediante aviso en la aplicación con al menos 15 días de antelación.</li>
              <li>La fecha de última actualización figura siempre al pie de este documento.</li>
            </ul>
          </section>

          {/* 11. Contacto */}
          <section style={card}>
            <h2 style={h2}>
              <span style={num}>11</span> Contacto y reclamaciones
            </h2>
            <p style={p}>
              Para cualquier consulta sobre esta política o para ejercer tus derechos, contacta con
              nosotros en{" "}
              <a href="mailto:info@amtpadel.es" style={{ color: "#D4AF37" }}>
                info@amtpadel.es
              </a>{" "}
              (asunto: «Protección de datos»). Respuesta en un máximo de 30 días naturales.
            </p>
            <p style={{ ...p, margin: 0 }}>
              Si consideras que el tratamiento de tus datos no es conforme a la normativa, tienes
              derecho a presentar una reclamación ante la Agencia Española de Protección de Datos
              (AEPD): www.aepd.es · sedeagpd.gob.es · C/ Jorge Juan, 6 — 28001 Madrid. Te pedimos que,
              antes de acudir a la AEPD, nos contactes para intentar resolver cualquier discrepancia
              de forma amistosa y rápida.
            </p>
          </section>

          {/* Footer */}
          <div style={{ marginTop: 32, fontSize: 12, color: "#666", borderTop: "1px solid #1a1a1a", paddingTop: 20, lineHeight: 1.7 }}>
            AMT Padel Circuit · Política de Privacidad v1.0 · Última actualización: julio 2026
            <br />
            <a href="/eliminar-cuenta" style={{ color: "#D4AF37" }}>
              Eliminar cuenta
            </a>{" "}
            · Para dudas:{" "}
            <a href="mailto:info@amtpadel.es" style={{ color: "#D4AF37" }}>
              info@amtpadel.es
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}

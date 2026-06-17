import { ImageResponse } from "next/og";

export const runtime     = "nodejs";
export const size        = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  async function loadInterFont(): Promise<ArrayBuffer | null> {
    try {
      const css = await fetch(
        "https://fonts.googleapis.com/css2?family=Inter:wght@700&display=swap",
        { headers: { "User-Agent": "Mozilla/4.0" } },
      ).then((r) => r.text());
      const url = css.match(/src: url\(([^)]+)\)/)?.[1];
      if (!url) return null;
      return fetch(url).then((r) => r.arrayBuffer());
    } catch {
      return null;
    }
  }
  const fontData = await loadInterFont();

  const fonts = fontData
    ? [{ name: "Inter", data: fontData, style: "normal" as const, weight: 400 as const }]
    : [];

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0A0A0A 0%, #111111 60%, #0F0E08 100%)",
          fontFamily: "Inter, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Gold top bar */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 4,
          background: "linear-gradient(90deg, #D4AF37 0%, #F5C842 50%, #D4AF37 100%)",
          display: "flex",
        }} />

        {/* Radial glow */}
        <div style={{
          position: "absolute",
          width: 600, height: 600,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(212,175,55,0.08) 0%, transparent 70%)",
          display: "flex",
        }} />

        {/* Trophy icon (CSS) */}
        <div style={{
          width: 100, height: 100,
          borderRadius: "50%",
          background: "rgba(212,175,55,0.12)",
          border: "2px solid rgba(212,175,55,0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 32,
          fontSize: 48,
        }}>
          🏆
        </div>

        {/* Title */}
        <div style={{
          fontSize: 64,
          fontWeight: 700,
          color: "#FFFFFF",
          letterSpacing: -1,
          marginBottom: 16,
        }}>
          Ranking AMT Pádel
        </div>

        {/* Subtitle */}
        <div style={{
          fontSize: 22,
          color: "#888888",
          letterSpacing: 2,
          marginBottom: 48,
        }}>
          CLASIFICACIÓN OFICIAL DEL CIRCUITO
        </div>

        {/* Fake podium bars */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 12, marginBottom: 48 }}>
          {[
            { h: 60, color: "#C0C0C0", pos: "2ª" },
            { h: 90, color: "#D4AF37", pos: "1ª" },
            { h: 45, color: "#CD7F32", pos: "3ª" },
          ].map(({ h, color, pos }) => (
            <div key={pos} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 14, color, fontWeight: 700, letterSpacing: 1 }}>{pos}</span>
              <div style={{
                width: 56,
                height: h,
                borderRadius: "4px 4px 0 0",
                background: color + "44",
                border: `1px solid ${color}66`,
                display: "flex",
              }} />
            </div>
          ))}
        </div>

        {/* AMT branding */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "18px 80px",
          borderTop: "1px solid #1C1C1C",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontSize: 28, fontWeight: 900, color: "#D4AF37", letterSpacing: 5 }}>AMT</span>
            <div style={{ width: 1, height: 18, background: "#2A2A2A", display: "flex" }} />
            <span style={{ fontSize: 11, color: "#555", letterSpacing: 3 }}>CIRCUITO DE PÁDEL</span>
          </div>
          <span style={{ fontSize: 12, color: "#444", letterSpacing: 1 }}>amtpadel.com</span>
        </div>
      </div>
    ),
    { ...size, ...(fonts.length ? { fonts } : {}) },
  );
}

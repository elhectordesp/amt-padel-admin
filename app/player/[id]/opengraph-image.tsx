import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const size    = { width: 1200, height: 630 };
export const contentType = "image/png";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

const CATEGORY_LABEL: Record<string, string> = {
  "1a": "1ª CAT", "2a": "2ª CAT", "3a": "3ª CAT", "4a": "4ª CAT",
  "5a": "5ª CAT", "6a": "6ª CAT", iniciacion: "INICIACIÓN",
};

const LEVEL_COLOR: Record<string, string> = {
  "1a": "#D4AF37", "2a": "#C0C0C0", "3a": "#CD7F32",
  "4a": "#4CAF50", "5a": "#2196F3", "6a": "#9C27B0",
  iniciacion: "#607D8B",
};

async function getPlayer(id: string) {
  try {
    const res = await fetch(`${API_URL}/players/${id}/profile`, { cache: "no-store" });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data ?? json;
  } catch {
    return null;
  }
}

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

async function toDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf  = await res.arrayBuffer();
    const mime = res.headers.get("content-type") ?? "image/jpeg";
    return `data:${mime};base64,${Buffer.from(buf).toString("base64")}`;
  } catch {
    return null;
  }
}

export default async function Image({ params }: { params: { id: string } }) {
  const [data, fontData] = await Promise.all([
    getPlayer(params.id),
    loadInterFont(),
  ]);

  const player     = data?.player ?? null;
  const winRate    = player && player.played > 0 ? Math.round((player.wins / player.played) * 100) : 0;
  const spaPoints  = player?.spa ? Math.round(Number(player.spa.spaPoints)) : null;
  const spaLevel   = player?.spa?.spaLevel ?? player?.level;
  const color      = LEVEL_COLOR[spaLevel ?? ""] ?? "#D4AF37";
  const catLabel   = CATEGORY_LABEL[spaLevel ?? ""] ?? "";
  const initials   = player
    ? player.name.split(" ").map((n: string) => n[0] ?? "").join("").slice(0, 2).toUpperCase()
    : "?";

  const avatarSrc = player?.photoUrl ? await toDataUrl(player.photoUrl) : null;

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

        {/* Subtle golden glow top-right */}
        <div style={{
          position: "absolute", top: -120, right: -80,
          width: 500, height: 500,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(212,175,55,0.12) 0%, transparent 70%)",
          display: "flex",
        }} />

        {/* Main row */}
        <div style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          padding: "60px 80px 40px 80px",
          gap: 56,
          flex: 1,
        }}>

          {/* Avatar */}
          <div style={{
            width: 200, height: 200,
            borderRadius: "50%",
            border: `5px solid ${color}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#1A1A1A",
            flexShrink: 0,
            overflow: "hidden",
          }}>
            {avatarSrc
              ? <img src={avatarSrc} width={200} height={200} style={{ objectFit: "cover", borderRadius: "50%" }} />
              : <span style={{ fontSize: 80, color, fontWeight: 700 }}>{initials}</span>
            }
          </div>

          {/* Text info */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14, flex: 1, minWidth: 0 }}>

            {/* Name */}
            <div style={{
              fontSize: 58,
              fontWeight: 700,
              color: "#FFFFFF",
              lineHeight: 1.1,
              letterSpacing: -1,
            }}>
              {player?.name ?? "Jugador AMT"}
            </div>

            {/* Badges row */}
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              {catLabel && (
                <div style={{
                  display: "flex",
                  padding: "5px 16px",
                  borderRadius: 24,
                  border: `1.5px solid ${color}88`,
                  background: color + "22",
                  color,
                  fontSize: 16,
                  fontWeight: 700,
                  letterSpacing: 1.5,
                }}>
                  {catLabel}
                </div>
              )}
              {player?.gender && (
                <div style={{
                  display: "flex",
                  padding: "5px 14px",
                  borderRadius: 24,
                  border: "1.5px solid #333",
                  background: "#1A1A1A",
                  color: "#888",
                  fontSize: 14,
                  letterSpacing: 1,
                }}>
                  {player.gender === "M" ? "MASCULINO" : "FEMENINO"}
                </div>
              )}
              {player?.globalRank && (
                <div style={{ color: "#888", fontSize: 16 }}>
                  · Ranking #{player.globalRank}
                </div>
              )}
            </div>

            {/* Stats */}
            <div style={{ display: "flex", gap: 40, marginTop: 6 }}>
              {spaPoints !== null && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 48, fontWeight: 700, color, lineHeight: 1 }}>{spaPoints}</span>
                  <span style={{ fontSize: 13, color: "#666", letterSpacing: 2 }}>PUNTOS SPA</span>
                </div>
              )}
              {player && player.played > 0 && (
                <>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontSize: 48, fontWeight: 700, color: "#E8E8E8", lineHeight: 1 }}>{player.played}</span>
                    <span style={{ fontSize: 13, color: "#666", letterSpacing: 2 }}>PARTIDOS</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontSize: 48, fontWeight: 700, color: "#E8E8E8", lineHeight: 1 }}>{winRate}%</span>
                    <span style={{ fontSize: 13, color: "#666", letterSpacing: 2 }}>VICTORIAS</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "18px 80px",
          borderTop: "1px solid #1C1C1C",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{
              fontSize: 30,
              fontWeight: 900,
              color: "#D4AF37",
              letterSpacing: 5,
            }}>
              AMT
            </span>
            <div style={{ width: 1, height: 20, background: "#333", display: "flex" }} />
            <span style={{ fontSize: 12, color: "#555", letterSpacing: 3 }}>
              CIRCUITO DE PÁDEL
            </span>
          </div>
          <span style={{ fontSize: 13, color: "#444", letterSpacing: 1 }}>
            amtpadel.com
          </span>
        </div>
      </div>
    ),
    {
      ...size,
      ...(fonts.length ? { fonts } : {}),
    },
  );
}

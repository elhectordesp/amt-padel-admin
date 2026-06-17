import { ImageResponse } from "next/og";

export const runtime     = "nodejs";
export const size        = { width: 1200, height: 630 };
export const contentType = "image/png";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

const TIER_COLOR: Record<string, string> = {
  PLATINUM: "#E5E4E2", GOLD: "#D4AF37", SILVER: "#C0C0C0", BRONZE: "#CD7F32",
};

const TIER_LABEL: Record<string, string> = {
  PLATINUM: "PLATINUM", GOLD: "GOLD", SILVER: "SILVER", BRONZE: "BRONZE",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "numeric", month: "short", year: "numeric",
  });
}

async function getTournament(id: string) {
  try {
    const res = await fetch(`${API_URL}/tournaments/${id}/public`, { cache: "no-store" });
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
  const [tournament, fontData] = await Promise.all([
    getTournament(params.id),
    loadInterFont(),
  ]);

  const tierColor  = TIER_COLOR[tournament?.tier ?? ""] ?? "#D4AF37";
  const tierLabel  = TIER_LABEL[tournament?.tier ?? ""] ?? "";
  const clubName   = tournament?.club?.name ?? "";
  const categories = (tournament?.categories ?? []) as { gender: string; level: string }[];
  const catCount   = categories.length;

  const imageSrc = tournament?.imageUrl ? await toDataUrl(tournament.imageUrl) : null;

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
          fontFamily: "Inter, sans-serif",
          background: "#0A0A0A",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background image with overlay (left 55%) */}
        {imageSrc && (
          <>
            <img
              src={imageSrc}
              width={660}
              height={630}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: 660,
                height: 630,
                objectFit: "cover",
              }}
            />
            {/* Gradient overlay to fade image into dark right panel */}
            <div style={{
              position: "absolute", top: 0, left: 0, width: 660, height: 630,
              background: "linear-gradient(90deg, rgba(10,10,10,0.3) 0%, rgba(10,10,10,0.85) 100%)",
              display: "flex",
            }} />
            <div style={{
              position: "absolute", top: 0, left: 0, bottom: 0, right: 0,
              background: "linear-gradient(90deg, transparent 40%, #0A0A0A 65%)",
              display: "flex",
            }} />
          </>
        )}

        {/* No image: full dark bg with golden glow */}
        {!imageSrc && (
          <div style={{
            position: "absolute", top: -100, left: -100,
            width: 500, height: 500,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${tierColor}18 0%, transparent 70%)`,
            display: "flex",
          }} />
        )}

        {/* Gold top bar */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 4,
          background: `linear-gradient(90deg, ${tierColor} 0%, #F5C842 50%, ${tierColor} 100%)`,
          display: "flex",
        }} />

        {/* Right content panel */}
        <div style={{
          position: "absolute",
          top: 0, right: 0,
          width: imageSrc ? 600 : 1200,
          height: 630,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "52px 72px 28px 72px",
        }}>

          {/* Top section */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Tier badge */}
            {tierLabel && (
              <div style={{
                display: "flex",
                width: "fit-content",
                padding: "5px 18px",
                borderRadius: 24,
                border: `1.5px solid ${tierColor}66`,
                background: tierColor + "18",
                color: tierColor,
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: 3,
              }}>
                {tierLabel}
              </div>
            )}

            {/* Tournament name */}
            <div style={{
              fontSize: tournament?.name && tournament.name.length > 30 ? 44 : 52,
              fontWeight: 700,
              color: "#FFFFFF",
              lineHeight: 1.1,
              letterSpacing: -0.5,
            }}>
              {tournament?.name ?? "Torneo AMT Pádel"}
            </div>

            {/* Date + club */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
              {(tournament?.startDate || tournament?.endDate) && (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: tierColor, display: "flex",
                  }} />
                  <span style={{ fontSize: 18, color: "#AAAAAA" }}>
                    {tournament.startDate
                      ? `${formatDate(tournament.startDate)}${tournament.endDate ? ` → ${formatDate(tournament.endDate)}` : ""}`
                      : ""}
                  </span>
                </div>
              )}
              {clubName && (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: "#444", display: "flex",
                  }} />
                  <span style={{ fontSize: 18, color: "#AAAAAA" }}>{clubName}</span>
                </div>
              )}
              {catCount > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: "#444", display: "flex",
                  }} />
                  <span style={{ fontSize: 18, color: "#AAAAAA" }}>
                    {catCount} {catCount === 1 ? "categoría" : "categorías"}
                  </span>
                </div>
              )}
              {tournament?.prize && (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: tierColor, display: "flex",
                  }} />
                  <span style={{ fontSize: 18, color: tierColor, fontWeight: 700 }}>
                    {tournament.prize}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Bottom AMT branding */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: "1px solid #1C1C1C",
            paddingTop: 18,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{
                fontSize: 28, fontWeight: 900,
                color: tierColor, letterSpacing: 5,
              }}>
                AMT
              </span>
              <div style={{ width: 1, height: 18, background: "#2A2A2A", display: "flex" }} />
              <span style={{ fontSize: 11, color: "#555", letterSpacing: 3 }}>
                CIRCUITO DE PÁDEL
              </span>
            </div>
            <span style={{ fontSize: 12, color: "#444", letterSpacing: 1 }}>
              amtpadel.com
            </span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      ...(fonts.length ? { fonts } : {}),
    },
  );
}

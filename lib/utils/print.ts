import type { Tournament, AdminRegistration, RegistrationStatus, MatchResult } from "@/types";

function esc(s: string | null | undefined): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface PairReg {
  pairKey: string;
  ids:     string[];
  primary: AdminRegistration;
  status:  RegistrationStatus;
}

const STATUS_ES: Record<RegistrationStatus, string> = {
  CONFIRMED: "Confirmado",
  PENDING:   "Pendiente",
  WAITLIST:  "En espera",
  CANCELLED: "Cancelado",
};

function buildCategoryRows(pairs: PairReg[], gender: string, level: string): PairReg[] {
  return pairs
    .filter((p) => p.primary.category.gender === gender && p.primary.category.level === level)
    .filter((p) => p.status !== "CANCELLED");
}

export function printRegistrations(tournament: Tournament, pairs: PairReg[]): void {
  const catKeys = [...new Set(pairs.map((p) => `${p.primary.category.gender}__${p.primary.category.level}`))];

  const categorySections = catKeys.map((key) => {
    const [gender, level] = key.split("__");
    const catPairs = buildCategoryRows(pairs, gender, level);
    if (catPairs.length === 0) return "";

    const genderLabel = gender === "M" ? "Masculino" : "Femenino";

    const rows = catPairs.map((pair, i) => {
      const reg      = pair.primary;
      const spa1     = reg.user.spaPoints != null ? Math.round(Number(reg.user.spaPoints)) : "—";
      const spa2     = reg.partner?.spaPoints != null ? Math.round(Number(reg.partner.spaPoints)) : "—";
      const statusOk = pair.status === "CONFIRMED";
      const paid     = reg.paid;
      return `
        <tr class="${i % 2 === 0 ? "row-alt" : ""}">
          <td class="num">${i + 1}</td>
          <td>
            <strong>${esc(reg.user.name)}</strong>
            ${reg.partner?.name ? `<br><span class="secondary">${esc(reg.partner.name)}</span>` : "<br><span class='secondary italic'>Sin pareja</span>"}
          </td>
          <td class="center">
            ${reg.user.categoryLevel ?? "—"}
            ${reg.partner?.categoryLevel ? `<br><span class="secondary">${reg.partner.categoryLevel}</span>` : ""}
          </td>
          <td class="center">
            ${spa1}
            ${reg.partner != null ? `<br><span class="secondary">${spa2}</span>` : ""}
          </td>
          <td class="center">
            <span class="badge ${statusOk ? "badge-ok" : "badge-pend"}">${STATUS_ES[pair.status]}</span>
          </td>
          <td class="center">
            <span class="${paid ? "check" : "cross"}">${paid ? "✓" : "✗"}</span>
          </td>
          <td class="notes"></td>
        </tr>`;
    }).join("");

    return `
      <div class="category-block">
        <div class="category-header">
          <span>${genderLabel} · ${level}</span>
          <span class="cat-count">${catPairs.length} inscripciones</span>
        </div>
        <table>
          <thead>
            <tr>
              <th class="num">#</th>
              <th>Pareja</th>
              <th class="center">Nivel</th>
              <th class="center">SPA</th>
              <th class="center">Estado</th>
              <th class="center">Pago</th>
              <th>Notas</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }).join("");

  const now = new Date().toLocaleString("es-ES", {
    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Lista de inscripciones — ${esc(tournament.name)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #111; background: #fff; padding: 20px 28px; }

    .page-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #D4AF37; padding-bottom: 10px; margin-bottom: 18px; }
    .page-header h1 { font-size: 18px; font-weight: 700; color: #111; }
    .page-header .meta { font-size: 10px; color: #555; margin-top: 3px; }
    .page-header .logo { font-size: 13px; font-weight: 800; color: #D4AF37; letter-spacing: 1px; text-align: right; }
    .page-header .generated { font-size: 9px; color: #888; text-align: right; margin-top: 2px; }

    .category-block { margin-bottom: 20px; page-break-inside: avoid; }
    .category-header { display: flex; justify-content: space-between; align-items: center; background: #1a1a1a; color: #D4AF37; font-weight: 700; font-size: 11px; padding: 6px 10px; border-radius: 3px 3px 0 0; }
    .cat-count { font-weight: 400; font-size: 9px; color: #aaa; }

    table { width: 100%; border-collapse: collapse; }
    thead tr { background: #f5f5f5; }
    th { padding: 5px 8px; text-align: left; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #555; border-bottom: 1px solid #ddd; }
    td { padding: 5px 8px; border-bottom: 1px solid #eee; vertical-align: top; }
    tr.row-alt td { background: #fafafa; }
    .num { width: 28px; color: #888; font-size: 10px; text-align: center; }
    .center { text-align: center; }
    .secondary { color: #666; font-size: 10px; }
    .italic { font-style: italic; }

    .badge { display: inline-block; padding: 1px 6px; border-radius: 10px; font-size: 9px; font-weight: 700; }
    .badge-ok   { background: #d4f5d4; color: #166534; }
    .badge-pend { background: #fef3cd; color: #854d0e; }

    .check { color: #16a34a; font-weight: 700; font-size: 13px; }
    .cross  { color: #dc2626; font-weight: 700; font-size: 13px; }

    .print-btn { position: fixed; top: 16px; right: 20px; padding: 8px 16px; background: #D4AF37; color: #111; border: none; border-radius: 4px; font-size: 12px; font-weight: 700; cursor: pointer; }
    @media print { .print-btn { display: none; } body { padding: 0; } }
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">Imprimir</button>
  <div class="page-header">
    <div>
      <h1>${esc(tournament.name)}</h1>
      <div class="meta">${esc(tournament.dates)} · ${esc((tournament as any).club?.name)}${(tournament as any).club?.city ? `, ${esc((tournament as any).club.city)}` : ""}</div>
    </div>
    <div>
      <div class="logo">AMT PÁDEL</div>
      <div class="generated">Generado: ${now}</div>
    </div>
  </div>
  ${categorySections}
</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
}

// ── printSchedule ──────────────────────────────────────────────────────────────

const PHASE_LABEL: Record<string, string> = {
  GROUPS:      "Grupos",
  R16:         "Octavos",
  QF:          "Cuartos",
  SF:          "Semis",
  FINAL:       "Final",
  CONSOLATION: "Consolación",
};

export function printSchedule(
  tournament: Tournament,
  matches:    MatchResult[],
  catMap:     Record<string, string>,
): void {
  const scheduled = [...matches]
    .filter((m) => !!m.date)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (scheduled.length === 0) return;

  const byDate = new Map<string, MatchResult[]>();
  for (const m of scheduled) {
    const key = new Date(m.date).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    (byDate.get(key) ?? byDate.set(key, []).get(key)!).push(m);
  }

  const dateSections = [...byDate.entries()].map(([dateLabel, dayMatches]) => {
    const sorted = [...dayMatches].sort((a, b) => {
      const dt = new Date(a.date).getTime() - new Date(b.date).getTime();
      return dt !== 0 ? dt : (a.court ?? "").localeCompare(b.court ?? "");
    });

    const rows = sorted.map((m, i) => {
      const time    = new Date(m.date).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
      const cat     = catMap[m.categoryId ?? ""] ?? "—";
      const phase   = PHASE_LABEL[m.phase] ?? m.phase;
      const t1      = m.team1.map(esc).join(" / ") || "—";
      const t2      = m.team2.map(esc).join(" / ") || "—";
      const done    = m.status === "finished";
      const score   = done && m.sets1?.length
        ? m.sets1.map((s, j) => `${s}-${m.sets2?.[j] ?? 0}`).join(", ")
        : "";
      const w1 = m.winner === "team1";
      const w2 = m.winner === "team2";
      return `
        <tr class="${i % 2 === 0 ? "row-alt" : ""}">
          <td class="center time">${time}</td>
          <td class="center">${m.court ?? "—"}</td>
          <td class="center">${cat}</td>
          <td class="center phase">${phase}</td>
          <td class="${w1 ? "winner" : ""}">${t1}</td>
          <td class="center vs">vs</td>
          <td class="${w2 ? "winner" : ""}">${t2}</td>
          <td class="center">${done ? `<span class="score">${score || "—"}</span>` : '<span class="pending">Pendiente</span>'}</td>
        </tr>`;
    }).join("");

    const label = dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1);
    return `
      <div class="day-block">
        <div class="day-header">${label}<span class="match-count">${dayMatches.length} partido(s)</span></div>
        <table>
          <thead>
            <tr>
              <th class="center">Hora</th><th class="center">Pista</th><th class="center">Categoría</th>
              <th class="center">Fase</th><th>Equipo 1</th><th class="center" style="width:20px"></th>
              <th>Equipo 2</th><th class="center">Resultado</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }).join("");

  const now = new Date().toLocaleString("es-ES", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const club = (tournament as any).club;
  const meta = [(tournament as any).dates, club?.name, club?.city].filter(Boolean).map(esc).join(" · ");

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Horario — ${esc(tournament.name)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #111; background: #fff; padding: 20px 28px; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #D4AF37; padding-bottom: 10px; margin-bottom: 18px; }
    .page-header h1 { font-size: 18px; font-weight: 700; }
    .page-header .meta { font-size: 10px; color: #555; margin-top: 3px; }
    .page-header .logo { font-size: 13px; font-weight: 800; color: #D4AF37; letter-spacing: 1px; text-align: right; }
    .page-header .generated { font-size: 9px; color: #888; text-align: right; margin-top: 2px; }
    .day-block { margin-bottom: 24px; page-break-inside: avoid; }
    .day-header { display: flex; justify-content: space-between; align-items: center; background: #1a1a1a; color: #D4AF37; font-weight: 700; font-size: 12px; padding: 7px 10px; border-radius: 3px 3px 0 0; }
    .match-count { font-weight: 400; font-size: 9px; color: #aaa; }
    table { width: 100%; border-collapse: collapse; }
    thead tr { background: #f5f5f5; }
    th { padding: 5px 8px; text-align: left; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #555; border-bottom: 1px solid #ddd; }
    td { padding: 5px 8px; border-bottom: 1px solid #eee; vertical-align: middle; }
    tr.row-alt td { background: #fafafa; }
    .center { text-align: center; }
    .time { font-weight: 700; white-space: nowrap; }
    .phase { color: #666; font-size: 10px; }
    .winner { font-weight: 700; }
    .vs { color: #999; font-size: 10px; }
    .score { font-weight: 700; white-space: nowrap; }
    .pending { color: #999; font-style: italic; font-size: 10px; }
    .print-btn { position: fixed; top: 16px; right: 20px; padding: 8px 16px; background: #D4AF37; color: #111; border: none; border-radius: 4px; font-size: 12px; font-weight: 700; cursor: pointer; }
    @media print { .print-btn { display: none; } body { padding: 0; } }
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">Imprimir / Guardar PDF</button>
  <div class="page-header">
    <div>
      <h1>Horario — ${esc(tournament.name)}</h1>
      <div class="meta">${meta}</div>
    </div>
    <div>
      <div class="logo">AMT PÁDEL</div>
      <div class="generated">Generado: ${now}</div>
    </div>
  </div>
  ${dateSections}
</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
}

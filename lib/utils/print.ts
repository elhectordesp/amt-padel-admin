/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Tournament, AdminRegistration, RegistrationStatus, MatchResult } from "@/types";
import { formatDateRange } from "@/lib/utils/formatDateRange";

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
      <div class="meta">${esc(formatDateRange(tournament.startDate, tournament.endDate))} · ${esc((tournament as any).club?.name)}${(tournament as any).club?.city ? `, ${esc((tournament as any).club.city)}` : ""}</div>
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

// ── printTournamentReport ──────────────────────────────────────────────────────

const REPORT_PHASE_ORDER = ["GROUPS", "R32", "R16", "QF", "SF", "CONSOLATION", "FINAL"] as const;
const REPORT_PHASE_LABEL: Record<string, string> = {
  GROUPS: "Grupos", R32: "Dieciseisavos", R16: "Octavos", QF: "Cuartos", SF: "Semis", CONSOLATION: "Consolación", FINAL: "Final",
};

export function printTournamentReport(
  tournament: Tournament,
  matches:    MatchResult[],
): void {
  const accent = (tournament as any).imageColor ?? "#D4AF37";

  const catMap: Record<string, string> = {};
  for (const c of tournament.categories ?? []) {
    catMap[(c as any).id] = `${(c as any).gender === "M" ? "Masc." : "Fem."} ${(c as any).level}`;
  }

  const finals        = matches.filter((m) => m.phase === "FINAL" && m.winner);
  const finishedCount = matches.filter((m) => m.status === "finished").length;
  const now           = new Date().toLocaleString("es-ES", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const club          = (tournament as any).club;
  const meta          = [club?.name, club?.city].filter(Boolean).map(esc).join(" · ");
  const dateRange     = formatDateRange(tournament.startDate, tournament.endDate);

  const championsHtml = finals.length > 0 ? `
    <section class="section">
      <h2 class="section-title">&#127942; Campeones</h2>
      <div class="champions-grid">
        ${finals.map((m) => {
          const champion = m.winner === "team1" ? m.team1 : m.team2;
          const runnerUp = m.winner === "team1" ? m.team2 : m.team1;
          const score    = m.sets1?.length
            ? m.sets1.map((s, i) => `${s}-${m.sets2?.[i] ?? 0}`).join(", ")
            : "";
          return `
            <div class="champion-card">
              <div class="cat-pill">${esc(catMap[(m as any).categoryId ?? ""] ?? "—")}</div>
              <div class="trophy-icon">&#127942;</div>
              <div class="champion-names">${champion.map(esc).join(" / ")}</div>
              ${runnerUp.length ? `<div class="runner-up">&#129352; ${runnerUp.map(esc).join(" / ")}</div>` : ""}
              ${score ? `<div class="final-score">${esc(score)}</div>` : ""}
            </div>`;
        }).join("")}
      </div>
    </section>` : "";

  const byCat = new Map<string, MatchResult[]>();
  for (const m of matches) {
    const cid = (m as any).categoryId ?? "unknown";
    if (!byCat.has(cid)) byCat.set(cid, []);
    byCat.get(cid)!.push(m);
  }

  const resultsHtml = [...byCat.entries()].map(([catId, catMatches]) => {
    const catLabel = catMap[catId] ?? "Desconocida";
    const byPhase  = new Map<string, MatchResult[]>();
    for (const m of catMatches) {
      if (!byPhase.has(m.phase)) byPhase.set(m.phase, []);
      byPhase.get(m.phase)!.push(m);
    }

    const phaseSections = REPORT_PHASE_ORDER
      .filter((ph) => byPhase.has(ph))
      .map((ph) => {
        const phMatches = [...(byPhase.get(ph) ?? [])].sort((a, b) =>
          a.date && b.date ? new Date(a.date).getTime() - new Date(b.date).getTime() : 0,
        );
        const rows = phMatches.map((m, i) => {
          const done  = m.status === "finished";
          const score = done && m.sets1?.length
            ? m.sets1.map((s, j) => `${s}-${m.sets2?.[j] ?? 0}`).join(", ")
            : "";
          const w1   = m.winner === "team1";
          const w2   = m.winner === "team2";
          const time = m.date
            ? new Date(m.date).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
            : "—";
          return `
            <tr class="${i % 2 === 0 ? "row-alt" : ""}">
              <td class="center tcell-time">${esc(time)}</td>
              <td class="center tcell-court">${esc((m as any).court ?? "—")}</td>
              <td class="${w1 ? "winner" : ""}">${m.team1.map(esc).join(" / ") || "—"}</td>
              <td class="center tcell-vs">vs</td>
              <td class="${w2 ? "winner" : ""}">${m.team2.map(esc).join(" / ") || "—"}</td>
              <td class="center">${done ? `<span class="score">${esc(score || "—")}</span>` : '<span class="pending">Pendiente</span>'}</td>
            </tr>`;
        }).join("");

        return `
          <div class="phase-group">
            <div class="phase-label">${REPORT_PHASE_LABEL[ph] ?? ph}</div>
            <table>
              <thead><tr>
                <th class="center">Fecha/Hora</th><th class="center">Pista</th>
                <th>Equipo 1</th><th class="center" style="width:20px"></th><th>Equipo 2</th>
                <th class="center">Resultado</th>
              </tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>`;
      }).join("");

    const done = catMatches.filter((m) => m.status === "finished").length;
    return `
      <div class="cat-block">
        <div class="cat-header">
          ${esc(catLabel)}
          <span class="cat-meta">${catMatches.length} partidos &middot; ${done} finalizados</span>
        </div>
        ${phaseSections}
      </div>`;
  }).join("");

  const reportHtml = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Informe &mdash; ${esc(tournament.name)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, Arial, sans-serif; font-size: 11px; color: #111; background: #f0f0f0; }
    .report-header {
      background: linear-gradient(135deg, #0f0f0f 0%, #1c1c1c 65%, ${accent}18 100%);
      padding: 28px 32px 22px; border-bottom: 3px solid ${accent};
    }
    .header-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; }
    .logo { font-size: 11px; font-weight: 800; color: ${accent}; letter-spacing: 2px; text-transform: uppercase; }
    .generated { font-size: 9px; color: #888; text-align: right; margin-top: 3px; }
    .tournament-name { font-size: 24px; font-weight: 800; color: #fff; letter-spacing: -0.5px; margin-bottom: 5px; }
    .tournament-meta { font-size: 11px; color: #999; margin-bottom: 16px; }
    .stats-bar { display: flex; gap: 8px; flex-wrap: wrap; }
    .stat-chip {
      background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
      border-radius: 20px; padding: 3px 11px; font-size: 10px; color: #bbb;
    }
    .stat-chip strong { color: ${accent}; }
    .content { padding: 22px 32px; max-width: 920px; margin: 0 auto; }
    .section { margin-bottom: 28px; }
    .section-title {
      font-size: 13px; font-weight: 700; color: #111;
      margin-bottom: 14px; padding-bottom: 7px; border-bottom: 2px solid ${accent};
    }
    .champions-grid { display: flex; gap: 12px; flex-wrap: wrap; }
    .champion-card {
      background: linear-gradient(145deg, #181818 0%, #252525 100%);
      border: 1px solid ${accent}44; border-radius: 8px;
      padding: 14px 16px; min-width: 150px; flex: 1;
      text-align: center; page-break-inside: avoid;
    }
    .cat-pill {
      display: inline-block; background: ${accent}18; border: 1px solid ${accent}44; color: ${accent};
      font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;
      padding: 2px 8px; border-radius: 10px; margin-bottom: 8px;
    }
    .trophy-icon { font-size: 24px; margin-bottom: 6px; }
    .champion-names { font-size: 11px; font-weight: 700; color: #fff; line-height: 1.3; margin-bottom: 5px; }
    .runner-up { font-size: 10px; color: #999; margin-bottom: 4px; }
    .final-score { font-size: 10px; font-weight: 700; color: ${accent}; }
    .cat-block { margin-bottom: 20px; page-break-inside: avoid; }
    .cat-header {
      background: #1a1a1a; color: ${accent}; font-weight: 700; font-size: 11px;
      padding: 7px 12px; border-radius: 4px 4px 0 0;
      display: flex; justify-content: space-between; align-items: center;
    }
    .cat-meta { font-weight: 400; font-size: 9px; color: #aaa; }
    .phase-group { margin-bottom: 1px; }
    .phase-label {
      background: #e8e8e8; font-size: 9px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.8px; color: #555; padding: 4px 12px;
    }
    table { width: 100%; border-collapse: collapse; background: #fff; }
    thead tr { background: #fafafa; }
    th { padding: 5px 8px; text-align: left; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; color: #777; border-bottom: 1px solid #eee; }
    td { padding: 5px 8px; border-bottom: 1px solid #f0f0f0; vertical-align: middle; }
    tr.row-alt td { background: #fafafa; }
    .center { text-align: center; }
    .tcell-time { color: #666; white-space: nowrap; font-size: 10px; }
    .tcell-court { color: #666; font-size: 10px; }
    .tcell-vs { color: #ccc; font-size: 10px; width: 20px; }
    .winner { font-weight: 700; }
    .score { font-weight: 700; white-space: nowrap; color: ${accent}; }
    .pending { color: #bbb; font-style: italic; font-size: 10px; }
    .print-btn {
      position: fixed; top: 16px; right: 20px; padding: 8px 18px;
      background: ${accent}; color: #111; border: none; border-radius: 4px;
      font-size: 12px; font-weight: 700; cursor: pointer;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    }
    @media print {
      .print-btn { display: none; }
      body { background: #fff; }
      .report-header, .champion-card, .cat-header, .phase-label {
        -webkit-print-color-adjust: exact; print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">Guardar PDF</button>
  <div class="report-header">
    <div class="header-top">
      <div class="logo">AMT P&aacute;del</div>
      <div>
        <div class="logo" style="font-size:9px;letter-spacing:1.5px">Informe post-torneo</div>
        <div class="generated">Generado: ${now}</div>
      </div>
    </div>
    <div class="tournament-name">${esc(tournament.name)}</div>
    <div class="tournament-meta">${esc(dateRange)}${meta ? ` &nbsp;&middot;&nbsp; ${meta}` : ""}</div>
    <div class="stats-bar">
      <div class="stat-chip"><strong>${tournament.categories?.length ?? 0}</strong> categor&iacute;as</div>
      <div class="stat-chip"><strong>${matches.length}</strong> partidos</div>
      <div class="stat-chip"><strong>${finishedCount}</strong> finalizados</div>
      ${finals.length > 0 ? `<div class="stat-chip"><strong>${finals.length}</strong> campe&oacute;n(es)</div>` : ""}
    </div>
  </div>
  <div class="content">
    ${championsHtml}
    ${resultsHtml ? `
    <section class="section">
      <h2 class="section-title">&#128203; Resultados por Categor&iacute;a</h2>
      ${resultsHtml}
    </section>` : ""}
  </div>
</body>
</html>`;

  const reportWin = window.open("", "_blank");
  if (!reportWin) return;
  reportWin.document.write(reportHtml);
  reportWin.document.close();
}

// ── printSchedule ──────────────────────────────────────────────────────────────

const PHASE_LABEL: Record<string, string> = {
  GROUPS:      "Grupos",
  R32:         "Dieciseisavos",
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
  const meta = [formatDateRange(tournament.startDate, tournament.endDate), club?.name, club?.city].filter(Boolean).map(esc).join(" · ");

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

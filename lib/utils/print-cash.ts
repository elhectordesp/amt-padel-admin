import { esc } from "@/lib/utils/print";
import { formatCents } from "@/lib/utils/booking-price";
import { methodLabel } from "@/lib/utils/payment-methods";
import { zonedTime } from "@/lib/utils/time-zone";
import type { CashOfDay } from "@/lib/services/cash";

/** Los métodos de la caja en el orden en que se enseñan; los que no aparezcan (antiguos), después. */
const METHOD_ORDER = ["CASH", "CARD", "BIZUM", "TRANSFER", "ONLINE", "OTHER"];

/** Los métodos con importe del día, en orden: los del catálogo y luego los antiguos. */
export function methodsWithTotals(totals: Record<string, number>): string[] {
  const known = METHOD_ORDER.filter((m) => m in totals);
  const rest = Object.keys(totals).filter((m) => !METHOD_ORDER.includes(m)).sort();
  return [...known, ...rest];
}

/** «10/11/2026» a partir de «2026-11-10». */
export function dayLabel(date: string): string {
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}

/** El cierre del día para imprimir: totales por método y cada movimiento. */
export function buildCashHtml(cash: CashOfDay, clubName: string | null): string {
  const totals = methodsWithTotals(cash.totalsByMethod)
    .map((m) => `<tr><td>${esc(methodLabel(m))}</td><td class="r">${esc(formatCents(cash.totalsByMethod[m]))}</td></tr>`)
    .join("");
  const rows = cash.movements
    .map(
      (m) => `<tr>
        <td>${esc(zonedTime(m.at, cash.timezone))}</td>
        <td>${esc(m.concept)}</td>
        <td>${esc(m.person)}</td>
        <td>${esc(methodLabel(m.method))}</td>
        <td class="r">${esc(formatCents(m.amountCents))}</td>
      </tr>`,
    )
    .join("");
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Caja del ${esc(dayLabel(cash.date))}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 12px; color: #111; padding: 24px; }
    h1 { font-size: 18px; margin: 0 0 2px; }
    .meta { color: #666; margin-bottom: 16px; }
    h2 { font-size: 13px; margin: 18px 0 6px; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; font-size: 10px; text-transform: uppercase; color: #555; border-bottom: 1px solid #ccc; padding: 4px 6px; }
    td { padding: 4px 6px; border-bottom: 1px solid #eee; vertical-align: top; }
    .r { text-align: right; white-space: nowrap; }
    .total td { font-weight: 700; border-top: 2px solid #111; }
    .print-bar { margin-bottom: 12px; text-align: right; }
    @media print { .print-bar { display: none; } body { padding: 0; } }
  </style>
</head>
<body>
  <div class="print-bar"><button onclick="window.print()">Imprimir</button></div>
  <h1>Caja del ${esc(dayLabel(cash.date))}</h1>
  <div class="meta">${esc(clubName ?? "")}</div>
  <h2>Total por método</h2>
  <table><tbody>${totals}<tr class="total"><td>Total</td><td class="r">${esc(formatCents(cash.totalCents))}</td></tr></tbody></table>
  <h2>Movimientos (${cash.movements.length})</h2>
  <table>
    <thead><tr><th>Hora</th><th>Concepto</th><th>Persona</th><th>Método</th><th class="r">Importe</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
}

export function printCash(cash: CashOfDay, clubName: string | null): void {
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(buildCashHtml(cash, clubName));
  win.document.close();
}

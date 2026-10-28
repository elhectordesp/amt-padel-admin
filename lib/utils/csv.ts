// Characters that Excel/Sheets interpret as formula prefixes — must be neutralised (OWASP CSV injection)
const FORMULA_PREFIXES = new Set(["=", "+", "-", "@", "\t", "\r"]);

/**
 * Separador «;»: el Excel en español (el que usan los clubes) usa la coma
 * para los decimales y espera «;» entre columnas. Con «,» abría todo en una
 * sola columna (QA D09).
 */
const SEPARATOR = ";";

function sanitize(s: string): string {
  return FORMULA_PREFIXES.has(s[0]) ? `\t${s}` : s;
}

/** Un número con coma decimal, como lo lee el Excel en español. */
function formatValue(v: string | number): string {
  return typeof v === "number" && !Number.isInteger(v) ? String(v).replace(".", ",") : String(v);
}

/** El texto del CSV: cabecera con las claves de la primera fila y una línea por fila. */
export function toCsv(rows: Record<string, string | number>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape  = (v: string | number) => {
    const s = sanitize(formatValue(v));
    return s.includes(SEPARATOR) || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  return [
    headers.map(escape).join(SEPARATOR),
    ...rows.map((row) => headers.map((h) => escape(row[h] ?? "")).join(SEPARATOR)),
  ].join("\n");
}

export function downloadCsv(filename: string, rows: Record<string, string | number>[]) {
  if (!rows.length) return;
  const csv = toCsv(rows);

  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

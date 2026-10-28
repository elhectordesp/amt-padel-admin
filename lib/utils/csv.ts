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

/**
 * Una celda: un número, con coma decimal (como lo lee el Excel en español) y
 * sin neutralizar (un negativo empieza por «-» y con el tabulador delante
 * Excel lo leía como texto y no sumaba); un texto, neutralizado (puede venir
 * del usuario).
 */
function formatValue(v: string | number): string {
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(v).replace(".", ",");
  return sanitize(v);
}

/** El texto del CSV: cabecera con las claves de la primera fila y una línea por fila. */
export function toCsv(rows: Record<string, string | number>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape  = (v: string | number) => {
    const s = formatValue(v);
    // Un \r suelto también parte la fila en algunos lectores: como el \n
    return s.includes(SEPARATOR) || s.includes('"') || s.includes("\n") || s.includes("\r")
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

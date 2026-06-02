// Characters that Excel/Sheets interpret as formula prefixes — must be neutralised (OWASP CSV injection)
const FORMULA_PREFIXES = new Set(["=", "+", "-", "@", "\t", "\r"]);

function sanitize(s: string): string {
  return FORMULA_PREFIXES.has(s[0]) ? `\t${s}` : s;
}

export function downloadCsv(filename: string, rows: Record<string, string | number>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape  = (v: string | number) => {
    const s = sanitize(String(v));
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const csv = [
    headers.map(escape).join(","),
    ...rows.map((row) => headers.map((h) => escape(row[h] ?? "")).join(",")),
  ].join("\n");

  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

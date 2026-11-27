"use client";

import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  clubCustomersQK,
  clubCustomersService,
  type ClubCustomersImportReport,
} from "@/lib/services/club-customers";

interface Props {
  open:    boolean;
  clubId:  string;
  onClose: () => void;
}

const MAX_BYTES = 1024 * 1024;

// BOM y «;» para que Excel en español lo abra bien y lo lea por columnas
const TEMPLATE =
  "﻿nombre;email;telefono;socio;numero_socio;fecha_alta;fecha_nacimiento;etiquetas;notas\r\n" +
  "Ana García;ana@ejemplo.com;600112233;sí;A-001;15/03/2023;12/05/1985;Profe|Zurdo;Prefiere pistas por la tarde\r\n" +
  "Luis Pérez;;611223344;no;;;;;\r\n";

function downloadTemplate() {
  const url = URL.createObjectURL(new Blob([TEMPLATE], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "plantilla-clientes.csv";
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * «Importar» clientes desde un CSV, en tres pasos: elegir el fichero, ver lo
 * que entra y lo que no (el servidor lo comprueba sin guardar nada) y
 * confirmar. El parseo y la validación son solo del servidor.
 */
export function ClubCustomerImportDialog({ open, clubId, onClose }: Props) {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ClubCustomersImportReport | null>(null);
  const [result, setResult] = useState<ClubCustomersImportReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const check = useMutation({
    mutationFn: (f: File) => clubCustomersService.importCsv(clubId, f, true),
    onSuccess: setPreview,
    onError: (e: Error) => {
      setPreview(null);
      setError(e.message);
    },
  });
  const confirm = useMutation({
    mutationFn: () => clubCustomersService.importCsv(clubId, file!, false),
    onSuccess: (report) => {
      setResult(report);
      void qc.invalidateQueries({ queryKey: clubCustomersQK.all(clubId) });
      toast.success(`${report.created} clientes importados`);
    },
    onError: (e: Error) => setError(e.message),
  });

  if (!open) return null;

  const reset = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    check.reset();
    confirm.reset();
    if (input.current) input.current.value = "";
  };
  const close = () => {
    reset();
    onClose();
  };

  const pick = (f: File | undefined) => {
    setPreview(null);
    setError(null);
    if (!f) return setFile(null);
    setFile(f);
    if (!/\.csv$/i.test(f.name)) return setError("El fichero debe ser un .csv (en Excel: Guardar como «CSV UTF-8»)");
    if (f.size > MAX_BYTES) return setError("El fichero supera 1 MB");
    check.mutate(f);
  };

  const step = result ? 3 : preview ? 2 : 1;
  const report = result ?? preview;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div role="dialog" aria-label="Importar clientes" className="bg-card border border-border rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-heading text-lg">Importar clientes · paso {step} de 3</h2>
          <button type="button" onClick={close} aria-label="Cerrar" className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button>
        </div>

        <div className="p-6 space-y-4 text-sm">
          {step === 1 && (
            <>
              <p className="text-muted-foreground">
                Sube un CSV con tu lista de clientes y socios (máximo 2.000 filas y 1 MB). En Excel: Guardar como «CSV UTF-8».
                Solo es obligatorio el nombre.
                La columna fecha_nacimiento (dd/mm/aaaa) es opcional: con ella se sabe quién es menor.
                Antes de guardar nada verás qué entra y qué no.
              </p>
              <Button type="button" variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="h-3.5 w-3.5" /> Descargar plantilla
              </Button>
              <input
                ref={input}
                type="file"
                accept=".csv,text/csv"
                aria-label="Fichero CSV"
                onChange={(e) => pick(e.target.files?.[0])}
                className="block w-full text-sm"
              />
              {check.isPending && (
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Comprobando el fichero…
                </p>
              )}
            </>
          )}

          {report && (
            <>
              <p className="font-medium">
                {step === 3
                  ? `Importación terminada: ${report.created} clientes añadidos.`
                  : `${report.toCreate} de ${report.total} filas entrarán.`}
              </p>
              <ul className="space-y-1 text-muted-foreground">
                <li>Filas del fichero: {report.total}</li>
                <li>{step === 3 ? "Añadidos" : "Entrarán"}: {step === 3 ? report.created : report.toCreate}</li>
                <li>Repetidos, no se importan: {report.duplicates.length}</li>
                <li>Con errores, no se importan: {report.errors.length}</li>
              </ul>
              <IssueList title="Repetidos" items={report.duplicates.map((d) => ({ line: d.line, text: d.reason }))} />
              <IssueList title="Errores" items={report.errors.map((d) => ({ line: d.line, text: d.message }))} />
            </>
          )}

          {error && <p role="alert" className="text-destructive">{error}</p>}

          <div className="flex justify-end gap-2">
            {step === 1 && <Button type="button" variant="ghost" size="sm" onClick={close}>Cancelar</Button>}
            {step === 2 && (
              <>
                <Button type="button" variant="ghost" size="sm" onClick={reset} disabled={confirm.isPending}>Elegir otro fichero</Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={confirm.isPending || !preview || preview.toCreate === 0}
                  onClick={() => { setError(null); confirm.mutate(); }}
                >
                  {confirm.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Importar {preview?.toCreate ?? 0} clientes
                </Button>
              </>
            )}
            {step === 3 && <Button type="button" size="sm" onClick={close}>Cerrar</Button>}
          </div>
        </div>
      </div>
    </div>
  );
}

function IssueList({ title, items }: { title: string; items: { line: number; text: string }[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <ul className="max-h-40 overflow-y-auto rounded-md border border-border p-2 text-xs space-y-0.5">
        {items.map((i) => (
          <li key={`${i.line}-${i.text}`}>Línea {i.line}: {i.text}</li>
        ))}
      </ul>
    </div>
  );
}

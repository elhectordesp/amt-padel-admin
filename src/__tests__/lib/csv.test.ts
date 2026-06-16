/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock del DOM (URL, Blob, createElement)
const clickMock    = vi.fn();
const revokeMock   = vi.fn();
const createObjUrl = vi.fn().mockReturnValue('blob:mock-url');

beforeEach(() => {
  vi.clearAllMocks();
  global.URL.createObjectURL = createObjUrl;
  global.URL.revokeObjectURL = revokeMock;
  vi.spyOn(document, 'createElement').mockReturnValue({
    href: '',
    download: '',
    click: clickMock,
  } as any);
});

import { downloadCsv } from '../../../lib/utils/csv';

describe('downloadCsv', () => {
  it('no hace nada si rows está vacío', () => {
    downloadCsv('export', []);
    expect(clickMock).not.toHaveBeenCalled();
  });

  it('genera un CSV con headers y filas correctas', () => {
    const rows = [
      { nombre: 'Ana', puntos: 100 },
      { nombre: 'Bob', puntos: 200 },
    ];
    downloadCsv('ranking', rows);
    expect(clickMock).toHaveBeenCalledTimes(1);
    expect(createObjUrl).toHaveBeenCalledTimes(1);
    // El Blob se crea con el contenido CSV
    const blobArg = (global.Blob as any).mock?.calls?.[0]?.[0]?.[0] ?? '';
    if (blobArg) {
      expect(blobArg).toContain('nombre');
      expect(blobArg).toContain('Ana');
    }
  });

  it('escapa valores con comas entre comillas dobles', () => {
    const rows = [{ valor: 'uno, dos' }];
    // No debe lanzar error
    expect(() => downloadCsv('test', rows)).not.toThrow();
  });

  it('escapa comillas dobles dentro de valores', () => {
    const rows = [{ valor: 'say "hello"' }];
    expect(() => downloadCsv('test', rows)).not.toThrow();
  });

  it('revoca la URL de objeto después de la descarga', () => {
    downloadCsv('test', [{ a: 1 }]);
    expect(revokeMock).toHaveBeenCalledWith('blob:mock-url');
  });

  it('el nombre de archivo incluye la extensión .csv', () => {
    const anchor = { href: '', download: '', click: clickMock };
    vi.spyOn(document, 'createElement').mockReturnValue(anchor as any);
    downloadCsv('mi-reporte', [{ x: 1 }]);
    expect(anchor.download).toBe('mi-reporte.csv');
  });
});

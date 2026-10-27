import { describe, it, expect } from "vitest";
import {
  PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE,
  clampPage, pageCount, pageRange, paginate,
} from "../../../lib/utils/pagination";

const items = Array.from({ length: 230 }, (_, i) => i + 1);

describe("paginación", () => {
  it("se elige entre 25, 50 y 100 filas; 50 de entrada", () => {
    expect(PAGE_SIZE_OPTIONS).toEqual([25, 50, 100]);
    expect(DEFAULT_PAGE_SIZE).toBe(50);
  });

  it("pageCount: al menos una página", () => {
    expect(pageCount(230, 50)).toBe(5);
    expect(pageCount(250, 50)).toBe(5);
    expect(pageCount(0, 50)).toBe(1);
  });

  it("clampPage: una página que ya no existe (tras filtrar) pasa a la última", () => {
    expect(clampPage(7, 230, 50)).toBe(5);
    expect(clampPage(0, 230, 50)).toBe(1);
    expect(clampPage(3, 10, 25)).toBe(1);
  });

  it("paginate: las filas de la página, sin perder ninguna (la última, incompleta)", () => {
    expect(paginate(items, 1, 50)).toEqual(items.slice(0, 50));
    expect(paginate(items, 5, 50)).toEqual(items.slice(200, 230));
    expect(paginate(items, 9, 100)).toEqual(items.slice(200, 230));
    const all = [1, 2, 3, 4, 5].flatMap((p) => paginate(items, p, 50));
    expect(all).toEqual(items);
  });

  it("pageRange: «Mostrando 26–50 de 230»", () => {
    expect(pageRange(2, 25, 230)).toEqual({ from: 26, to: 50 });
    expect(pageRange(10, 25, 230)).toEqual({ from: 226, to: 230 });
    expect(pageRange(1, 25, 0)).toEqual({ from: 0, to: 0 });
  });
});

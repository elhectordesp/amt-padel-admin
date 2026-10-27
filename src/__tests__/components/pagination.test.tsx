import { describe, it, expect, vi } from "vitest";
import { render, renderHook, screen, fireEvent } from "@testing-library/react";
import { Pagination, useKeepPageInRange } from "../../../components/admin/pagination";

function setup(props: Partial<React.ComponentProps<typeof Pagination>> = {}) {
  const onPageChange = vi.fn();
  const onPageSizeChange = vi.fn();
  render(
    <Pagination
      page={2}
      pageSize={50}
      total={230}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
      itemLabel="jugadores"
      {...props}
    />,
  );
  return { onPageChange, onPageSizeChange };
}

describe("Pagination", () => {
  it("dice qué filas se ven de cuántas y en qué página está", () => {
    setup();
    expect(screen.getByText("Mostrando 51–100 de 230 jugadores")).toBeInTheDocument();
    expect(screen.getByText("2 / 5")).toBeInTheDocument();
  });

  it("pasa de página adelante y atrás", () => {
    const { onPageChange } = setup();
    fireEvent.click(screen.getByRole("button", { name: /página siguiente/i }));
    expect(onPageChange).toHaveBeenLastCalledWith(3);
    fireEvent.click(screen.getByRole("button", { name: /página anterior/i }));
    expect(onPageChange).toHaveBeenLastCalledWith(1);
  });

  it("en la primera y en la última no deja salirse", () => {
    setup({ page: 1 });
    expect(screen.getByRole("button", { name: /página anterior/i })).toBeDisabled();
  });

  it("en la última página tampoco", () => {
    setup({ page: 5 });
    expect(screen.getByRole("button", { name: /página siguiente/i })).toBeDisabled();
    expect(screen.getByText("Mostrando 201–230 de 230 jugadores")).toBeInTheDocument();
  });

  it("deja elegir 25, 50 o 100 por página", () => {
    const { onPageSizeChange } = setup();
    const select = screen.getByRole("combobox", { name: /filas por página/i });
    expect([...select.querySelectorAll("option")].map((o) => o.textContent)).toEqual(["25", "50", "100"]);
    fireEvent.change(select, { target: { value: "100" } });
    expect(onPageSizeChange).toHaveBeenCalledWith(100);
  });

  it("mientras llega otra página del servidor no se puede pasar de página", () => {
    setup({ busy: true });
    expect(screen.getByRole("button", { name: /página siguiente/i })).toBeDisabled();
  });

  it("con pocas filas no enseña botones ni selector; sin filas, nada", () => {
    setup({ total: 12, page: 1 });
    expect(screen.getByText("Mostrando 1–12 de 12 jugadores")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /página siguiente/i })).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("sin filas no se pinta", () => {
    const { container } = render(
      <Pagination page={1} pageSize={50} total={0} onPageChange={vi.fn()} onPageSizeChange={vi.fn()} itemLabel="x" />,
    );
    expect(container.firstChild).toBeNull();
  });
});

describe("useKeepPageInRange (paginación en el servidor)", () => {
  type Props = { page: number; total: number | undefined };

  it("si baja el total y la página ya no existe, pasa a la última que haya", () => {
    const setPage = vi.fn();
    const { rerender } = renderHook(
      ({ page, total }: Props) => useKeepPageInRange(page, setPage, 25, total),
      { initialProps: { page: 2, total: 40 } },
    );
    expect(setPage).not.toHaveBeenCalled();

    // «Invitar pendientes» con «Sin activar»: quedan 10, cabe en una página
    rerender({ page: 2, total: 10 });
    expect(setPage).toHaveBeenCalledWith(1);
  });

  it("sin filas vuelve a la primera", () => {
    const setPage = vi.fn();
    renderHook(() => useKeepPageInRange(3, setPage, 50, 0));
    expect(setPage).toHaveBeenCalledWith(1);
  });

  it("de 230 a 120 con 50 por página: de la 5 a la 3", () => {
    const setPage = vi.fn();
    renderHook(() => useKeepPageInRange(5, setPage, 50, 120));
    expect(setPage).toHaveBeenCalledWith(3);
  });

  it("sin total de verdad todavía (cargando o datos de la consulta anterior), no toca nada", () => {
    const setPage = vi.fn();
    renderHook(() => useKeepPageInRange(4, setPage, 25, undefined));
    expect(setPage).not.toHaveBeenCalled();
  });
});

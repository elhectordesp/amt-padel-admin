/**
 * Inscripciones abre el torneo que viene en la URL (`?torneo=`): así enlazan
 * las alertas y la actividad del dashboard (P3-2). Antes la página no leía
 * ningún parámetro y siempre salía «Selecciona un torneo...».
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

let searchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => searchParams,
}));

vi.mock("@/components/admin/header", () => ({
  Header: ({ title }: { title: string }) => <div data-testid="header">{title}</div>,
}));

const listRegistrations = vi.fn().mockResolvedValue([]);
vi.mock("@/lib/services/admin", () => ({
  adminService: {
    tournaments: {
      list: vi.fn().mockResolvedValue([
        { id: "t1", name: "Open Valencia", categories: [] },
        { id: "t2", name: "Open Málaga", categories: [] },
      ]),
      adminDetail: vi.fn().mockResolvedValue({ schedule: [], categories: [] }),
    },
    registrations: { list: (...args: unknown[]) => listRegistrations(...args) },
  },
  invalidateRegistrations: vi.fn(),
  registrationsQK: { list: (id: string) => ["registrations", id] },
}));

import InscripcionesPage from "../../../app/(admin)/inscripciones/page";

const SELECT_A_TOURNAMENT = "Selecciona un torneo para gestionar sus inscripciones";

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const ui = () => (
    <QueryClientProvider client={qc}>
      <InscripcionesPage />
    </QueryClientProvider>
  );
  const view = render(ui());
  return { ...view, rerenderPage: () => view.rerender(ui()) };
}

describe("InscripcionesPage — torneo elegido en la URL", () => {
  let replaceState: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    searchParams = new URLSearchParams();
    replaceState = vi.spyOn(window.history, "replaceState");
  });

  afterEach(() => {
    replaceState.mockRestore();
  });

  it("con ?torneo= abre ese torneo y carga sus inscripciones", async () => {
    searchParams = new URLSearchParams("torneo=t1");

    renderPage();

    await waitFor(() => expect(listRegistrations).toHaveBeenCalledWith("t1"));
    expect(await screen.findByRole("option", { name: "Open Valencia" })).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveValue("t1");
    expect(screen.queryByText(SELECT_A_TOURNAMENT)).not.toBeInTheDocument();
  });

  it("sin parámetro, pide elegir un torneo y no carga inscripciones", async () => {
    renderPage();

    expect(await screen.findByText(SELECT_A_TOURNAMENT)).toBeInTheDocument();
    expect(listRegistrations).not.toHaveBeenCalled();
  });

  it("elegir otro torneo lo deja en la URL sin ir al servidor (history.replaceState)", async () => {
    searchParams = new URLSearchParams("torneo=t1");
    renderPage();
    await screen.findByRole("option", { name: "Open Málaga" });

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "t2" } });

    expect(replaceState).toHaveBeenCalledWith(null, "", "/inscripciones?torneo=t2");
  });

  it("volver a «Selecciona un torneo...» quita el parámetro", async () => {
    searchParams = new URLSearchParams("torneo=t1");
    renderPage();
    await screen.findByRole("option", { name: "Open Valencia" });

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "" } });

    expect(replaceState).toHaveBeenCalledWith(null, "", "/inscripciones");
  });

  it("un ?torneo= que no está en la lista cuenta como ninguno: no pide inscripciones y se quita de la URL", async () => {
    searchParams = new URLSearchParams("torneo=borrado");

    renderPage();

    expect(await screen.findByText(SELECT_A_TOURNAMENT)).toBeInTheDocument();
    expect(listRegistrations).not.toHaveBeenCalled();
    expect(replaceState).toHaveBeenCalledWith(null, "", "/inscripciones");
  });

  it("si el torneo cambia por la URL (historial, enlace), la búsqueda y los filtros empiezan de cero", async () => {
    searchParams = new URLSearchParams("torneo=t1");
    const { rerenderPage } = renderPage();
    const search = await screen.findByPlaceholderText("Buscar jugador o pareja...");
    fireEvent.change(search, { target: { value: "ana" } });
    expect(search).toHaveValue("ana");

    searchParams = new URLSearchParams("torneo=t2");
    rerenderPage();

    await waitFor(() => expect(listRegistrations).toHaveBeenCalledWith("t2"));
    expect(screen.getByRole("combobox")).toHaveValue("t2");
    expect(screen.getByPlaceholderText("Buscar jugador o pareja...")).toHaveValue("");
  });
});

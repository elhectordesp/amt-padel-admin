/**
 * Inscripciones abre el torneo que viene en la URL (`?torneo=`): así enlazan
 * las alertas y la actividad del dashboard (P3-2). Antes la página no leía
 * ningún parámetro y siempre salía «Selecciona un torneo...».
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
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

describe("InscripcionesPage — invitación a la pareja pendiente", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParams = new URLSearchParams("torneo=t1");
  });

  const row = (id: string, name: string, extra: Record<string, unknown>) => ({
    id,
    tournamentId: "t1",
    categoryId:   "c-1",
    userId:       `u-${id}`,
    user:         { name },
    category:     { gender: "F", level: "4a", price: 30 },
    status:       "PENDING",
    paid:         false,
    createdAt:    "2026-11-01T10:00:00.000Z",
    ...extra,
  });

  it("la fila sin pareja con la invitación pendiente lleva «invitada: … (pendiente)»; sin invitación, nada", async () => {
    listRegistrations.mockResolvedValueOnce([
      // Ana invitó a Bea desde la app; Bea aún no ha aceptado
      row("ana", "Ana López", {
        partnerId: null, partner: null,
        invitedPartnerId: "u-bea", partnerInvitedAt: "2026-11-01T10:00:00.000Z", invitedPartner: { name: "Bea Ruiz" },
      }),
      // De un back que aún no manda la invitación
      row("fani", "Fani Martín", { partnerId: null, partner: null }),
    ]);

    renderPage();

    // En las tarjetas (móvil) y en la tabla
    expect(await screen.findAllByText("invitada: Bea Ruiz (pendiente)")).toHaveLength(2);
    expect(screen.getAllByText("Sin pareja")).toHaveLength(4);
    expect(screen.getAllByText(/invitada:/)).toHaveLength(2);
  });

  it("«Poner pareja» en las filas sin pareja que no están canceladas, en tarjetas y tabla, y abre el modal de la pareja", async () => {
    listRegistrations.mockResolvedValueOnce([
      row("ana", "Ana López", {
        partnerId: null, partner: null,
        invitedPartnerId: "u-bea", partnerInvitedAt: "2026-11-01T10:00:00.000Z", invitedPartner: { name: "Bea Ruiz" },
      }),
      // Inscrita por el admin con «Sin pareja», en espera
      row("fani", "Fani Martín", { status: "WAITLIST", partnerId: null, partner: null, noPartner: true }),
      row("carla", "Carla Gil", {
        status: "CONFIRMED", partnerId: "u-dora", partner: { name: "Dora Sanz", categoryLevel: "4a", spaPoints: null },
      }),
      row("elena", "Elena Pons", { status: "CANCELLED", partnerId: null, partner: null }),
    ]);

    renderPage();
    await screen.findAllByText("Ana López");
    const tableRowOf = (name: string) =>
      screen.getAllByText(name).map((el) => el.closest("tr")).find((tr) => tr !== null) as HTMLElement;

    // Ana y Fani, cada una en su tarjeta y en su fila de la tabla
    expect(screen.getAllByTitle("Poner pareja")).toHaveLength(4);
    expect(within(tableRowOf("Ana López")).getByTitle("Poner pareja")).toBeInTheDocument();
    expect(within(tableRowOf("Fani Martín")).getByTitle("Poner pareja")).toBeInTheDocument();
    expect(within(tableRowOf("Elena Pons")).queryByTitle("Poner pareja")).not.toBeInTheDocument();
    const carla = tableRowOf("Carla Gil");
    expect(within(carla).queryByTitle("Poner pareja")).not.toBeInTheDocument();
    expect(within(carla).getByTitle("Cambiar pareja")).toBeInTheDocument();

    fireEvent.click(within(tableRowOf("Ana López")).getByTitle("Poner pareja"));

    expect(await screen.findByRole("heading", { name: "Poner pareja" })).toBeInTheDocument();
    expect(screen.getByText(/quedará sin efecto/).textContent).toBe("La invitación a Bea Ruiz quedará sin efecto.");
  });
});

describe("InscripcionesPage — la categoría por su género (D2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParams = new URLSearchParams("torneo=t1");
  });

  const pair = (id: string, name: string, categoryId: string, gender: string) => ({
    id,
    tournamentId: "t1",
    categoryId,
    userId:       `u-${id}`,
    user:         { name },
    partnerId:    null,
    partner:      null,
    category:     { gender, level: "4a", price: 30 },
    status:       "PENDING",
    paid:         false,
    createdAt:    "2026-11-01T10:00:00.000Z",
  });

  it("cada fila nombra su categoría (la mixta ya no sale «Fem.») y el buscador la encuentra por su nombre", async () => {
    listRegistrations.mockResolvedValueOnce([
      pair("ana", "Ana López", "c-mx", "MX"),
      pair("fani", "Fani Martín", "c-f", "F"),
      pair("gema", "Gema Ruiz", "c-g", "G"),
    ]);

    renderPage();
    await screen.findAllByText("Ana López");
    // En el filtro, en la tarjeta y en la tabla
    expect(screen.getAllByText("Mixta 4ª").length).toBeGreaterThanOrEqual(3);
    expect(screen.getAllByText("General 4ª").length).toBeGreaterThanOrEqual(3);

    fireEvent.change(screen.getByPlaceholderText("Buscar jugador o pareja..."), { target: { value: "mixta" } });
    await waitFor(() => expect(screen.queryByText("Fani Martín")).not.toBeInTheDocument());
    expect(screen.queryByText("Gema Ruiz")).not.toBeInTheDocument();
    expect(screen.getAllByText("Ana López").length).toBeGreaterThan(0);

    // El nivel también se busca como se escribe («4a»)
    fireEvent.change(screen.getByPlaceholderText("Buscar jugador o pareja..."), { target: { value: "4a" } });
    expect(await screen.findAllByText("Fani Martín")).not.toHaveLength(0);
  });
});

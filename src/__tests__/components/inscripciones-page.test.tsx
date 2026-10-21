/**
 * Inscripciones abre el torneo que viene en la URL (`?torneo=`): así enlazan
 * las alertas y la actividad del dashboard (P3-2). Antes la página no leía
 * ningún parámetro y siempre salía «Selecciona un torneo...».
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

let searchParams = new URLSearchParams();
const replaceMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
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

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <InscripcionesPage />
    </QueryClientProvider>,
  );
}

describe("InscripcionesPage — torneo elegido en la URL", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParams = new URLSearchParams();
  });

  it("con ?torneo= abre ese torneo y carga sus inscripciones", async () => {
    searchParams = new URLSearchParams("torneo=t1");

    renderPage();

    await waitFor(() => expect(listRegistrations).toHaveBeenCalledWith("t1"));
    expect(await screen.findByRole("option", { name: "Open Valencia" })).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveValue("t1");
    expect(
      screen.queryByText("Selecciona un torneo para gestionar sus inscripciones"),
    ).not.toBeInTheDocument();
  });

  it("sin parámetro, pide elegir un torneo y no carga inscripciones", async () => {
    renderPage();

    expect(
      await screen.findByText("Selecciona un torneo para gestionar sus inscripciones"),
    ).toBeInTheDocument();
    expect(listRegistrations).not.toHaveBeenCalled();
  });

  it("elegir otro torneo lo deja en la URL", async () => {
    searchParams = new URLSearchParams("torneo=t1");
    renderPage();
    await screen.findByRole("option", { name: "Open Málaga" });

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "t2" } });

    expect(replaceMock).toHaveBeenCalledWith("/inscripciones?torneo=t2", { scroll: false });
  });

  it("volver a «Selecciona un torneo...» quita el parámetro", async () => {
    searchParams = new URLSearchParams("torneo=t1");
    renderPage();
    await screen.findByRole("option", { name: "Open Valencia" });

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "" } });

    expect(replaceMock).toHaveBeenCalledWith("/inscripciones", { scroll: false });
  });
});

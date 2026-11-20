/**
 * Pistas + duraciones (UX-19): una pista sin duraciones guardadas no ofrece
 * huecos. La pantalla pintaba ya marcados 60 y 90 min como si lo estuvieran;
 * ahora dice que no están guardados y ofrece guardarlos.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/components/admin/header", () => ({
  Header: ({ title }: { title: string }) => <div data-testid="header">{title}</div>,
}));
vi.mock("@/lib/use-role", () => ({
  useRole: () => ({ role: "club", clubId: "c1" }),
  isClub: (r: string) => r === "club",
}));
const courtsMock = vi.hoisted(() => ({ list: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/services/admin", () => ({ adminService: { courts: courtsMock } }));

const svc = vi.hoisted(() => ({ courtDurations: { list: vi.fn(), replace: vi.fn() } }));
vi.mock("@/lib/services/bookings", async () => {
  const actual = await vi.importActual<typeof import("@/lib/services/bookings")>("@/lib/services/bookings");
  return { ...actual, bookingsService: svc };
});

import PistasPage from "../../../app/(admin)/mi-club/reservas/pistas/page";

const COURT_1 = { id: "p1", name: "Pista 1", isIndoor: false, isCentral: false, type: "DOUBLES", allowOpenMatches: true };
const COURT_2 = { id: "p2", name: "Pista 2", isIndoor: true, isCentral: false, type: "DOUBLES", allowOpenMatches: true };
const SAVED = [
  { id: "d1", courtId: "p1", minutes: 60, isDefault: false },
  { id: "d2", courtId: "p1", minutes: 90, isDefault: true },
];

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <PistasPage />
    </QueryClientProvider>,
  );
}

describe("Pistas + duraciones — pistas sin duraciones guardadas (UX-19)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    courtsMock.list.mockResolvedValue([COURT_1, COURT_2]);
    // La 1 con sus duraciones; la 2, de las de antes del alta con duraciones, sin ninguna
    svc.courtDurations.list.mockImplementation((_clubId: string, courtId: string) =>
      Promise.resolve(courtId === "p1" ? SAVED : []),
    );
    svc.courtDurations.replace.mockResolvedValue([]);
  });

  it("la tarjeta de la pista sin duraciones lo avisa aunque esté cerrada; la que las tiene, no", async () => {
    renderPage();
    expect(await screen.findByText("Sin duraciones guardadas")).toBeInTheDocument();
    expect(screen.getAllByText("Sin duraciones guardadas")).toHaveLength(1);
    // El aviso es de la pista 2
    expect(screen.getByText("Pista 2").parentElement).toHaveTextContent("Sin duraciones guardadas");
    expect(screen.getByText("Pista 1").parentElement).not.toHaveTextContent("Sin duraciones guardadas");
  });

  it("al abrirla, dice que 60 y 90 son solo una sugerencia y que no valen hasta guardarlas", async () => {
    renderPage();
    await screen.findByText("Sin duraciones guardadas");
    // Los botones de expandir salen en el orden de las pistas
    fireEvent.click(screen.getAllByRole("button", { name: "Expandir" })[1]);

    expect(await screen.findByText("Esta pista no tiene duraciones guardadas")).toBeInTheDocument();
    expect(screen.getByText(/solo una sugerencia: no valen hasta que los guardes/)).toBeInTheDocument();
    // Las dos sugeridas se ven en la lista, pero no se han guardado
    expect(screen.getByRole("cell", { name: "60 min" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "90 min" })).toBeInTheDocument();
    expect(svc.courtDurations.replace).not.toHaveBeenCalled();
  });

  it("«Guardar ahora» guarda las sugeridas (60 y 90, la de 90 por defecto) y el aviso desaparece", async () => {
    renderPage();
    await screen.findByText("Sin duraciones guardadas");
    fireEvent.click(screen.getAllByRole("button", { name: "Expandir" })[1]);
    svc.courtDurations.list.mockImplementation((_clubId: string, courtId: string) =>
      Promise.resolve(courtId === "p1" ? SAVED : [{ ...SAVED[0], id: "n1", courtId: "p2" }, { ...SAVED[1], id: "n2", courtId: "p2" }]),
    );
    fireEvent.click(await screen.findByRole("button", { name: /Guardar ahora/ }));

    await waitFor(() =>
      expect(svc.courtDurations.replace).toHaveBeenCalledWith("c1", "p2", {
        durations: [
          { minutes: 60, isDefault: false },
          { minutes: 90, isDefault: true },
        ],
      }),
    );
    await waitFor(() => expect(screen.queryByText("Sin duraciones guardadas")).not.toBeInTheDocument());
    expect(screen.queryByText("Esta pista no tiene duraciones guardadas")).not.toBeInTheDocument();
  });

  it("una pista con duraciones guardadas se abre sin aviso y con las suyas", async () => {
    courtsMock.list.mockResolvedValue([COURT_1]);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Expandir" }));

    expect(await screen.findByRole("cell", { name: "60 min" })).toBeInTheDocument();
    expect(screen.queryByText("Esta pista no tiene duraciones guardadas")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Guardar ahora/ })).not.toBeInTheDocument();
  });

  it("mientras no sabe si las tiene (cargando o error), no avisa de nada", async () => {
    courtsMock.list.mockResolvedValue([COURT_2]);
    svc.courtDurations.list.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(await screen.findByText("Pista 2")).toBeInTheDocument();
    expect(screen.queryByText("Sin duraciones guardadas")).not.toBeInTheDocument();
  });
});

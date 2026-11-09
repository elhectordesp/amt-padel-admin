/**
 * Activación + testers (R3-4): al añadir o quitar un tester, el estado del
 * módulo («Solo los N tester(s)…») se vuelve a pedir; antes seguía en 0
 * hasta recargar.
 *
 * Zona del club (B1): las fechas (apertura, fin de un tester) se enseñan y
 * se mandan en la zona del club, no en la de Madrid ni en la del navegador.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/admin/header", () => ({
  Header: ({ title }: { title: string }) => <div data-testid="header">{title}</div>,
}));
vi.mock("@/lib/use-role", () => ({
  useRole: () => ({ role: "club", clubId: "c1" }),
  isClub: (r: string) => r === "club",
}));
const clubsMock = vi.hoisted(() => ({ findOne: vi.fn() }));
vi.mock("@/lib/services/admin", () => ({
  adminService: {
    clubs: clubsMock,
    players: { search: vi.fn().mockResolvedValue([{ id: "u9", name: "Ana Tester", email: null }]) },
  },
}));

const svc = vi.hoisted(() => ({
  activation: { state: vi.fn(), request: vi.fn(), publish: vi.fn() },
  testers: { list: vi.fn(), add: vi.fn(), remove: vi.fn() },
}));
vi.mock("@/lib/services/bookings", async () => {
  const actual = await vi.importActual<typeof import("@/lib/services/bookings")>("@/lib/services/bookings");
  return { ...actual, bookingsService: svc };
});

import ActivacionPage from "../../../app/(admin)/mi-club/reservas/activacion/page";

const state = (activeTesterCount: number) => ({
  bookingEnabled: true, bookingPublicAt: null, status: "TESTER_MODE", activeTesterCount,
});
const TESTER = {
  id: "t1", clubId: "c1", userId: "u1", validUntil: "2026-11-30T10:00:00.000Z", addedAt: "", addedByUserId: null,
  user: { id: "u1", name: "Luis", email: null },
};

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ActivacionPage />
    </QueryClientProvider>,
  );
}

describe("Activación + testers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clubsMock.findOne.mockResolvedValue({ id: "c1", name: "Club Centro", timezone: "Europe/Madrid" });
  });

  it("añadir un tester actualiza el contador del estado", async () => {
    svc.activation.state.mockResolvedValueOnce(state(0)).mockResolvedValue(state(1));
    svc.testers.list.mockResolvedValueOnce([]).mockResolvedValue([TESTER]);
    svc.testers.add.mockResolvedValue(TESTER);
    renderPage();
    expect(await screen.findByText(/Solo los 0 tester\(s\)/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Añadir" }));
    fireEvent.change(screen.getByPlaceholderText(/Buscar jugador AMT/), { target: { value: "Ana" } });
    fireEvent.click(await screen.findByRole("button", { name: /Ana Tester/ }, { timeout: 2000 }));
    // El de abajo: el que añade (el de arriba abre y cierra el formulario)
    fireEvent.click(screen.getAllByRole("button", { name: "Añadir" }).at(-1)!);

    expect(await screen.findByText(/Solo los 1 tester\(s\)/)).toBeInTheDocument();
    expect(svc.testers.add).toHaveBeenCalledWith("c1", expect.objectContaining({ userId: "u9" }));
  });

  it("quitar un tester también lo actualiza", async () => {
    svc.activation.state.mockResolvedValueOnce(state(1)).mockResolvedValue(state(0));
    svc.testers.list.mockResolvedValueOnce([TESTER]).mockResolvedValue([]);
    svc.testers.remove.mockResolvedValue(undefined);
    renderPage();
    expect(await screen.findByText(/Solo los 1 tester\(s\)/)).toBeInTheDocument();

    fireEvent.click(screen.getByTitle("Eliminar"));

    await waitFor(() => expect(screen.getByText(/Solo los 0 tester\(s\)/)).toBeInTheDocument());
  });
});

describe("Activación — qué falta y solicitud pendiente (UX-21)", () => {
  const check = (code: string, ok: boolean, missing: string[] = []) => ({ code, ok, missing });
  const READY = {
    ready: true,
    checks: [
      check("COURTS", true), check("OPERATING_HOURS", true), check("COURT_DURATIONS", true), check("COURT_PRICES", true),
    ],
  };
  const INCOMPLETE = {
    ready: false,
    checks: [
      check("COURTS", true),
      check("OPERATING_HOURS", false),
      check("COURT_DURATIONS", false, ["Pista 2"]),
      check("COURT_PRICES", false, ["Pista 1 (90 min)", "Pista 2 (60 min)"]),
    ],
  };
  const inactive = (readiness: unknown, requestedAt: string | null = null) => ({
    bookingEnabled: false, bookingPublicAt: null, bookingActivationRequestedAt: requestedAt,
    status: "INACTIVE", activeTesterCount: 0, readiness,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    clubsMock.findOne.mockResolvedValue({ id: "c1", name: "Club Centro", timezone: "Europe/Madrid" });
    svc.testers.list.mockResolvedValue([]);
  });

  it("lo que falta sale en una lista, cada cosa con su enlace, y no deja solicitar", async () => {
    svc.activation.state.mockResolvedValue(inactive(INCOMPLETE));
    renderPage();

    expect(await screen.findByText("Lo que falta para que los jugadores vean huecos libres")).toBeInTheDocument();
    expect(screen.getByText("El club tiene pistas dadas de alta")).toBeInTheDocument();
    expect(screen.getByText(/Indica los días y las horas a las que abre el club/)).toBeInTheDocument();
    expect(screen.getByText(/Faltan las duraciones de: Pista 2/)).toBeInTheDocument();
    expect(screen.getByText(/Falta el precio de: Pista 1 \(90 min\), Pista 2 \(60 min\)/)).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "Ir a Horarios" })).toHaveAttribute("href", "/mi-club/reservas/horarios");
    expect(screen.getByRole("link", { name: "Ir a Pistas" })).toHaveAttribute("href", "/mi-club/reservas/pistas");
    expect(screen.getByRole("link", { name: "Ir a Precios" })).toHaveAttribute("href", "/mi-club/reservas/precios");
    // Lo que ya está hecho no pide ir a ningún sitio
    expect(screen.queryByRole("link", { name: "Ir a Mi club" })).not.toBeInTheDocument();

    expect(screen.getByRole("button", { name: /Solicitar activación/ })).toBeDisabled();
    expect(screen.getByText(/Completa los pasos pendientes/)).toBeInTheDocument();
  });

  it("sin pistas, el enlace lleva a Mi club", async () => {
    svc.activation.state.mockResolvedValue(inactive({
      ready: false,
      checks: [check("COURTS", false), check("OPERATING_HOURS", true), check("COURT_DURATIONS", true), check("COURT_PRICES", true)],
    }));
    renderPage();
    expect(await screen.findByText("Da de alta al menos una pista")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir a Mi club" })).toHaveAttribute("href", "/mi-club");
  });

  it("con todo listo lo dice, y solicitar manda la petición y vuelve a pedir el estado", async () => {
    svc.activation.state
      .mockResolvedValueOnce(inactive(READY))
      .mockResolvedValue(inactive(null, "2026-11-05T10:00:00.000Z"));
    svc.activation.request.mockResolvedValue({ notifiedAdminCount: 1 });
    renderPage();

    expect(await screen.findByText("Todo listo para que los jugadores vean huecos libres")).toBeInTheDocument();
    expect(screen.queryByText(/Completa los pasos pendientes/)).not.toBeInTheDocument();
    const button = screen.getByRole("button", { name: /Solicitar activación/ });
    expect(button).toBeEnabled();
    fireEvent.click(button);

    await waitFor(() => expect(svc.activation.request).toHaveBeenCalledWith("c1"));
    // Y la página pasa a «pendiente»: ya no deja pedirla otra vez
    expect(await screen.findByText("Solicitud enviada, pendiente de AMT")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Solicitar activación/ })).not.toBeInTheDocument();
  });

  it("con la solicitud ya enviada: «Solicitud enviada, pendiente de AMT» con su fecha, sin lista ni botón", async () => {
    svc.activation.state.mockResolvedValue(inactive(READY, "2026-11-05T10:00:00.000Z"));
    renderPage();

    expect(await screen.findByText("Solicitud enviada, pendiente de AMT")).toBeInTheDocument();
    expect(screen.getByText(/Enviada el 5\/11\/2026/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Solicitar activación/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/huecos libres/)).not.toBeInTheDocument();
  });

  it("si el back la rechaza (le falta algo), enseña su mensaje y refresca la lista", async () => {
    svc.activation.state
      .mockResolvedValueOnce(inactive(READY))
      .mockResolvedValue(inactive(INCOMPLETE));
    svc.activation.request.mockRejectedValue({
      response: { data: { message: "No se puede solicitar la activación todavía: no hay ningún día con horario de apertura." } },
    });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /Solicitar activación/ }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("horario de apertura")));
    expect(await screen.findByText(/Faltan las duraciones de: Pista 2/)).toBeInTheDocument();
  });

  it("un back sin lista (versión anterior): se puede solicitar y decide el back", async () => {
    svc.activation.state.mockResolvedValue({
      bookingEnabled: false, bookingPublicAt: null, status: "INACTIVE", activeTesterCount: 0,
    });
    renderPage();
    expect(await screen.findByRole("button", { name: /Solicitar activación/ })).toBeEnabled();
    expect(screen.queryByText(/huecos libres/)).not.toBeInTheDocument();
  });
});

describe("Activación — «Publicar al público» pide confirmación (UX-22)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clubsMock.findOne.mockResolvedValue({ id: "c1", name: "Club Centro", timezone: "Europe/Madrid" });
    svc.testers.list.mockResolvedValue([]);
    svc.activation.state.mockResolvedValue(state(2));
    svc.activation.publish.mockResolvedValue({});
  });

  it("el botón solo abre el diálogo: no publica hasta confirmar", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /Publicar al público/ }));

    const dialog = screen.getByRole("dialog", { name: "¿Publicar el club al público?" });
    expect(dialog).toHaveFocus();
    expect(dialog).toHaveTextContent("Tu club aparecerá a todos los jugadores de la app; para retirarlo tendrás que pedírselo a AMT.");
    expect(svc.activation.publish).not.toHaveBeenCalled();
  });

  it("Escape y «No, volver» lo cierran sin publicar", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /Publicar al público/ }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Publicar al público/ }));
    fireEvent.click(screen.getByRole("button", { name: "No, volver" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(svc.activation.publish).not.toHaveBeenCalled();
  });

  it("«Sí, publicar» publica, cierra el diálogo y avisa", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /Publicar al público/ }));
    fireEvent.click(screen.getByRole("button", { name: "Sí, publicar" }));

    await waitFor(() => expect(svc.activation.publish).toHaveBeenCalledWith("c1"));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(toast.success).toHaveBeenCalledWith("Club publicado");
  });

  it("si el back lo rechaza, enseña su mensaje y cierra el diálogo", async () => {
    svc.activation.publish.mockRejectedValue({ response: { data: { message: "El club ya es públicamente visible" } } });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /Publicar al público/ }));
    fireEvent.click(screen.getByRole("button", { name: "Sí, publicar" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("El club ya es públicamente visible"));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});

describe("Activación — zona del club (B1): un club en Canarias", () => {
  // El navegador, en Madrid (vitest.config): ni la zona fija de antes ni la del navegador dan lo esperado
  beforeEach(() => {
    vi.clearAllMocks();
    clubsMock.findOne.mockResolvedValue({ id: "c1", name: "Club Atlántico", timezone: "Atlantic/Canary" });
  });

  it("el fin de un tester se enseña en la hora de Canarias y el que se escribe se manda en ella", async () => {
    svc.activation.state.mockResolvedValue(state(1));
    // 23:30 del 30/11 en Canarias; en Madrid, las 00:30 del 1/12
    svc.testers.list.mockResolvedValue([{ ...TESTER, validUntil: "2026-11-30T23:30:00.000Z" }]);
    svc.testers.add.mockResolvedValue(TESTER);
    renderPage();
    expect(await screen.findByText(/Hasta 30\/11\/26, 23:30/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Añadir" }));
    fireEvent.change(screen.getByPlaceholderText(/Buscar jugador AMT/), { target: { value: "Ana" } });
    fireEvent.click(await screen.findByRole("button", { name: /Ana Tester/ }, { timeout: 2000 }));
    fireEvent.change(document.querySelector('input[type="datetime-local"]')!, { target: { value: "2026-12-01T10:00" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Añadir" }).at(-1)!);

    // Las 10:00 de Canarias en diciembre son las 10:00 UTC (en Madrid serían las 09:00)
    await waitFor(() =>
      expect(svc.testers.add).toHaveBeenCalledWith("c1", { userId: "u9", validUntil: "2026-12-01T10:00:00.000Z" }),
    );
  });

  it("la fecha de apertura al público, en el día de Canarias", async () => {
    // 23:30 del 1/10 en Canarias; en Madrid ya es el 2
    svc.activation.state.mockResolvedValue({
      bookingEnabled: true, bookingPublicAt: "2026-10-01T22:30:00.000Z", status: "PUBLIC", activeTesterCount: 0,
    });
    svc.testers.list.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText(/Activo desde 1\/10\/2026/)).toBeInTheDocument();
  });

  it("sin saber aún la zona del club no se pinta ninguna fecha", async () => {
    clubsMock.findOne.mockReturnValue(new Promise(() => {}));
    svc.activation.state.mockResolvedValue(state(1));
    svc.testers.list.mockResolvedValue([TESTER]);
    renderPage();
    await waitFor(() => expect(clubsMock.findOne).toHaveBeenCalled());
    expect(screen.queryByText(/Hasta/)).not.toBeInTheDocument();
    expect(svc.testers.list).not.toHaveBeenCalled();
  });
});

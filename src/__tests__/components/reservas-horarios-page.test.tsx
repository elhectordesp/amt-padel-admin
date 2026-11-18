/**
 * Horarios del club (R2-5): un club que cierra a medianoche lo marca con
 * «Medianoche» y se guarda «24:00» (un campo de hora no puede escribirlo, y
 * con 23:59 la última franja no se ofrecía).
 *
 * Zona del club (B1): las próximas excepciones son desde hoy en el club, y
 * su fecha (de calendario) se enseña sin zona.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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
const clubsMock = vi.hoisted(() => ({ findOne: vi.fn() }));
vi.mock("@/lib/services/admin", () => ({ adminService: { clubs: clubsMock } }));

const svc = vi.hoisted(() => ({
  operatingHours: { list: vi.fn(), replace: vi.fn() },
  exceptions: { list: vi.fn(), create: vi.fn(), remove: vi.fn() },
}));
vi.mock("@/lib/services/bookings", async () => {
  const actual = await vi.importActual<typeof import("@/lib/services/bookings")>("@/lib/services/bookings");
  return { ...actual, bookingsService: svc };
});

import HorariosPage from "../../../app/(admin)/mi-club/reservas/horarios/page";
import { ME_QUERY_KEY } from "@/lib/use-me";

const asRole = (role: string) => ({
  id: "staff", name: "Equipo", activeClubId: "c1",
  clubs: [{ clubId: "c1", clubName: "Club Centro", roles: [role] }],
});

// me: la cuenta del equipo con sus roles en el club (en la caché, como la deja el panel al entrar)
function renderPage(me?: object) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  if (me) qc.setQueryData(ME_QUERY_KEY, me);
  return render(
    <QueryClientProvider client={qc}>
      <HorariosPage />
    </QueryClientProvider>,
  );
}

describe("Horarios: cierre a medianoche", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    svc.operatingHours.list.mockResolvedValue([
      { id: "h1", clubId: "c1", dayOfWeek: 1, openTime: "09:00", closeTime: "23:00", active: true },
      { id: "h5", clubId: "c1", dayOfWeek: 5, openTime: "09:00", closeTime: "24:00", active: true },
    ]);
    svc.operatingHours.replace.mockResolvedValue([]);
    svc.exceptions.list.mockResolvedValue([]);
    svc.exceptions.create.mockResolvedValue({});
    clubsMock.findOne.mockResolvedValue({ id: "c1", name: "Club Centro", timezone: "Europe/Madrid" });
  });

  it("marcar «Medianoche» guarda el cierre como 24:00", async () => {
    renderPage();
    fireEvent.click(await screen.findByLabelText("Cierra a medianoche (Lunes)"));
    expect(screen.queryByLabelText("Cierre de Lunes")).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: /Guardar/ })[0]);

    await waitFor(() =>
      expect(svc.operatingHours.replace).toHaveBeenCalledWith("c1", {
        hours: [
          { dayOfWeek: 1, openTime: "09:00", closeTime: "24:00", active: true },
          { dayOfWeek: 5, openTime: "09:00", closeTime: "24:00", active: true },
        ],
      }),
    );
  });

  it("un día guardado a medianoche sale marcado; desmarcarlo vuelve a una hora", async () => {
    renderPage();
    const friday = await screen.findByLabelText("Cierra a medianoche (Viernes)");
    expect(friday).toBeChecked();
    fireEvent.click(friday);
    expect(screen.getByLabelText("Cierre de Viernes")).toHaveValue("23:00");
  });

  it("una excepción también puede cerrar a medianoche", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /Añadir/ }));
    fireEvent.click(screen.getByLabelText("Cierra a medianoche (la excepción)"));
    fireEvent.click(screen.getAllByRole("button", { name: "Guardar" }).at(-1)!);

    await waitFor(() =>
      expect(svc.exceptions.create).toHaveBeenCalledWith("c1", expect.objectContaining({ customClose: "24:00" })),
    );
  });

  it("un cierre enseña las clases de la escuela que quedan fuera del horario, sin cancelarlas", async () => {
    svc.exceptions.create.mockResolvedValue({
      id: "e1",
      affectedSchoolClasses: [
        {
          kind: "GROUP",
          id: "ses1",
          name: "Iniciación",
          startsAt: "2026-12-25T17:00:00.000Z",
          endsAt: "2026-12-25T18:00:00.000Z",
        },
        {
          kind: "PRIVATE",
          id: "pc1",
          name: "Clase privada",
          startsAt: "2026-12-25T09:00:00.000Z",
          endsAt: "2026-12-25T10:00:00.000Z",
        },
      ],
    });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /Añadir/ }));
    fireEvent.click(screen.getAllByRole("button", { name: "Guardar" }).at(-1)!);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("2 clases de la escuela quedan fuera del horario");
    expect(alert).toHaveTextContent("Iniciación");
    expect(alert).toHaveTextContent("Clase privada");
    expect(alert).toHaveTextContent("No se han cancelado ni movido");
    fireEvent.click(screen.getByRole("button", { name: "Entendido" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("sin clases afectadas no hay aviso", async () => {
    svc.exceptions.create.mockResolvedValue({ id: "e1", affectedSchoolClasses: [] });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /Añadir/ }));
    fireEvent.click(screen.getAllByRole("button", { name: "Guardar" }).at(-1)!);
    await waitFor(() => expect(svc.exceptions.create).toHaveBeenCalled());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("un festivo puede cobrarse como otro día de la semana", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /Añadir/ }));
    fireEvent.change(screen.getByLabelText(/Se cobra como/), { target: { value: "7" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Guardar" }).at(-1)!);

    await waitFor(() =>
      expect(svc.exceptions.create).toHaveBeenCalledWith("c1", expect.objectContaining({ priceAsDayOfWeek: 7 })),
    );
  });

  it("sin elegir «se cobra como», no se manda", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /Añadir/ }));
    fireEvent.click(screen.getAllByRole("button", { name: "Guardar" }).at(-1)!);

    await waitFor(() => expect(svc.exceptions.create).toHaveBeenCalled());
    expect(svc.exceptions.create.mock.calls[0][1].priceAsDayOfWeek).toBeUndefined();
  });
});

describe("Horarios — zona del club (B1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Solo el reloj: los temporizadores siguen siendo los de verdad (findBy, React Query)
    vi.useFakeTimers({ toFake: ["Date"] });
    // 23:30 del 28/10 en Canarias; en Madrid, las 00:30 del 29, y en UTC aún el 28
    vi.setSystemTime(new Date("2026-10-28T23:30:00.000Z"));
    svc.operatingHours.list.mockResolvedValue([]);
    svc.exceptions.list.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("las próximas excepciones son desde hoy en el club (Canarias), y la nueva abre en ese día", async () => {
    clubsMock.findOne.mockResolvedValue({ id: "c1", name: "Club Atlántico", timezone: "Atlantic/Canary" });
    renderPage();
    await waitFor(() => expect(svc.exceptions.list).toHaveBeenCalledWith("c1", { fromDate: "2026-10-28" }));

    fireEvent.click(await screen.findByRole("button", { name: /Añadir/ }));
    expect(screen.getByDisplayValue("2026-10-28")).toHaveAttribute("type", "date");
  });

  it("en un club de Madrid, ya es el 29 (antes salía el día UTC)", async () => {
    clubsMock.findOne.mockResolvedValue({ id: "c1", name: "Club Centro", timezone: "Europe/Madrid" });
    renderPage();
    await waitFor(() => expect(svc.exceptions.list).toHaveBeenCalledWith("c1", { fromDate: "2026-10-29" }));
  });

  it("cada excepción sale en su día, también con el navegador al oeste de UTC (antes, el día anterior)", async () => {
    const browserTz = process.env.TZ;
    process.env.TZ = "America/New_York";
    try {
      clubsMock.findOne.mockResolvedValue({ id: "c1", name: "Club Centro", timezone: "Europe/Madrid" });
      // Como «YYYY-MM-DD» y como la medianoche UTC de ese día
      svc.exceptions.list.mockResolvedValue([
        { id: "e1", clubId: "c1", date: "2026-11-20", isClosed: true, customOpen: null, customClose: null, reason: null },
        { id: "e2", clubId: "c1", date: "2026-12-08T00:00:00.000Z", isClosed: true, customOpen: null, customClose: null, reason: null },
      ]);
      renderPage();
      expect(await screen.findByText("vie, 20 nov 2026")).toBeInTheDocument();
      expect(screen.getByText("mar, 8 dic 2026")).toBeInTheDocument();
      expect(screen.queryByText(/19 nov|7 dic/)).not.toBeInTheDocument();
    } finally {
      process.env.TZ = browserTz;
    }
  });

  describe("con un rol de solo lectura (Recepción lee la configuración)", () => {
    beforeEach(() => {
      svc.exceptions.list.mockResolvedValue([
        { id: "e1", clubId: "c1", date: "2026-11-20", isClosed: true, customOpen: null, customClose: null, reason: "Festivo" },
      ]);
    });

    it("ve el horario y las excepciones, sin «Guardar», «Aplicar a todos», «Añadir» ni borrar", async () => {
      renderPage(asRole("RECEPTION"));
      expect(await screen.findByText("vie, 20 nov 2026")).toBeInTheDocument();
      expect(screen.getByText("Lunes")).toBeInTheDocument();
      for (const name of [/Guardar/, /Aplicar a todos/, /Añadir/, /Eliminar excepción/]) {
        expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
      }
      // El horario se lee, no se cambia
      expect(screen.getByLabelText("Cierre de Lunes")).toBeDisabled();
    });

    it("con escritura (Propietario) están todos esos botones", async () => {
      renderPage(asRole("OWNER"));
      expect(await screen.findByText("vie, 20 nov 2026")).toBeInTheDocument();
      for (const name of [/Guardar/, /Aplicar a todos/, /Añadir/, /Eliminar excepción/]) {
        expect(screen.getByRole("button", { name })).toBeInTheDocument();
      }
    });
  });
});

/**
 * Calendario de reservas del club (P12): vista «Día» por horas y pistas en
 * hora del club. Pulsar un hueco libre abre el alta con la pista y la hora
 * ya elegidas; la reserva sale en su franja con los jugadores que siguen en
 * ella (R3-3); la vista «Semana» sigue disponible.
 *
 * Hoy es el domingo 25/10/2026 (cambio de hora) a las 11:00 de Madrid y el
 * navegador está en Canarias: lo esperado va en literales, así que volver a
 * la hora del navegador haría fallar los tests.
 *
 * Recepción (B2): se actualiza sola, marca la hora actual solo hoy, filtra
 * mañana/tarde con `?franja=`, navega por fechas y tiene modo mostrador.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// La URL como la lleva Next: history.replaceState cambia lo que lee useSearchParams
const url = vi.hoisted(() => {
  let params = new URLSearchParams();
  const listeners = new Set<() => void>();
  return {
    get: () => params,
    set(search: string) {
      params = new URLSearchParams(search);
      listeners.forEach((l) => l());
    },
    subscribe(l: () => void) {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
  };
});
vi.mock("next/navigation", async () => {
  const { useSyncExternalStore } = await import("react");
  return { useSearchParams: () => useSyncExternalStore(url.subscribe, url.get) };
});

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/components/admin/header", () => ({
  Header: ({ title }: { title: string }) => <div data-testid="header">{title}</div>,
}));
vi.mock("@/lib/use-role", () => ({
  useRole: () => ({ role: "club", clubId: "c1" }),
  isClub: (r: string) => r === "club",
}));

const courtsMock = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("@/lib/services/admin", () => ({
  adminService: { courts: courtsMock, players: { search: vi.fn() } },
}));

const svc = vi.hoisted(() => ({
  operatingHours: { list: vi.fn() },
  exceptions: { list: vi.fn() },
  bookings: { listAll: vi.fn(), create: vi.fn() },
  courtDurations: { list: vi.fn() },
  availability: vi.fn(),
}));
vi.mock("@/lib/services/bookings", async () => {
  const actual = await vi.importActual<typeof import("@/lib/services/bookings")>("@/lib/services/bookings");
  return { ...actual, bookingsService: svc };
});

import CalendarioPage from "../../../app/(admin)/mi-club/reservas/calendario/page";

const COURTS = [
  { id: "p1", clubId: "c1", name: "Pista 1", isIndoor: false, isCentral: false, order: 1, active: true, type: "DOUBLES" },
  { id: "p2", clubId: "c1", name: "Pista 2", isIndoor: false, isCentral: false, order: 2, active: true, type: "DOUBLES" },
];

// Huecos libres de la Pista 2 el 25/10: 17:30 y 18:00 en Madrid (ya en horario de invierno)
const SLOTS = [
  { t: "17:30", iso: "2026-10-25T16:30:00.000Z" },
  { t: "18:00", iso: "2026-10-25T17:00:00.000Z" },
].map(({ t, iso }) => ({
  courtId: "p2", courtName: "Pista 2", courtType: "DOUBLES", isIndoor: false,
  startsAt: iso, endsAt: iso, startsAtLocal: t, durationMinutes: 90,
  priceCents: 2000, priceBreakdown: { slot: 2000, extras: [] },
}));

const booking = (over: object) => ({
  id: "b1", shortCode: "AMT-1", clubId: "c1", courtId: "p1", matchMode: "PRIVATE_AMT", status: "CONFIRMED",
  startsAt: "2026-10-25T17:00:00.000Z", endsAt: "2026-10-25T18:30:00.000Z", durationMinutes: 90,
  participants: [],
  ...over,
});

// staleTime: el del panel (components/providers.tsx) cuando lo que se prueba es cuándo se vuelve a pedir
function renderPage({ staleTime = 0 }: { staleTime?: number } = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime } } });
  return render(
    <QueryClientProvider client={qc}>
      <CalendarioPage />
    </QueryClientProvider>,
  );
}

const NOW = new Date("2026-10-25T10:00:00.000Z"); // 11:00 en Madrid
const browserTz = process.env.TZ;
const realReplaceState = window.history.replaceState.bind(window.history);

beforeAll(() => {
  // Solo el reloj: los temporizadores siguen siendo los de verdad (findBy, React Query)
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  process.env.TZ = "Atlantic/Canary";
});

afterAll(() => {
  process.env.TZ = browserTz;
  vi.useRealTimers();
});

beforeEach(() => {
  vi.clearAllMocks();
  url.set("");
  vi.spyOn(window.history, "replaceState").mockImplementation((data, unused, href) => {
    realReplaceState(data, unused, href);
    url.set(window.location.search);
  });
  courtsMock.list.mockResolvedValue(COURTS);
  // Abierto todos los días de 09:00 a 23:00
  svc.operatingHours.list.mockResolvedValue(
    [1, 2, 3, 4, 5, 6, 7].map((d) => ({ id: `h${d}`, clubId: "c1", dayOfWeek: d, openTime: "09:00", closeTime: "23:00", active: true })),
  );
  svc.exceptions.list.mockResolvedValue([]);
  svc.bookings.listAll.mockResolvedValue([]);
  svc.courtDurations.list.mockResolvedValue([{ id: "d1", courtId: "p2", minutes: 90, isDefault: true }]);
  svc.availability.mockResolvedValue(SLOTS);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Calendario de reservas — vista Día", () => {
  it("pide las reservas del día del club: de las 00:00 a las 23:59:59.999 de Madrid", async () => {
    renderPage();
    await screen.findByRole("button", { name: "Crear reserva en Pista 1 a las 09:00" });
    expect(svc.bookings.listAll).toHaveBeenCalledWith({
      clubId: "c1",
      fromDate: "2026-10-24T22:00:00.000Z",
      toDate: "2026-10-25T22:59:59.999Z",
    });
    expect(svc.exceptions.list).toHaveBeenCalledWith("c1", { fromDate: "2026-10-25", toDate: "2026-10-25" });
  });

  it("pulsar un hueco libre abre el alta con esa pista y esa hora", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Crear reserva en Pista 2 a las 18:00" }));

    expect(await screen.findByText("Crear reserva", { selector: "h2" })).toBeInTheDocument();
    expect(await screen.findByDisplayValue("Pista 2")).toHaveValue("p2");
    // «Fecha» es la del alta; la de la barra del día es «Elegir fecha»
    expect(screen.getByLabelText("Fecha")).toHaveValue("2026-10-25");
    expect(screen.getByLabelText("Fecha")).toHaveAttribute("type", "date");
    // La hora llega elegida cuando se cargan los huecos libres
    expect(await screen.findByDisplayValue("18:00")).toHaveValue("2026-10-25T17:00:00.000Z");
    await waitFor(() => expect(screen.getByRole("button", { name: "Crear reserva" })).toBeEnabled());
  });

  it("si a esa hora no cabe la duración, el alta lo dice en vez de dejar la hora en blanco", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Crear reserva en Pista 2 a las 22:30" }));

    expect(await screen.findByRole("status")).toHaveTextContent("A las 22:30 no hay hueco de 90 min en Pista 2.");
    expect(screen.getByDisplayValue("— elige una hora —")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crear reserva" })).toBeDisabled();
  });

  it("la reserva sale en su franja, con los jugadores que siguen en ella", async () => {
    svc.bookings.listAll.mockResolvedValue([
      booking({
        participants: [
          { id: "x1", userId: "u1", status: "ACCEPTED" },
          { id: "x2", userId: "u2", status: "ACCEPTED" },
          { id: "x3", userId: "u3", status: "DECLINED" },
          { id: "x4", userId: "u4", status: "REMOVED" },
        ],
      }),
    ]);
    renderPage();

    const block = await screen.findByRole("link", { name: /18:00–19:30/ });
    expect(block).toHaveAttribute("href", "/mi-club/reservas/bookings/b1");
    expect(within(block).getByText("2 jug.")).toBeInTheDocument();
    // Las franjas que ocupa ya no se ofrecen
    expect(screen.queryByRole("button", { name: "Crear reserva en Pista 1 a las 18:30" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crear reserva en Pista 2 a las 18:30" })).toBeInTheDocument();
  });

  it("el bloque se estira a todas sus franjas (con h-full medían igual 60 y 90 min)", async () => {
    svc.bookings.listAll.mockResolvedValue([booking({})]);
    renderPage();

    const block = await screen.findByRole("link", { name: /18:00–19:30/ });
    const cell = block.closest("td")!;
    expect(cell).toHaveAttribute("rowspan", "3");
    // jsdom no calcula alturas: se comprueba la maqueta que las da (medida en Chromium)
    expect(cell).toHaveClass("relative");
    expect(block).toHaveClass("absolute", "inset-0.5");
    expect(block).not.toHaveClass("h-full");
  });

  it("el «+» de los huecos libres se ve siempre, no solo con el ratón encima", async () => {
    renderPage();
    const slot = await screen.findByRole("button", { name: "Crear reserva en Pista 1 a las 09:00" });
    expect(within(slot).getByText("+")).not.toHaveClass("opacity-0");
  });

  it("el día va con solo la primera letra en mayúscula", async () => {
    renderPage();
    expect(await screen.findByText("Domingo, 25 oct")).toBeInTheDocument();
  });

  it("el contacto solo es la etiqueta en una reserva por teléfono; si no, un invitado es un jugador más", async () => {
    const guests = [
      { id: "x1", userId: "u1", status: "ACCEPTED" },
      { id: "x2", userId: "u2", status: "ACCEPTED" },
      { id: "x3", userId: null, guestName: "Juan", status: "AUTO_ACCEPTED" },
    ];
    svc.bookings.listAll.mockResolvedValue([
      booking({ id: "conInvitado", matchMode: "PRIVATE_WITH_GUESTS", participants: guests }),
      booking({
        id: "telefono", courtId: "p2", matchMode: "ADMIN_MANUAL",
        participants: [{ id: "y1", userId: null, guestName: "Marta 600 000 000", status: "AUTO_ACCEPTED" }],
      }),
    ]);
    renderPage();

    const [p1Block, p2Block] = await screen.findAllByRole("link", { name: /18:00–19:30/ });
    expect(within(p1Block).getByText("3 jug.")).toBeInTheDocument();
    expect(within(p1Block).queryByText("Juan")).not.toBeInTheDocument();
    expect(within(p2Block).getByText("Marta 600 000 000")).toBeInTheDocument();
  });

  it("un día cerrado por excepción lo dice", async () => {
    svc.exceptions.list.mockResolvedValue([
      { id: "e1", clubId: "c1", date: "2026-10-25T00:00:00.000Z", isClosed: true, customOpen: null, customClose: null, reason: null },
    ]);
    renderPage();
    expect(await screen.findByText("El club está cerrado este día.")).toBeInTheDocument();
  });

  it("si fallan las pistas es un fallo de carga, no «Sin pistas activas»", async () => {
    courtsMock.list.mockRejectedValue(new Error("500"));
    renderPage();
    expect(await screen.findByText("No se pudo cargar el día. Vuelve a intentarlo.")).toBeInTheDocument();
    expect(screen.queryByText(/Sin pistas activas/)).not.toBeInTheDocument();
  });
});

describe("Calendario de reservas — vista Semana", () => {
  it("pide de lunes a domingo del club y pone cada reserva en su día de Madrid", async () => {
    // Domingo a las 23:30 de Madrid, y una cancelada que se ve pero no cuenta
    svc.bookings.listAll.mockResolvedValue([
      booking({ id: "tarde", startsAt: "2026-10-25T22:30:00.000Z", endsAt: "2026-10-25T23:30:00.000Z", durationMinutes: 60 }),
      booking({ id: "anulada", status: "CANCELLED", startsAt: "2026-10-21T17:00:00.000Z", endsAt: "2026-10-21T18:30:00.000Z" }),
    ]);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Semana" }));

    expect(await screen.findByRole("columnheader", { name: "Pista" })).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader")).toHaveLength(8);
    expect(svc.bookings.listAll).toHaveBeenLastCalledWith({
      clubId: "c1",
      fromDate: "2026-10-18T22:00:00.000Z",
      toDate: "2026-10-25T22:59:59.999Z",
    });
    expect(screen.getByText("1 reserva esta semana")).toBeInTheDocument();
    const sunday = within(screen.getByRole("row", { name: /^Pista 1/ })).getAllByRole("cell")[7];
    expect(within(sunday).getByText("23:30")).toBeInTheDocument();
  });

  it("si fallan las pistas es un fallo de carga, no «Sin pistas activas»", async () => {
    courtsMock.list.mockRejectedValue(new Error("500"));
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Semana" }));
    expect(await screen.findByText("No se pudo cargar la semana. Vuelve a intentarlo.")).toBeInTheDocument();
    expect(screen.queryByText(/Sin pistas activas/)).not.toBeInTheDocument();
  });
});

const firstSlot = () => screen.findByRole("button", { name: "Crear reserva en Pista 1 a las 09:00" });

describe("Recepción — navegar por fechas", () => {
  it("día siguiente y anterior piden ese día del club; «Hoy» solo sale fuera de hoy y vuelve", async () => {
    renderPage();
    await firstSlot();
    expect(screen.queryByRole("button", { name: "Hoy" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Día siguiente" }));
    expect(await screen.findByText("Lunes, 26 oct")).toBeInTheDocument();
    expect(svc.bookings.listAll).toHaveBeenLastCalledWith({
      clubId: "c1",
      fromDate: "2026-10-25T23:00:00.000Z",
      toDate: "2026-10-26T22:59:59.999Z",
    });

    fireEvent.click(screen.getByRole("button", { name: "Hoy" }));
    expect(await screen.findByText("Domingo, 25 oct")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Hoy" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Día anterior" }));
    expect(await screen.findByText("Sábado, 24 oct")).toBeInTheDocument();
    expect(svc.bookings.listAll).toHaveBeenLastCalledWith({
      clubId: "c1",
      fromDate: "2026-10-23T22:00:00.000Z",
      toDate: "2026-10-24T21:59:59.999Z",
    });
  });

  it("el selector de fecha lleva a ese día, con su horario y sus reservas", async () => {
    renderPage();
    await firstSlot();
    const picker = screen.getByLabelText("Elegir fecha");
    expect(picker).toHaveValue("2026-10-25");

    fireEvent.change(picker, { target: { value: "2026-11-03" } });

    expect(await screen.findByText("Martes, 3 nov")).toBeInTheDocument();
    expect(picker).toHaveValue("2026-11-03");
    expect(svc.bookings.listAll).toHaveBeenLastCalledWith({
      clubId: "c1",
      fromDate: "2026-11-02T23:00:00.000Z",
      toDate: "2026-11-03T22:59:59.999Z",
    });
    expect(svc.exceptions.list).toHaveBeenLastCalledWith("c1", { fromDate: "2026-11-03", toDate: "2026-11-03" });
    expect(screen.getByRole("button", { name: "Hoy" })).toBeInTheDocument();
  });
});

describe("Recepción — hora actual", () => {
  it("hoy, una línea en la franja de la hora del club (11:00 en Madrid, aunque el navegador esté en Canarias)", async () => {
    renderPage();
    const line = await screen.findByRole("separator", { name: "Hora actual, 11:00" });
    expect(line.closest("td")).toHaveTextContent("11:00");
    expect(line).toHaveStyle({ top: "0%" });
  });

  it("otro día no hay línea", async () => {
    renderPage();
    await screen.findByRole("separator", { name: "Hora actual, 11:00" });

    fireEvent.click(screen.getByRole("button", { name: "Día siguiente" }));
    await screen.findByText("Lunes, 26 oct");
    await firstSlot();
    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
  });
});

describe("Recepción — franja mañana / tarde", () => {
  it("sin ?franja= se ve el día entero", async () => {
    renderPage();
    await firstSlot();
    expect(screen.getByRole("button", { name: "Todo", pressed: true })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crear reserva en Pista 1 a las 22:30" })).toBeInTheDocument();
  });

  it("con ?franja=tarde abre la tarde: desde las 15:00", async () => {
    url.set("franja=tarde");
    renderPage();
    expect(await screen.findByRole("button", { name: "Crear reserva en Pista 1 a las 15:00" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tarde", pressed: true })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Crear reserva en Pista 1 a las 14:30" })).not.toBeInTheDocument();
  });

  it("elegir «Mañana» la deja en la URL y enseña solo hasta las 14:30; «Todo» quita el parámetro", async () => {
    renderPage();
    await firstSlot();

    fireEvent.click(screen.getByRole("button", { name: "Mañana" }));

    expect(window.history.replaceState).toHaveBeenLastCalledWith(null, "", "/mi-club/reservas/calendario?franja=manana");
    expect(await screen.findByRole("button", { name: "Mañana", pressed: true })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crear reserva en Pista 1 a las 14:30" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Crear reserva en Pista 1 a las 15:00" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Todo" }));

    expect(window.history.replaceState).toHaveBeenLastCalledWith(null, "", "/mi-club/reservas/calendario");
    expect(await screen.findByRole("button", { name: "Crear reserva en Pista 1 a las 15:00" })).toBeInTheDocument();
  });

  it("una reserva que cruza las 15:00 sale por la tarde desde la primera fila", async () => {
    // De 14:00 a 15:30 en Madrid
    svc.bookings.listAll.mockResolvedValue([
      booking({ startsAt: "2026-10-25T13:00:00.000Z", endsAt: "2026-10-25T14:30:00.000Z" }),
    ]);
    url.set("franja=tarde");
    renderPage();

    const block = await screen.findByRole("link", { name: /14:00–15:30/ });
    expect(block.closest("td")).toHaveAttribute("rowspan", "1");
    expect(within(block.closest("tr")!).getByText("15:00")).toBeInTheDocument();
  });
});

describe("Recepción — modo mostrador", () => {
  let fullscreenElement: Element | null;

  const dayView = () => screen.getByRole("table").closest("div.fixed");

  function installFullscreenApi() {
    fullscreenElement = null;
    const change = () => document.dispatchEvent(new Event("fullscreenchange"));
    Object.defineProperty(document, "fullscreenEnabled", { configurable: true, value: true });
    Object.defineProperty(document, "fullscreenElement", { configurable: true, get: () => fullscreenElement });
    const exitFullscreen = vi.fn(async () => {
      fullscreenElement = null;
      change();
    });
    Object.defineProperty(document, "exitFullscreen", { configurable: true, value: exitFullscreen });
    // Se instala en documentElement: pasa a pantalla completa él (con qué `this` se llama, lo mira el test)
    const requestFullscreen = vi.fn(async () => {
      fullscreenElement = document.documentElement;
      change();
    });
    Object.defineProperty(document.documentElement, "requestFullscreen", { configurable: true, value: requestFullscreen });
    return { requestFullscreen, exitFullscreen };
  }

  afterEach(() => {
    for (const key of ["fullscreenEnabled", "fullscreenElement", "exitFullscreen"]) Reflect.deleteProperty(document, key);
    Reflect.deleteProperty(document.documentElement, "requestFullscreen");
  });

  it("con la Fullscreen API: pide la pantalla completa del documento y la vista del día lo tapa todo", async () => {
    const api = installFullscreenApi();
    renderPage();
    await firstSlot();
    expect(dayView()).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Modo mostrador" }));

    expect(api.requestFullscreen).toHaveBeenCalledTimes(1);
    expect(api.requestFullscreen.mock.contexts[0]).toBe(document.documentElement);
    expect(dayView()).toHaveClass("fixed", "inset-0", "z-50");
    expect(await screen.findByRole("button", { name: "Salir del modo mostrador" })).toBeInTheDocument();
  });

  it("con la Fullscreen API: Esc (el navegador cierra la pantalla completa) saca del modo", async () => {
    installFullscreenApi();
    renderPage();
    await firstSlot();
    fireEvent.click(screen.getByRole("button", { name: "Modo mostrador" }));
    await waitFor(() => expect(document.fullscreenElement).toBe(document.documentElement));

    act(() => {
      fullscreenElement = null;
      document.dispatchEvent(new Event("fullscreenchange"));
    });

    expect(await screen.findByRole("button", { name: "Modo mostrador" })).toBeInTheDocument();
    expect(dayView()).toBeNull();
  });

  it("con la Fullscreen API: el botón sale del modo y de la pantalla completa", async () => {
    const api = installFullscreenApi();
    renderPage();
    await firstSlot();
    fireEvent.click(screen.getByRole("button", { name: "Modo mostrador" }));
    await waitFor(() => expect(document.fullscreenElement).toBe(document.documentElement));

    fireEvent.click(screen.getByRole("button", { name: "Salir del modo mostrador" }));

    expect(api.exitFullscreen).toHaveBeenCalledTimes(1);
    expect(dayView()).toBeNull();
    expect(document.fullscreenElement).toBeNull();
  });

  it("sin la Fullscreen API: el modo funciona igual (tapa la barra lateral) y se sale con Esc o con el botón", async () => {
    expect(document.fullscreenEnabled).toBeFalsy();
    renderPage();
    await firstSlot();

    fireEvent.click(screen.getByRole("button", { name: "Modo mostrador" }));
    expect(dayView()).toHaveClass("fixed", "inset-0", "z-50");

    fireEvent.keyDown(window, { key: "Escape" });
    expect(dayView()).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Modo mostrador" }));
    fireEvent.click(screen.getByRole("button", { name: "Salir del modo mostrador" }));
    expect(dayView()).toBeNull();
  });

  it("para el dedo: huecos y botones de 44 px, la columna de horas fija y la de pistas arriba", async () => {
    renderPage();
    const slot = await firstSlot();
    expect(slot).toHaveClass("h-7");
    // Fuera del modo, la cabecera de pistas no se pega arriba (taparía la del panel)
    expect(screen.getByRole("columnheader", { name: "Pista 1" })).not.toHaveClass("sticky");

    fireEvent.click(screen.getByRole("button", { name: "Modo mostrador" }));

    expect(slot).toHaveClass("h-11");
    expect(screen.getByRole("button", { name: "Día anterior" })).toHaveClass("size-11");
    expect(screen.getByRole("button", { name: "Tarde" })).toHaveClass("min-h-11");
    expect(screen.getByRole("button", { name: "Salir del modo mostrador" })).toHaveClass("h-11");
    expect(screen.getByRole("columnheader", { name: "Hora" })).toHaveClass("sticky", "left-0", "top-0");
    expect(screen.getByText("09:00").closest("td")).toHaveClass("sticky", "left-0");
    expect(screen.getByRole("columnheader", { name: "Pista 1" })).toHaveClass("sticky", "top-0");
  });
});

describe("Recepción — se actualiza sola", () => {
  // Aquí también los temporizadores son falsos (y avanzan con el tiempo real, para findBy)
  beforeEach(() => {
    vi.useRealTimers();
    vi.useFakeTimers({
      toFake: ["Date", "setTimeout", "clearTimeout", "setInterval", "clearInterval"],
      shouldAdvanceTime: true,
    });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    Reflect.deleteProperty(document, "visibilityState");
  });

  function setVisibility(state: DocumentVisibilityState) {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange", { bubbles: true }));
    });
  }

  it("cada 60 s vuelve a pedir el día sin quitar la rejilla (ni su scroll)", async () => {
    renderPage({ staleTime: 30_000 });
    await firstSlot();
    const table = screen.getByRole("table");
    expect(svc.bookings.listAll).toHaveBeenCalledTimes(1);
    svc.bookings.listAll.mockResolvedValue([booking({})]);

    await act(() => vi.advanceTimersByTimeAsync(55_000));
    expect(svc.bookings.listAll).toHaveBeenCalledTimes(1);

    await act(() => vi.advanceTimersByTimeAsync(5_000));
    expect(await screen.findByRole("link", { name: /18:00–19:30/ })).toBeInTheDocument();
    expect(svc.bookings.listAll).toHaveBeenCalledTimes(2);
    // La misma tabla: no se cambió por «cargando» mientras llegaba lo nuevo
    expect(screen.getByRole("table")).toBe(table);
  });

  it("al volver a la pestaña lo pide otra vez, aunque lo último tenga menos de 30 s", async () => {
    renderPage({ staleTime: 30_000 });
    await firstSlot();
    expect(svc.bookings.listAll).toHaveBeenCalledTimes(1);

    setVisibility("hidden");
    await act(() => vi.advanceTimersByTimeAsync(5_000));
    setVisibility("visible");

    await waitFor(() => expect(svc.bookings.listAll).toHaveBeenCalledTimes(2));
  });

  it("si falla un refresco, se sigue viendo la rejilla con un aviso", async () => {
    renderPage({ staleTime: 30_000 });
    await firstSlot();
    const table = screen.getByRole("table");
    svc.bookings.listAll.mockRejectedValue(new Error("500"));

    await act(() => vi.advanceTimersByTimeAsync(60_000));

    expect(await screen.findByText(/No se pudo actualizar el día/)).toBeInTheDocument();
    expect(screen.getByRole("table")).toBe(table);
    expect(screen.queryByText("No se pudo cargar el día. Vuelve a intentarlo.")).not.toBeInTheDocument();
  });

  it.each([
    ["los horarios", svc.operatingHours.list],
    ["las excepciones del día", svc.exceptions.list],
    ["las pistas", courtsMock.list],
  ])("si falla el refresco de %s (la tablet vuelve del reposo), se sigue viendo la rejilla con el aviso", async (_, list) => {
    renderPage({ staleTime: 30_000 });
    await firstSlot();
    const table = screen.getByRole("table");
    list.mockRejectedValue(new Error("500"));

    // Ya viejos: al volver a la pestaña se vuelven a pedir
    await act(() => vi.advanceTimersByTimeAsync(31_000));
    setVisibility("hidden");
    setVisibility("visible");

    expect(await screen.findByText(/No se pudo actualizar el día/)).toBeInTheDocument();
    expect(list).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("table")).toBe(table);
    expect(screen.queryByText("No se pudo cargar el día. Vuelve a intentarlo.")).not.toBeInTheDocument();
  });

  it("en la semana, si falla un refresco, se sigue viendo la semana con un aviso", async () => {
    renderPage({ staleTime: 30_000 });
    fireEvent.click(await screen.findByRole("button", { name: "Semana" }));
    await screen.findByRole("columnheader", { name: "Pista" });
    const table = screen.getByRole("table");
    svc.bookings.listAll.mockRejectedValue(new Error("500"));

    await act(() => vi.advanceTimersByTimeAsync(31_000));
    setVisibility("hidden");
    setVisibility("visible");

    expect(await screen.findByText(/No se pudo actualizar la semana/)).toBeInTheDocument();
    expect(screen.getByRole("table")).toBe(table);
    expect(screen.queryByText("No se pudo cargar la semana. Vuelve a intentarlo.")).not.toBeInTheDocument();
  });

  it("la línea de la hora avanza sola", async () => {
    renderPage();
    expect(await screen.findByRole("separator", { name: "Hora actual, 11:00" })).toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(15 * 60_000 + 10_000));

    const line = screen.getByRole("separator", { name: "Hora actual, 11:15" });
    expect(line).toHaveStyle({ top: "50%" });
  });
});

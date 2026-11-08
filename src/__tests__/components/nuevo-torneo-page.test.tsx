/**
 * Crear torneo de un club de Canarias (P8): la zona por defecto es la del
 * club, y el cierre escrito se manda en ella, no en la del navegador (los
 * tests corren en Europe/Madrid).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/lib/use-role", () => ({
  useRole: () => ({ role: "club", clubId: "club-1" }),
  isClub: () => true,
}));
vi.mock("@/components/admin/header", () => ({ Header: () => null }));
vi.mock("@/components/admin/tournament-image-uploader", () => ({ TournamentImageUploader: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const create = vi.fn().mockResolvedValue({ id: "t-new" });
// Las opciones de un club sin guardar: los de siempre (lo que da el back)
const DEFAULT_CONFIG = {
  id: "__pending__",
  clubId: "club-1",
  format: "eliminatoria",
  matchDuration: 60,
  hasShirts: false,
  useSeeding: false,
  requirePaymentToConfirm: false,
  categoryPrice: 25,
  categorySpots: 32,
  dayStartTime: "16:00",
  dayEndTime: "21:00",
  maxUnavailableTotalHours: 0,
  description: null as string | null,
  rules: null as string | null,
  participantsVisibility: "PUBLIC",
  showClubInsteadOfCourt: false,
  hideFromAppAfterDays: null as number | null,
};
const getConfig = vi.fn(async (clubId: string) => ({ ...DEFAULT_CONFIG, clubId }));
vi.mock("@/lib/services/admin", async () => {
  const actual = await vi.importActual<typeof import("@/lib/services/admin")>("@/lib/services/admin");
  return {
    ...actual,
    adminService: {
      tournaments: { create: (...args: unknown[]) => create(...args) },
      clubs: {
        list: vi.fn(async () => []),
        findOne: vi.fn(async () => ({
          id: "club-1",
          name: "Club Las Palmas",
          city: "Las Palmas",
          timezone: "Atlantic/Canary",
        })),
      },
      clubTournamentConfig: { get: (clubId: string) => getConfig(clubId) },
    },
  };
});

import NuevoTorneoPage from "../../../app/(admin)/torneos/nuevo/page";

const input = (name: string) => document.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
// Cada paso valida y vuelve a pintar el asistente: con toda la suite a la
// vez y la máquina cargada puede tardar varios segundos
const WAIT = { timeout: 15000 };
// Cada test recorre el asistente entero: más margen que los 5 s por defecto
vi.setConfig({ testTimeout: 60_000 });
const next = () => fireEvent.click(screen.getByRole("button", { name: /Siguiente|Crear torneo/ }));

describe("Crear torneo — zona del club y cierre en ella", () => {
  it("club de Canarias: zona Canarias por defecto y las 20:00 del cierre en noviembre son las 20:00 UTC", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <NuevoTorneoPage />
      </QueryClientProvider>,
    );

    // Paso 1: información (el club es el del usuario)
    await screen.findByDisplayValue("Club Las Palmas — Las Palmas", {}, WAIT);
    fireEvent.change(input("name"), { target: { value: "Open Gran Canaria" } });
    fireEvent.change(input("startDate"), { target: { value: "2099-11-20" } });
    fireEvent.change(input("endDate"), { target: { value: "2099-11-21" } });
    next();
    // Paso 2: categorías (la de por defecto vale)
    await screen.findByLabelText("Plazas", {}, WAIT);
    next();
    // Paso 3: configuración, con la zona del club
    await waitFor(() => expect(input("registrationDeadline")).toBeTruthy(), WAIT);
    expect(await screen.findByText("Hora del torneo (Canarias)", {}, WAIT)).toBeInTheDocument();
    fireEvent.change(input("registrationDeadline"), { target: { value: "2099-11-10T20:00" } });
    next();
    // Paso 4: jornadas (las genera de las fechas) y 5: confirmar
    await screen.findByText("Horarios por jornada", {}, WAIT);
    next();
    await screen.findByRole("button", { name: /Crear torneo/ }, WAIT);
    next();

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1), WAIT);
    expect(create.mock.calls[0][0]).toMatchObject({
      clubId: "club-1",
      timezone: "Atlantic/Canary",
      registrationDeadline: "2099-11-10T20:00:00.000Z",
    });
  }, 30_000);
});

describe("Crear torneo — género de la categoría (D2)", () => {
  it("ofrece los cinco y manda el elegido (antes solo masculina y femenina)", async () => {
    create.mockClear();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <NuevoTorneoPage />
      </QueryClientProvider>,
    );
    await screen.findByDisplayValue("Club Las Palmas — Las Palmas", {}, WAIT);
    fireEvent.change(input("name"), { target: { value: "Open Junior" } });
    fireEvent.change(input("startDate"), { target: { value: "2099-11-20" } });
    fireEvent.change(input("endDate"), { target: { value: "2099-11-21" } });
    next();
    // Paso 2: la categoría de por defecto es masculina; se cambia a junior
    await screen.findByLabelText("Plazas", {}, WAIT);
    fireEvent.click(screen.getByRole("button", { name: "Masculina" }));
    for (const name of ["Femenina", "Mixta", "General", "Junior"])
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Junior" }));
    next();
    await waitFor(() => expect(input("registrationDeadline")).toBeTruthy(), WAIT);
    fireEvent.change(input("registrationDeadline"), { target: { value: "2099-11-10T20:00" } });
    next();
    await screen.findByText("Horarios por jornada", {}, WAIT);
    next();
    // Paso 5: el resumen la nombra como junior (antes, «Fem.»)
    await screen.findByRole("button", { name: /Crear torneo/ }, WAIT);
    expect(screen.getByText("Junior 4ª")).toBeInTheDocument();
    next();

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1), WAIT);
    expect(create.mock.calls[0][0].categories).toMatchObject([{ gender: "J", level: "4a" }]);
  }, 30_000);
});

describe("Crear torneo — tramos del paso 4 (P2-10)", () => {
  /** Hasta el paso 4 de un torneo de un día, con su tramo de por defecto (16:00-21:00). */
  async function goToStep4() {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <NuevoTorneoPage />
      </QueryClientProvider>,
    );
    await screen.findByDisplayValue("Club Las Palmas — Las Palmas", {}, WAIT);
    fireEvent.change(input("name"), { target: { value: "Open de un día" } });
    fireEvent.change(input("startDate"), { target: { value: "2099-11-20" } });
    fireEvent.change(input("endDate"), { target: { value: "2099-11-20" } });
    next();
    await screen.findByLabelText("Plazas", {}, WAIT);
    next();
    await waitFor(() => expect(input("registrationDeadline")).toBeTruthy(), WAIT);
    fireEvent.change(input("registrationDeadline"), { target: { value: "2099-11-10T20:00" } });
    next();
    await screen.findByText("Horarios por jornada", {}, WAIT);
  }
  const starts = () => screen.getAllByLabelText("Inicio del tramo") as HTMLInputElement[];
  const ends = () => screen.getAllByLabelText("Fin del tramo") as HTMLInputElement[];
  const OVERLAP = "Este bloque se solapa con otro de la misma jornada";

  it("un tramo que pisa a otro que no es el de justo antes también se marca (09-14, 10-11 y 12-13)", async () => {
    await goToStep4();
    fireEvent.click(await screen.findByRole("button", { name: /Añadir tramo/ }, WAIT));
    fireEvent.click(screen.getByRole("button", { name: /Añadir tramo/ }));
    const set = (i: number, start: string, end: string) => {
      fireEvent.change(starts()[i], { target: { value: start } });
      fireEvent.change(ends()[i], { target: { value: end } });
    };
    set(0, "09:00", "14:00");
    set(1, "10:00", "11:00");
    set(2, "12:00", "13:00");
    next();
    // Uno por tramo que pisa: el de 12-13 no salía (solo se comparaba con el de antes)
    await waitFor(() => expect(screen.getAllByText(OVERLAP)).toHaveLength(2), WAIT);
  }, 30_000);

  it("«Añadir tramo» no repite el de por defecto, y un solape se dice en el tramo", async () => {
    await goToStep4();

    // Antes añadía otro 16:00-21:00 y «Siguiente» no hacía nada sin decir por qué
    fireEvent.click(await screen.findByRole("button", { name: /Añadir tramo/ }, WAIT));
    expect(starts().map((i) => i.value)).toEqual(["16:00", "09:00"]);
    expect(ends().map((i) => i.value)).toEqual(["21:00", "14:00"]);

    // Lo movemos encima del de la tarde: el error sale en ese tramo
    fireEvent.change(starts()[1], { target: { value: "17:00" } });
    fireEvent.change(ends()[1], { target: { value: "19:00" } });
    next();
    expect(await screen.findByText("Este bloque se solapa con otro de la misma jornada", {}, WAIT)).toBeInTheDocument();
    expect(screen.getByText("Hay tramos que corregir: revisa los marcados en rojo.")).toBeInTheDocument();

    // Al corregirlo, el error se va y se avanza
    fireEvent.change(starts()[1], { target: { value: "10:00" } });
    fireEvent.change(ends()[1], { target: { value: "13:00" } });
    await waitFor(() => expect(screen.queryByText("Este bloque se solapa con otro de la misma jornada")).not.toBeInTheDocument(), WAIT);
    next();
    expect(await screen.findByRole("button", { name: /Crear torneo/ }, WAIT)).toBeInTheDocument();
    expect(screen.getByText("16:00-21:00, 10:00-13:00")).toBeInTheDocument();
  }, 30_000);
});

describe("Crear torneo — exigir el pago para confirmar (B4)", () => {
  it("sale apagado, con su línea de ayuda; activado, el resumen lo dice y se manda", async () => {
    create.mockClear();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <NuevoTorneoPage />
      </QueryClientProvider>,
    );
    await screen.findByDisplayValue("Club Las Palmas — Las Palmas", {}, WAIT);
    fireEvent.change(input("name"), { target: { value: "Open con cobro" } });
    fireEvent.change(input("startDate"), { target: { value: "2099-11-20" } });
    fireEvent.change(input("endDate"), { target: { value: "2099-11-21" } });
    next();
    await screen.findByLabelText("Plazas", {}, WAIT);
    next();
    // Paso 3: el interruptor, apagado por defecto y con su ayuda
    await waitFor(() => expect(input("registrationDeadline")).toBeTruthy(), WAIT);
    const toggle = screen.getByRole("checkbox", { name: /Exigir el pago para confirmar/ });
    expect(toggle).not.toBeChecked();
    expect(screen.getByText(/Ninguna pareja pasa a confirmada hasta que se marque pagado/)).toBeInTheDocument();
    fireEvent.click(toggle);
    fireEvent.change(input("registrationDeadline"), { target: { value: "2099-11-10T20:00" } });
    next();
    await screen.findByText("Horarios por jornada", {}, WAIT);
    next();
    // Paso 5: el resumen lo enseña
    await screen.findByRole("button", { name: /Crear torneo/ }, WAIT);
    expect(within(screen.getByText("Exigir el pago para confirmar").parentElement as HTMLElement).getByText("Sí")).toBeInTheDocument();
    next();

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1), WAIT);
    expect(create.mock.calls[0][0]).toMatchObject({ requirePaymentToConfirm: true });
  }, 30_000);
});

describe("Crear torneo — con las opciones de torneo del club (B5-1)", () => {
  beforeEach(() => {
    create.mockClear();
    getConfig.mockClear();
  });
  afterEach(() => getConfig.mockImplementation(async () => DEFAULT_CONFIG));

  function renderWizard() {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <NuevoTorneoPage />
      </QueryClientProvider>,
    );
  }
  async function fillStep1() {
    await screen.findByDisplayValue("Club Las Palmas — Las Palmas", {}, WAIT);
    fireEvent.change(input("name"), { target: { value: "Open del club" } });
    fireEvent.change(input("startDate"), { target: { value: "2099-11-20" } });
    fireEvent.change(input("endDate"), { target: { value: "2099-11-21" } });
  }
  const values = (label: string) => screen.getAllByLabelText(label).map((i) => (i as HTMLInputElement).value);
  const summary = (label: string) => screen.getByText(label).parentElement as HTMLElement;

  it("cada paso empieza con las del club, lo cambiado a mano se queda, y el resumen y el envío las llevan", async () => {
    getConfig.mockImplementation(async () => ({
      ...DEFAULT_CONFIG,
      format: "grupos+eliminatoria",
      matchDuration: 90,
      hasShirts: true,
      categoryPrice: 30,
      categorySpots: 16,
      dayStartTime: "10:00",
      dayEndTime: "14:00",
      maxUnavailableTotalHours: 4,
      description: "Open de otoño del club",
      rules: "Normas del club",
      participantsVisibility: "HIDDEN_UNTIL_START",
      showClubInsteadOfCourt: true,
      hideFromAppAfterDays: 7,
    }));
    renderWizard();

    // Paso 1: descripción y normas del club; las normas se cambian a mano
    expect(await screen.findByDisplayValue("Open de otoño del club", {}, WAIT)).toBeInTheDocument();
    expect(getConfig).toHaveBeenCalledWith("club-1");
    fireEvent.change(screen.getByLabelText("Normas"), { target: { value: "Normas de este torneo" } });
    await fillStep1();
    next();

    // Paso 2: precio y plazas del club, también en la categoría que se añade
    await screen.findByLabelText("Plazas", {}, WAIT);
    await waitFor(() => expect(values("Plazas")).toEqual(["16"]), WAIT);
    fireEvent.click(screen.getByRole("button", { name: /Añadir categoría/ }));
    expect(values("Plazas")).toEqual(["16", "16"]);
    expect(values("Precio (€)")).toEqual(["30", "30"]);
    next();

    // Paso 3: formato, duración, camisetas y lo que ven los jugadores
    await waitFor(() => expect(input("registrationDeadline")).toBeTruthy(), WAIT);
    await screen.findByRole("button", { name: "Grupos + Eliminatoria" }, WAIT);
    expect(screen.getByRole("button", { name: "90 minutos" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Incluir camisetas/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /Nadie hasta que empiece/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Mostrar el club en vez de la pista/ })).toBeChecked();
    expect(screen.getByLabelText("Días después del último día del torneo")).toHaveValue(7);
    fireEvent.change(input("registrationDeadline"), { target: { value: "2099-11-10T20:00" } });
    next();

    // Paso 4: el tramo y las franjas del club en las jornadas generadas
    await screen.findByText("Horarios por jornada", {}, WAIT);
    await waitFor(() => expect(values("Inicio del tramo")).toEqual(["10:00", "10:00"]), WAIT);
    expect(values("Fin del tramo")).toEqual(["14:00", "14:00"]);
    expect(screen.getByPlaceholderText("0")).toHaveValue(4);
    next();

    // Paso 5: el resumen enseña lo nuevo
    await screen.findByRole("button", { name: /Crear torneo/ }, WAIT);
    expect(within(summary("Lista de inscritos")).getByText("Nadie hasta que empiece")).toBeInTheDocument();
    expect(within(summary("El club en vez de la pista")).getByText("Sí")).toBeInTheDocument();
    expect(within(summary("Quitarlo del listado de la app")).getByText("7 días después del último día")).toBeInTheDocument();
    expect(screen.getByText("Open de otoño del club")).toBeInTheDocument();
    expect(screen.getByText("Normas de este torneo")).toBeInTheDocument();
    next();

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1), WAIT);
    expect(create.mock.calls[0][0]).toMatchObject({
      description: "Open de otoño del club",
      rules: "Normas de este torneo",
      format: "grupos+eliminatoria",
      matchDuration: 90,
      hasShirts: true,
      participantsVisibility: "HIDDEN_UNTIL_START",
      showClubInsteadOfCourt: true,
      hideFromAppAfterDays: 7,
      maxUnavailableTotalHours: 4,
      categories: [{ totalSpots: 16, price: 30 }, { totalSpots: 16, price: 30 }],
      schedule: [
        { date: "2099-11-20", blocks: [{ start: "10:00", end: "14:00" }] },
        { date: "2099-11-21", blocks: [{ start: "10:00", end: "14:00" }] },
      ],
    });
  }, 60_000);

  it("volver atrás no pisa lo cambiado a mano (la zona elegida volvía a la del club al volver del paso 4)", async () => {
    getConfig.mockImplementation(async () => ({ ...DEFAULT_CONFIG, format: "grupos+eliminatoria" }));
    renderWizard();
    await fillStep1();
    next();
    await screen.findByLabelText("Plazas", {}, WAIT);
    next();

    // Paso 3: el formato y la zona, a mano
    await screen.findByRole("button", { name: "Grupos + Eliminatoria" }, WAIT);
    fireEvent.click(screen.getByRole("button", { name: "Grupos + Eliminatoria" }));
    fireEvent.click(screen.getByRole("button", { name: "Round Robin" }));
    fireEvent.click(screen.getByRole("button", { name: /^Canarias/ }));
    fireEvent.click(screen.getByRole("button", { name: /Península, Baleares/ }));
    fireEvent.change(input("registrationDeadline"), { target: { value: "2099-11-10T20:00" } });
    next();
    await screen.findByText("Horarios por jornada", {}, WAIT);

    // Y vuelta al paso 3: siguen los elegidos
    fireEvent.click(screen.getByRole("button", { name: /Anterior/ }));
    await waitFor(() => expect(input("registrationDeadline")).toBeTruthy(), WAIT);
    expect(screen.getByRole("button", { name: "Round Robin" })).toBeInTheDocument();
    expect(screen.getByText(/^Hora del torneo/).textContent).toBe("Hora del torneo (Península, Baleares, Ceuta y Melilla)");
  }, 60_000);

  it("sin poder cargar las opciones del club, lo dice y empieza con los de siempre", async () => {
    getConfig.mockImplementation(async () => {
      throw new Error("Network Error");
    });
    renderWizard();
    expect(
      await screen.findByText("No se pudieron cargar las opciones de torneo del club: los valores de partida son los de siempre.", {}, WAIT),
    ).toBeInTheDocument();
    await fillStep1();
    next();
    await screen.findByLabelText("Plazas", {}, WAIT);
    expect(values("Plazas")).toEqual(["32"]);
    expect(values("Precio (€)")).toEqual(["25"]);
  }, 60_000);
});

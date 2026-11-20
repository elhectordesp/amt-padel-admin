/**
 * Escuela del club: el listado de grupos (con «Mis grupos» primero para quien
 * lleva alguno), lo que ve un entrenador (sin crear ni pestañas) y el alta de
 * un grupo, que genera las clases de la temporada y lleva a su ficha.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/components/admin/header", () => ({
  Header: ({ title }: { title: string }) => <div data-testid="header">{title}</div>,
}));
vi.mock("@/lib/use-role", () => ({
  useRole: () => ({ role: "club", clubId: "c1" }),
  isClub: (r: string) => r === "club",
}));
const access = vi.hoisted(() => ({ write: true }));
vi.mock("@/lib/use-club-access", () => ({
  useClubAccess: () => ({ roles: null, can: (_a: string, level = "read") => level === "read" || access.write }),
}));
vi.mock("@/lib/use-me", () => ({ useMe: () => ({ data: { id: "u-marta", name: "Marta" } }) }));
vi.mock("@/lib/use-club-time-zone", () => ({
  useClubTimeZone: () => ({ timeZone: "Europe/Madrid", isError: false, refetch: vi.fn() }),
}));
const recovery = vi.hoisted(() => ({
  requests: { list: vi.fn() },
  config: { get: vi.fn() },
  credits: { list: vi.fn() },
}));
vi.mock("@/lib/services/school-recovery", async () => {
  const actual = await vi.importActual<typeof import("@/lib/services/school-recovery")>("@/lib/services/school-recovery");
  return { ...actual, schoolRecoveryService: { ...actual.schoolRecoveryService, ...recovery } };
});

const school = vi.hoisted(() => ({
  groups: { list: vi.fn(), create: vi.fn() },
  sessions: { generate: vi.fn() },
  coaches: { list: vi.fn(), update: vi.fn() },
}));
vi.mock("@/lib/services/school", async () => {
  const actual = await vi.importActual<typeof import("@/lib/services/school")>("@/lib/services/school");
  return { ...actual, schoolService: { ...actual.schoolService, ...school } };
});
const adminMock = vi.hoisted(() => ({ courts: { list: vi.fn() } }));
vi.mock("@/lib/services/admin", () => ({ adminService: adminMock }));
// Cuotas y clases privadas (A7-2b): sus pestañas leen la zona del club y su propio servicio
vi.mock("@/lib/use-club-time-zone", () => ({
  useClubTimeZone: () => ({ timeZone: "Europe/Madrid", isError: false, refetch: vi.fn() }),
}));
const billing = vi.hoisted(() => ({
  fees: { list: vi.fn() },
  privateClasses: { list: vi.fn() },
  coachRate: { update: vi.fn() },
}));
vi.mock("@/lib/services/school-billing", async () => {
  const actual = await vi.importActual<typeof import("@/lib/services/school-billing")>("@/lib/services/school-billing");
  return { ...actual, schoolBillingService: { ...actual.schoolBillingService, ...billing } };
});

import EscuelaPage from "../../../app/(admin)/mi-club/escuela/page";

const group = (over: Record<string, unknown> = {}) => ({
  id: "g1", clubId: "c1", name: "Iniciación", level: "Nivel 1", maxStudents: 6,
  startDate: "2026-09-14", endDate: "2027-06-18", notes: null, archivedAt: null, createdAt: "2026-09-01T00:00:00Z",
  coach: { staffId: "st1", userId: "u-marta", name: "Marta Prueba" },
  slots: [{ id: "s1", weekday: 1, startTime: "18:00", durationMinutes: 60, preferredCourtId: null }],
  activeStudents: 4, upcomingSessions: 30, upcomingWithoutCourt: 0,
  ...over,
});

const OTHER = group({
  id: "g2", name: "Avanzado", level: null, activeStudents: 6, upcomingWithoutCourt: 2,
  coach: { staffId: "st2", userId: "u-luis", name: "Luis Prueba" },
  slots: [{ id: "s2", weekday: 3, startTime: "19:30", durationMinutes: 90, preferredCourtId: null }],
});

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <EscuelaPage />
    </QueryClientProvider>,
  );
}

const WAIT = { timeout: 5000 };

describe("Escuela: grupos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    access.write = true;
    recovery.requests.list.mockResolvedValue([]);
    recovery.config.get.mockResolvedValue({ recoveryNoticeHours: 24, recoveryValidDays: 60 });
    recovery.credits.list.mockResolvedValue([]);
    school.groups.list.mockResolvedValue([OTHER, group()]);
    school.coaches.list.mockResolvedValue([
      { staffId: "st1", userId: "u-marta", name: "Marta Prueba", coachBio: null, groups: [{ id: "g1", name: "Iniciación" }] },
    ]);
    adminMock.courts.list.mockResolvedValue([{ id: "p1", name: "Pista 1", active: true }]);
  });

  it("el gestor ve sus grupos con el horario, las plazas y las clases sin pista; los suyos, primero", async () => {
    renderPage();
    expect(await screen.findByText("Mis grupos", {}, WAIT)).toBeInTheDocument();
    expect(screen.getByText("Resto de grupos")).toBeInTheDocument();

    const mine = screen.getByRole("region", { name: "Mis grupos" });
    expect(within(mine).getByText("Iniciación")).toBeInTheDocument();
    expect(within(mine).getByText("Lunes 18:00–19:00")).toBeInTheDocument();
    expect(within(mine).getByText("4 de 6 alumnos")).toBeInTheDocument();

    const rest = screen.getByRole("region", { name: "Resto de grupos" });
    expect(within(rest).getByText("Avanzado")).toBeInTheDocument();
    expect(within(rest).getByText("Miércoles 19:30–21:00")).toBeInTheDocument();
    expect(within(rest).getByText("2 sin pista")).toBeInTheDocument();
    expect(within(rest).getByRole("link")).toHaveAttribute("href", "/mi-club/escuela/grupos/g2");
    // Pide los vivos; los archivados, solo si se piden
    expect(school.groups.list).toHaveBeenCalledWith("c1", false);
  });

  it("el gestor tiene Nuevo grupo y la pestaña de Entrenadores", async () => {
    renderPage();
    await screen.findByText("Mis grupos", {}, WAIT);
    expect(screen.getByRole("button", { name: /Nuevo grupo/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Entrenadores" }));
    expect(await screen.findByText("Marta Prueba", {}, WAIT)).toBeInTheDocument();
    expect(school.coaches.list).toHaveBeenCalledWith("c1");
  });

  it("un entrenador solo ve sus grupos: sin Nuevo grupo, y de pestañas solo Grupos, Bandeja y Clases privadas", async () => {
    access.write = false;
    school.groups.list.mockResolvedValue([group()]);
    renderPage();
    expect(await screen.findByText("Mis grupos", {}, WAIT)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Nuevo grupo/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Grupos", "Bandeja", "Clases privadas"]);
    expect(screen.queryByText("Resto de grupos")).not.toBeInTheDocument();
  });

  it("el gestor tiene todas las pestañas y la Bandeja lleva el contador de pendientes", async () => {
    recovery.requests.list.mockResolvedValue([{ id: "r1" }, { id: "r2" }, { id: "r3" }]);
    renderPage();
    await screen.findByText("Mis grupos", {}, WAIT);
    expect(await screen.findByRole("tab", { name: "Bandeja (3)" }, WAIT)).toBeInTheDocument();
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual([
      "Grupos",
      "Bandeja (3)",
      "Clases privadas",
      "Cuotas",
      "Recuperaciones",
      "Entrenadores",
    ]);
    expect(recovery.requests.list).toHaveBeenCalledWith("c1", "PENDING");
  });

  it("la pestaña Bandeja: el entrenador la ve y puede apuntar una solicitud", async () => {
    access.write = false;
    school.groups.list.mockResolvedValue([group()]);
    recovery.requests.list.mockResolvedValue([
      {
        id: "r1", kind: "OTHER", status: "PENDING", clubCustomerId: null, customerName: null, contactName: "Pedro Prueba",
        contactPhone: null, group: null, session: null, coach: null, message: "Pide horario", createdBy: "Marta Prueba",
        createdAt: "2026-11-17T18:30:00.000Z", resolvedBy: null, resolvedAt: null, resolutionNote: null,
      },
    ]);
    renderPage();
    await screen.findByText("Mis grupos", {}, WAIT);
    fireEvent.click(screen.getByRole("tab", { name: "Bandeja (1)" }));
    expect(await screen.findByText("Pide horario", {}, WAIT)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Nueva solicitud/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Aceptar/ })).not.toBeInTheDocument();
  });

  it("la pestaña Recuperaciones es del gestor y carga los ajustes y los créditos", async () => {
    renderPage();
    await screen.findByText("Mis grupos", {}, WAIT);
    fireEvent.click(screen.getByRole("tab", { name: "Recuperaciones" }));
    expect(await screen.findByRole("form", { name: "Ajustes de las recuperaciones" }, WAIT)).toBeInTheDocument();
    expect(recovery.config.get).toHaveBeenCalledWith("c1");
    expect(recovery.credits.list).toHaveBeenCalledWith("c1", { status: "available" });
  });

  it("un entrenador sin grupos lo lee claro", async () => {
    access.write = false;
    school.groups.list.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText("Todavía no llevas ningún grupo.", {}, WAIT)).toBeInTheDocument();
  });

  it("ver los archivados los pide al servidor", async () => {
    renderPage();
    await screen.findByText("Mis grupos", {}, WAIT);
    fireEvent.click(screen.getByLabelText("Ver solo los archivados"));
    await waitFor(() => expect(school.groups.list).toHaveBeenCalledWith("c1", true), WAIT);
  });

  it("Nuevo grupo: valida antes de mandar, crea con el horario, genera las clases y va a su ficha", async () => {
    school.groups.create.mockResolvedValue({ id: "g9" });
    school.sessions.generate.mockResolvedValue({ created: 38, withoutCourt: 0, skippedClosedDays: 1, skippedOutsideHours: 0, removed: 0 });
    renderPage();
    await screen.findByText("Mis grupos", {}, WAIT);
    fireEvent.click(screen.getByRole("button", { name: /Nuevo grupo/ }));

    const dialog = await screen.findByRole("dialog", { name: "Nuevo grupo" });
    // Sin nombre ni fechas, no se manda
    fireEvent.click(within(dialog).getByRole("button", { name: "Crear grupo" }));
    expect(toast.error).toHaveBeenCalledWith("Escribe el nombre del grupo");
    expect(school.groups.create).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByPlaceholderText("Iniciación martes y jueves"), { target: { value: " Peques " } });
    const [start, end] = Array.from(dialog.querySelectorAll('input[type="date"]'));
    fireEvent.change(start, { target: { value: "2026-09-14" } });
    fireEvent.change(end, { target: { value: "2027-06-18" } });
    const slot = within(dialog).getByRole("group", { name: "Franja 1" });
    fireEvent.change(within(slot).getByLabelText("Día"), { target: { value: "2" } });
    fireEvent.change(within(slot).getByLabelText("Pista preferida"), { target: { value: "p1" } });
    fireEvent.change(within(dialog).getByLabelText("Entrenador"), { target: { value: "st1" } });
    // La cuota mensual se escribe en euros y sale en céntimos
    fireEvent.change(within(dialog).getByLabelText("Cuota mensual por alumno (€, opcional)"), { target: { value: "45" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Crear grupo" }));

    await waitFor(() =>
      expect(school.groups.create).toHaveBeenCalledWith("c1", {
        name: "Peques",
        level: null,
        coachStaffId: "st1",
        maxStudents: 8,
        monthlyFeeCents: 4500,
        startDate: "2026-09-14",
        endDate: "2027-06-18",
        notes: null,
        slots: [{ weekday: 2, startTime: "18:00", durationMinutes: 60, preferredCourtId: "p1" }],
      }),
    WAIT);
    await waitFor(() => expect(school.sessions.generate).toHaveBeenCalledWith("c1", "g9"), WAIT);
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/mi-club/escuela/grupos/g9"), WAIT);
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("Se han creado 38 clases"));
  });

  it("si no se pide generar las clases, solo se crea el grupo", async () => {
    school.groups.create.mockResolvedValue({ id: "g9" });
    renderPage();
    await screen.findByText("Mis grupos", {}, WAIT);
    fireEvent.click(screen.getByRole("button", { name: /Nuevo grupo/ }));
    const dialog = await screen.findByRole("dialog", { name: "Nuevo grupo" });

    fireEvent.change(within(dialog).getByPlaceholderText("Iniciación martes y jueves"), { target: { value: "Peques" } });
    const [start, end] = Array.from(dialog.querySelectorAll('input[type="date"]'));
    fireEvent.change(start, { target: { value: "2026-09-14" } });
    fireEvent.change(end, { target: { value: "2027-06-18" } });
    fireEvent.click(within(dialog).getByRole("checkbox", { name: /Generar ahora las clases/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Crear grupo" }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/mi-club/escuela/grupos/g9"), WAIT);
    expect(school.sessions.generate).not.toHaveBeenCalled();
  });

  it("si el grupo se guarda pero no se pueden generar las clases, lo dice sin perder el grupo", async () => {
    school.groups.create.mockResolvedValue({ id: "g9" });
    school.sessions.generate.mockRejectedValue({ response: { data: { message: "Fallo al reservar" } } });
    renderPage();
    await screen.findByText("Mis grupos", {}, WAIT);
    fireEvent.click(screen.getByRole("button", { name: /Nuevo grupo/ }));
    const dialog = await screen.findByRole("dialog", { name: "Nuevo grupo" });

    fireEvent.change(within(dialog).getByPlaceholderText("Iniciación martes y jueves"), { target: { value: "Peques" } });
    const [start, end] = Array.from(dialog.querySelectorAll('input[type="date"]'));
    fireEvent.change(start, { target: { value: "2026-09-14" } });
    fireEvent.change(end, { target: { value: "2027-06-18" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Crear grupo" }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/mi-club/escuela/grupos/g9"), WAIT);
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("no se han podido generar las clases: Fallo al reservar"));
  });
});

describe("Escuela: cuotas, clases privadas y tarifa del entrenador", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    access.write = true;
    school.groups.list.mockResolvedValue([group()]);
    school.coaches.list.mockResolvedValue([
      { staffId: "st1", userId: "u-marta", name: "Marta Prueba", coachBio: null, privateClassRateCents: 4000, groups: [] },
    ]);
    adminMock.courts.list.mockResolvedValue([]);
    billing.fees.list.mockResolvedValue([]);
    billing.privateClasses.list.mockResolvedValue([]);
    billing.coachRate.update.mockResolvedValue({});
  });

  it("el gestor tiene las pestañas Clases privadas y Cuotas, cada una con lo suyo", async () => {
    renderPage();
    await screen.findByText("Mis grupos", {}, WAIT);
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual([
      "Grupos",
      "Bandeja",
      "Clases privadas",
      "Cuotas",
      "Recuperaciones",
      "Entrenadores",
    ]);

    fireEvent.click(screen.getByRole("tab", { name: "Clases privadas" }));
    expect(await screen.findByText("No hay clases privadas en estos días.", {}, WAIT)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Nueva clase privada/ })).toBeInTheDocument();
    // «Nuevo grupo» es de la pestaña de grupos
    expect(screen.queryByRole("button", { name: /Nuevo grupo/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Cuotas" }));
    expect(await screen.findByText(/No hay cuotas de este mes/, {}, WAIT)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Generar cuotas de/ })).toBeInTheDocument();
  });

  it("un entrenador ve sus clases privadas sin poder crearlas y no ve las cuotas", async () => {
    access.write = false;
    renderPage();
    await screen.findByText("Mis grupos", {}, WAIT);
    expect(screen.queryByRole("tab", { name: "Cuotas" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Clases privadas" }));
    expect(await screen.findByText("No hay clases privadas en estos días.", {}, WAIT)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Nueva clase privada/ })).not.toBeInTheDocument();
    expect(billing.privateClasses.list).toHaveBeenCalled();
    expect(billing.fees.list).not.toHaveBeenCalled();
  });

  it("la tarifa de clase privada del entrenador: euros a céntimos, vacía la quita y una mala no se manda", async () => {
    renderPage();
    await screen.findByText("Mis grupos", {}, WAIT);
    fireEvent.click(screen.getByRole("tab", { name: "Entrenadores" }));
    const rate = await screen.findByLabelText(/Tarifa de clase privada/, {}, WAIT);
    expect(rate).toHaveValue("40,00");

    fireEvent.change(rate, { target: { value: "45,50" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar tarifa" }));
    await waitFor(() => expect(billing.coachRate.update).toHaveBeenCalledWith("c1", "st1", 4550), WAIT);

    fireEvent.change(rate, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar tarifa" }));
    await waitFor(() => expect(billing.coachRate.update).toHaveBeenLastCalledWith("c1", "st1", null), WAIT);

    billing.coachRate.update.mockClear();
    fireEvent.change(rate, { target: { value: "abc" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar tarifa" }));
    expect(toast.error).toHaveBeenCalledWith("Escribe una tarifa válida (por ejemplo 40 o 40,50)");
    expect(billing.coachRate.update).not.toHaveBeenCalled();
  });
});

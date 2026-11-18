/**
 * Ficha de una clase de la escuela, con las recuperaciones: avisar la ausencia
 * de un alumno (con o sin margen para recuperar), deshacer el aviso, apuntar a
 * quien recupera en el hueco, quitarlo y cancelar la clase dando o no una
 * recuperación. El entrenador solo pasa lista.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Suspense } from "react";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
vi.mock("@/components/admin/header", () => ({
  Header: ({ title }: { title: string }) => <div data-testid="header">{title}</div>,
}));
vi.mock("@/lib/use-role", () => ({
  useRole: () => ({ role: "club", clubId: "c1" }),
  isClub: (r: string) => r === "club",
}));
vi.mock("@/lib/use-club-time-zone", () => ({
  useClubTimeZone: () => ({ timeZone: "Europe/Madrid", isError: false, refetch: vi.fn() }),
}));
const access = vi.hoisted(() => ({ write: true }));
vi.mock("@/lib/use-club-access", () => ({
  useClubAccess: () => ({ roles: null, can: (_a: string, level = "read") => level === "read" || access.write }),
}));

const school = vi.hoisted(() => ({ sessions: { sheet: vi.fn(), setAttendance: vi.fn(), cancel: vi.fn() } }));
vi.mock("@/lib/services/school", async () => {
  const actual = await vi.importActual<typeof import("@/lib/services/school")>("@/lib/services/school");
  return { ...actual, schoolService: { ...actual.schoolService, ...school } };
});
const recovery = vi.hoisted(() => ({
  config: { get: vi.fn() },
  absences: { register: vi.fn(), undo: vi.fn() },
  recoveries: { use: vi.fn(), giveBack: vi.fn() },
  credits: { list: vi.fn() },
}));
vi.mock("@/lib/services/school-recovery", async () => {
  const actual = await vi.importActual<typeof import("@/lib/services/school-recovery")>("@/lib/services/school-recovery");
  return { ...actual, schoolRecoveryService: { ...actual.schoolRecoveryService, ...recovery } };
});

import ClaseEscuelaPage from "../../../app/(admin)/mi-club/escuela/clases/[id]/page";

// «Ahora»: lunes 23 de noviembre de 2026, 11:00 en Madrid. La clase es esa tarde, a las 18:00
const NOW = new Date("2026-11-23T10:00:00.000Z");
const WAIT = { timeout: 5000 };

const student = (clubCustomerId: string, name: string, over: Record<string, unknown> = {}) => ({
  clubCustomerId, name, status: null, noticedAt: null, earnedCreditId: null, recovery: false, usedCreditId: null, ...over,
});

const sheet = (over: Record<string, unknown> = {}, sessionOver: Record<string, unknown> = {}) => ({
  session: {
    id: "ses1", groupId: "g1", slotId: "s1", startsAt: "2026-11-23T17:00:00.000Z", endsAt: "2026-11-23T18:00:00.000Z",
    status: "SCHEDULED", cancelReason: null, court: { id: "p1", name: "Pista 2" }, attendanceCount: 0, ...sessionOver,
  },
  group: { id: "g1", name: "Iniciación" },
  students: [
    student("cc1", "Ana Prueba"),
    student("cc2", "Beto Prueba", { status: "EXCUSED", noticedAt: "2026-11-21T09:00:00.000Z", earnedCreditId: "cr-earned" }),
    student("cc3", "Carla Prueba", { status: "EXCUSED", noticedAt: "2026-11-23T08:00:00.000Z" }),
    student("cc9", "Dani Prueba", { recovery: true, usedCreditId: "cr-used" }),
  ],
  capacity: { maxStudents: 8, freeSpots: 3 },
  ...over,
});

const credit = (id: string, clubCustomerId: string, customerName: string, over: Record<string, unknown> = {}) => ({
  id, clubCustomerId, customerName, origin: "ABSENCE", status: "available",
  expiresAt: "2027-01-22T22:59:59.999Z",
  sourceSession: { id: "ses0", startsAt: "2026-11-16T17:00:00.000Z", groupName: "Avanzado" },
  usedSession: null, usedAt: null, voidedAt: null, note: null, createdAt: "2026-11-15T10:00:00.000Z", ...over,
});

async function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  await act(async () => {
    render(
      <QueryClientProvider client={qc}>
        <Suspense fallback={null}>
          <ClaseEscuelaPage params={Promise.resolve({ id: "ses1" })} />
        </Suspense>
      </QueryClientProvider>,
    );
  });
}

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});
afterAll(() => vi.useRealTimers());

const row = (name: string) => screen.getByRole("group", { name: `Asistencia de ${name}` }).closest("li") as HTMLElement;

describe("Escuela: ficha de clase con recuperaciones", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    access.write = true;
    school.sessions.sheet.mockResolvedValue(sheet());
    recovery.config.get.mockResolvedValue({ recoveryNoticeHours: 24, recoveryValidDays: 60 });
    recovery.credits.list.mockResolvedValue([]);
  });

  it("enseña los huecos, el aviso de cada alumno con su recuperación y a quien recupera con su distintivo", async () => {
    await renderPage();
    expect(await screen.findByText("3 huecos libres de 8 plazas", {}, WAIT)).toBeInTheDocument();

    // Beto avisó con margen (gana recuperación); Carla, con poco (no)
    expect(within(row("Beto Prueba")).getByText(/Avisó de que falta el 21 nov, 10:00 · gana una recuperación/)).toBeInTheDocument();
    expect(within(row("Carla Prueba")).getByText(/Avisó de que falta el 23 nov, 09:00 · avisó con poco margen: sin recuperación/)).toBeInTheDocument();
    // Quien recupera
    expect(within(row("Dani Prueba")).getByText("Recupera")).toBeInTheDocument();
    expect(within(row("Dani Prueba")).getByText(/Viene a recuperar una clase de otro día/)).toBeInTheDocument();
    // Se le pasa lista como a los demás
    expect(within(screen.getByRole("group", { name: "Asistencia de Dani Prueba" })).getByRole("button", { name: "Presente" })).toBeEnabled();
  });

  it("Avisa ausencia: dice si el margen da recuperación y manda la hora del aviso", async () => {
    recovery.absences.register.mockResolvedValue({
      clubCustomerId: "cc1", noticedAt: "2026-11-21T09:00:00.000Z",
      credit: { id: "cr-new", expiresAt: "2027-01-22T22:59:59.999Z" },
    });
    await renderPage();
    await screen.findByText("3 huecos libres de 8 plazas", {}, WAIT);
    fireEvent.click(screen.getByRole("button", { name: "Avisar de la ausencia de Ana Prueba" }));

    const dialog = await screen.findByRole("dialog", { name: "Avisar de una ausencia" });
    // Avisa ahora, 7 h antes de la clase: no llega a las 24 h del club
    expect(await within(dialog).findByText(/Avisa con 7 h de margen y el club pide 24 h: no gana recuperación/, {}, WAIT)).toBeInTheDocument();

    // Avisó el sábado por la mañana: 2 días y 8 h antes
    fireEvent.change(within(dialog).getByLabelText("Cuándo avisó"), { target: { value: "2026-11-21T10:00" } });
    expect(within(dialog).getByText(/Avisa con 2 días y 8 h de margen: gana una recuperación/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Avisar ausencia" }));

    await waitFor(
      () =>
        expect(recovery.absences.register).toHaveBeenCalledWith("c1", "ses1", {
          clubCustomerId: "cc1",
          noticedAt: "2026-11-21T09:00:00.000Z",
        }),
      WAIT,
    );
    await waitFor(
      () => expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("gana una recuperación (vale hasta el 22 ene 2027)")),
      WAIT,
    );
  });

  it("un aviso de después de ahora lo rechaza el back y se enseña su motivo", async () => {
    recovery.absences.register.mockRejectedValue({
      response: { data: { message: "La hora del aviso no puede ser futura" } },
    });
    await renderPage();
    await screen.findByText("3 huecos libres de 8 plazas", {}, WAIT);
    fireEvent.click(screen.getByRole("button", { name: "Avisar de la ausencia de Ana Prueba" }));
    const dialog = await screen.findByRole("dialog", { name: "Avisar de una ausencia" });
    fireEvent.change(within(dialog).getByLabelText("Cuándo avisó"), { target: { value: "2026-11-24T10:00" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Avisar ausencia" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("La hora del aviso no puede ser futura"), WAIT);
    expect(recovery.absences.register).toHaveBeenCalledWith("c1", "ses1", {
      clubCustomerId: "cc1",
      noticedAt: "2026-11-24T09:00:00.000Z",
    });
  });

  it("sin recuperación ganada, el aviso lo dice", async () => {
    recovery.absences.register.mockResolvedValue({ clubCustomerId: "cc1", noticedAt: NOW.toISOString(), credit: null });
    await renderPage();
    await screen.findByText("3 huecos libres de 8 plazas", {}, WAIT);
    fireEvent.click(screen.getByRole("button", { name: "Avisar de la ausencia de Ana Prueba" }));
    const dialog = await screen.findByRole("dialog", { name: "Avisar de una ausencia" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Avisar ausencia" }));
    await waitFor(
      () => expect(toast.success).toHaveBeenCalledWith("Ausencia avisada: avisó con poco margen, no gana recuperación"),
      WAIT,
    );
  });

  it("deshacer un aviso pide confirmación y, si ya se gastó la recuperación, enseña el motivo", async () => {
    recovery.absences.undo.mockRejectedValue({
      response: { data: { message: "La recuperación de esa ausencia ya se ha gastado en otra clase" } },
    });
    await renderPage();
    await screen.findByText("3 huecos libres de 8 plazas", {}, WAIT);
    fireEvent.click(screen.getByRole("button", { name: "Deshacer el aviso de Beto Prueba" }));
    const dialog = await screen.findByRole("dialog", { name: "Deshacer el aviso de ausencia" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Deshacer aviso" }));
    await waitFor(() => expect(recovery.absences.undo).toHaveBeenCalledWith("c1", "ses1", "cc2"), WAIT);
    await waitFor(
      () => expect(toast.error).toHaveBeenCalledWith("La recuperación de esa ausencia ya se ha gastado en otra clase"),
      WAIT,
    );
  });

  it("quitar la recuperación devuelve el crédito, y no se ofrece una vez empezada la clase", async () => {
    recovery.recoveries.giveBack.mockResolvedValue({ creditId: "cr-used", clubCustomerId: "cc9" });
    await renderPage();
    await screen.findByText("3 huecos libres de 8 plazas", {}, WAIT);
    fireEvent.click(screen.getByRole("button", { name: "Quitar la recuperación de Dani Prueba" }));
    const dialog = await screen.findByRole("dialog", { name: "Quitar la recuperación" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Quitar recuperación" }));
    await waitFor(() => expect(recovery.recoveries.giveBack).toHaveBeenCalledWith("c1", "ses1", "cr-used"), WAIT);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("recupera su crédito")), WAIT);
  });

  it("Apuntar recuperación: busca entre quienes tienen crédito que valga, sin los que ya están en la lista", async () => {
    recovery.credits.list.mockResolvedValue([
      credit("cr-a", "cc7", "Eva Prueba"),
      credit("cr-b", "cc8", "Óscar Prueba", { expiresAt: "2026-12-05T22:59:59.999Z" }),
      credit("cr-c", "cc6", "Fran Caducado", { expiresAt: "2026-11-20T22:59:59.999Z" }),
      credit("cr-d", "cc1", "Ana Prueba"),
    ]);
    recovery.recoveries.use.mockResolvedValue({ creditId: "cr-b", clubCustomerId: "cc8", sessionId: "ses1", usedAt: NOW.toISOString() });
    await renderPage();
    await screen.findByText("3 huecos libres de 8 plazas", {}, WAIT);
    fireEvent.click(screen.getByRole("button", { name: /Apuntar recuperación/ }));

    const dialog = await screen.findByRole("dialog", { name: "Apuntar recuperación" });
    expect(await within(dialog).findByText("Eva Prueba", {}, WAIT)).toBeInTheDocument();
    // Sin el que caduca antes de la clase ni quien ya está en su lista; el que antes caduca, primero
    expect(within(dialog).queryByText("Fran Caducado")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("Ana Prueba")).not.toBeInTheDocument();
    expect(within(dialog).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      expect.stringContaining("Óscar Prueba"),
      expect.stringContaining("Eva Prueba"),
    ]);
    expect(recovery.credits.list).toHaveBeenCalledWith("c1", { status: "available" });

    // La búsqueda no distingue tildes ni mayúsculas
    fireEvent.change(within(dialog).getByLabelText("Buscar cliente con recuperación"), { target: { value: "oscar" } });
    expect(within(dialog).queryByText("Eva Prueba")).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Apuntar a Óscar Prueba con esta recuperación" }));
    await waitFor(() => expect(recovery.recoveries.use).toHaveBeenCalledWith("c1", "ses1", "cr-b"), WAIT);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Recuperación apuntada"), WAIT);
  });

  it("sin huecos, Apuntar recuperación está desactivado", async () => {
    school.sessions.sheet.mockResolvedValue(sheet({ capacity: { maxStudents: 8, freeSpots: 0 } }));
    await renderPage();
    expect(await screen.findByText("0 huecos libres de 8 plazas", {}, WAIT)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Apuntar recuperación/ })).toBeDisabled();
  });

  it("Cancelar clase: por defecto da recuperación a los alumnos; sin la casilla, no", async () => {
    school.sessions.cancel.mockResolvedValue({ recoveries: { granted: 3, returned: 1 } });
    await renderPage();
    await screen.findByText("3 huecos libres de 8 plazas", {}, WAIT);
    fireEvent.click(screen.getByRole("button", { name: /^Cancelar clase/ }));
    const dialog = await screen.findByRole("dialog", { name: "Cancelar la clase" });
    fireEvent.change(within(dialog).getByPlaceholderText(/Lluvia/), { target: { value: "Lluvia" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar clase" }));
    await waitFor(() => expect(school.sessions.cancel).toHaveBeenCalledWith("c1", "ses1", "Lluvia", true), WAIT);
    await waitFor(
      () =>
        expect(toast.success).toHaveBeenCalledWith(
          "Clase cancelada: su pista queda libre · 3 alumnos ganan una recuperación · 1 recuperación devuelta a quien se había apuntado",
        ),
      WAIT,
    );
  });

  it("una clase con asistencia apuntada no se puede cancelar", async () => {
    school.sessions.sheet.mockResolvedValue(sheet({}, { attendanceCount: 2 }));
    await renderPage();
    await screen.findByText("3 huecos libres de 8 plazas", {}, WAIT);
    expect(screen.queryByRole("button", { name: /^Cancelar clase/ })).not.toBeInTheDocument();
  });

  it("empezada la clase, ya no se apunta ni se quita a nadie", async () => {
    school.sessions.sheet.mockResolvedValue(
      sheet({}, { startsAt: "2026-11-23T09:00:00.000Z", endsAt: "2026-11-23T10:00:00.000Z" }),
    );
    await renderPage();
    await screen.findByText("3 huecos libres de 8 plazas", {}, WAIT);
    expect(screen.queryByRole("button", { name: /Apuntar recuperación/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Quitar la recuperación de Dani Prueba" })).not.toBeInTheDocument();
  });

  it("el entrenador pasa lista, pero no avisa ausencias, ni apunta recuperaciones, ni cancela", async () => {
    access.write = false;
    await renderPage();
    expect(await screen.findByText("Iniciación", {}, WAIT)).toBeInTheDocument();
    expect(within(row("Beto Prueba")).getByText(/gana una recuperación/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Avisar de la ausencia/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Deshacer el aviso/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Quitar la recuperación/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Apuntar recuperación/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Cancelar clase/ })).not.toBeInTheDocument();
    // Y no pide los ajustes del club, que son de quien gestiona
    expect(recovery.config.get).not.toHaveBeenCalled();
  });

  it("una clase cancelada no ofrece nada de esto", async () => {
    school.sessions.sheet.mockResolvedValue(sheet({}, { status: "CANCELLED", court: null }));
    await renderPage();
    expect(await screen.findByRole("status", {}, WAIT)).toHaveTextContent("La clase está cancelada");
    expect(screen.queryByRole("button", { name: /Avisar de la ausencia/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Apuntar recuperación/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/huecos libres/)).not.toBeInTheDocument();
  });
});

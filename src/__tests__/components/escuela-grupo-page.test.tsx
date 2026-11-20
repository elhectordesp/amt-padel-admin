/**
 * Ficha de un grupo de la escuela: alumnos con aforo y bajas, clases de la
 * temporada con su pista (generar, regenerar, cambiar, cancelar) y lo que
 * ve quien solo lee (el entrenador).
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Suspense } from "react";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
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
vi.mock("@/lib/use-club-time-zone", () => ({
  useClubTimeZone: () => ({ timeZone: "Europe/Madrid", isError: false, refetch: vi.fn() }),
}));
vi.mock("@/components/admin/booking-customer-picker", () => ({
  BookingCustomerPicker: ({ onChange }: { onChange: (c: unknown) => void }) => (
    <button onClick={() => onChange({ id: "cc-9", name: "Nuria Nueva" })}>Elegir cliente</button>
  ),
}));

const school = vi.hoisted(() => ({
  groups: { get: vi.fn(), archive: vi.fn(), restore: vi.fn(), update: vi.fn() },
  members: { add: vi.fn(), leave: vi.fn() },
  sessions: { generate: vi.fn(), cancel: vi.fn(), update: vi.fn() },
  coaches: { list: vi.fn() },
}));
vi.mock("@/lib/services/school", async () => {
  const actual = await vi.importActual<typeof import("@/lib/services/school")>("@/lib/services/school");
  return { ...actual, schoolService: { ...actual.schoolService, ...school } };
});
const adminMock = vi.hoisted(() => ({ courts: { list: vi.fn() } }));
vi.mock("@/lib/services/admin", () => ({ adminService: adminMock }));

import GrupoEscuelaPage from "../../../app/(admin)/mi-club/escuela/grupos/[id]/page";

// «Ahora» de los tests: miércoles 18 de noviembre de 2026
const NOW = new Date("2026-11-18T10:00:00.000Z");

/** Una clase de las 18:00 de Madrid (17:00Z en noviembre) del día dado (en noviembre-diciembre de 2026). */
const session = (id: string, day: string, over: Record<string, unknown> = {}) => ({
  id, slotId: "s1", startsAt: `${day}T17:00:00.000Z`, endsAt: `${day}T18:00:00.000Z`,
  status: "SCHEDULED", cancelReason: null,
  court: { id: "p1", name: "Pista 1" }, attendanceCount: 0, ...over,
});

const member = (id: string, name: string, leftAt: string | null = null) => ({
  id, clubCustomerId: `cc-${id}`, name, joinedAt: "2026-09-14T08:00:00.000Z", leftAt,
});

const GROUP = {
  id: "g1", clubId: "c1", name: "Iniciación", level: null, maxStudents: 3,
  startDate: "2026-09-14", endDate: "2027-06-18", notes: "Traer palas", archivedAt: null,
  createdAt: "2026-09-01T00:00:00Z",
  coach: { staffId: "st1", userId: "u1", name: "Marta Prueba" },
  slots: [{ id: "s1", weekday: 1, startTime: "18:00", durationMinutes: 60, preferredCourtId: null }],
  activeStudents: 2,
  members: [member("m1", "Ana Prueba"), member("m2", "Beto Prueba"), member("m3", "Carla Baja", "2026-10-01T08:00:00.000Z")],
  sessions: [
    session("past1", "2026-11-11", { attendanceCount: 2 }),
    session("past2", "2026-11-04"),
    session("next1", "2026-11-25"),
    session("next2", "2026-12-02", { court: null }),
    session("next3", "2026-12-09", { status: "CANCELLED", cancelReason: "Festivo", court: null }),
  ],
};

async function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  // `use(params)` suspende hasta que se resuelve la promesa: dentro de act
  await act(async () => {
    render(
      <QueryClientProvider client={qc}>
        <Suspense fallback={null}>
          <GrupoEscuelaPage params={Promise.resolve({ id: "g1" })} />
        </Suspense>
      </QueryClientProvider>,
    );
  });
}

const WAIT = { timeout: 5000 };

beforeAll(() => {
  // Solo el reloj: los temporizadores siguen siendo los de verdad (findBy, React Query)
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterAll(() => vi.useRealTimers());

describe("Escuela: ficha del grupo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    access.write = true;
    school.groups.get.mockResolvedValue(GROUP);
    school.coaches.list.mockResolvedValue([]);
    adminMock.courts.list.mockResolvedValue([
      { id: "p1", name: "Pista 1", active: true },
      { id: "p2", name: "Pista 2", active: true },
    ]);
  });

  it("quien se dio de baja y volvió tiene un periodo nuevo: sale una vez entre los activos y su periodo anterior, con sus fechas, en las bajas", async () => {
    school.groups.get.mockResolvedValue({
      ...GROUP,
      activeStudents: 1,
      members: [
        { ...member("m1", "Ana Prueba", "2026-10-01T08:00:00.000Z") },
        { ...member("m4", "Ana Prueba"), joinedAt: "2026-11-10T08:00:00.000Z" },
      ],
    });
    await renderPage();
    const students = await screen.findByRole("region", { name: "Alumnos" }, WAIT);
    expect(within(students).getByText("1 de 3 plazas")).toBeInTheDocument();
    expect(within(students).getByText(/desde 10 nov 2026/)).toBeInTheDocument();
    expect(within(students).getByText("Bajas (1)")).toBeInTheDocument();
    expect(within(students).getByText(/desde 14 sept 2026 · baja el 1 oct 2026/)).toBeInTheDocument();
  });

  it("enseña los datos, los alumnos con sus bajas y las clases próximas con su pista", async () => {
    await renderPage();
    expect(await screen.findByText("Marta Prueba", {}, WAIT)).toBeInTheDocument();
    expect(screen.getByText("Lunes 18:00–19:00")).toBeInTheDocument();
    expect(screen.getByText("Traer palas")).toBeInTheDocument();

    const students = screen.getByRole("region", { name: "Alumnos" });
    expect(within(students).getByText("2 de 3 plazas")).toBeInTheDocument();
    expect(within(students).getByText("Ana Prueba")).toBeInTheDocument();
    expect(within(students).getByText("Bajas (1)")).toBeInTheDocument();

    const sessions = screen.getByRole("region", { name: "Clases" });
    // Tres por delante (una cancelada), una de ellas sin pista
    expect(within(sessions).getByText("3 próximas")).toBeInTheDocument();
    expect(within(sessions).getByText("1 sin pista")).toBeInTheDocument();
    // La hora es la de pared del club (las 17:00 UTC de noviembre son las 18:00 en Madrid)
    expect(within(sessions).getByText(/25 nov · 18:00–19:00/)).toBeInTheDocument();
    expect(within(sessions).getByText("Pista 1")).toBeInTheDocument();
    expect(within(sessions).getAllByText("Sin pista").length).toBe(1);
    expect(within(sessions).getByText("Cancelada: Festivo")).toBeInTheDocument();
    // De días que no han llegado no se pasa lista
    expect(within(sessions).queryByText("Pasar lista")).not.toBeInTheDocument();
    // Pero sí se abre su ficha (ausencias y recuperaciones): una por clase no cancelada
    expect(within(sessions).getAllByRole("link", { name: "Abrir clase" }).length).toBe(2);
  });

  it("un alumno menor lleva el distintivo «Menor» y el nombre y el teléfono de su tutor; el mayor, nada de eso", async () => {
    school.groups.get.mockResolvedValue({
      ...GROUP,
      members: [
        { ...member("m1", "Ana Prueba"), birthDate: "1990-05-05", age: 36, isMinor: false, guardianName: null, guardianPhone: null },
        {
          ...member("m2", "Beto Prueba"),
          birthDate: "2014-06-30", age: 12, isMinor: true, guardianName: "Marta Tutora", guardianPhone: "600 000 001",
        },
        { ...member("m4", "Dani Sin Tutor"), birthDate: "2016-01-10", age: 10, isMinor: true, guardianName: null, guardianPhone: null },
      ],
    });
    await renderPage();
    await screen.findByText("Marta Prueba", {}, WAIT);

    const students = screen.getByRole("region", { name: "Alumnos" });
    const rowOf = (name: string) => within(within(students).getByText(name).closest("li") as HTMLElement);

    expect(rowOf("Ana Prueba").queryByText("Menor")).not.toBeInTheDocument();
    expect(rowOf("Ana Prueba").queryByText(/Tutor:/)).not.toBeInTheDocument();

    expect(rowOf("Beto Prueba").getByText("Menor")).toHaveAttribute("title", "12 años");
    expect(rowOf("Beto Prueba").getByText(/Tutor: Marta Tutora/)).toBeInTheDocument();
    expect(rowOf("Beto Prueba").getByRole("link", { name: "600 000 001" })).toHaveAttribute("href", "tel:600000001");

    // Un menor sin tutor apuntado lo avisa, no calla
    expect(rowOf("Dani Sin Tutor").getByText("Menor")).toBeInTheDocument();
    expect(rowOf("Dani Sin Tutor").getByText(/Sin tutor apuntado/)).toBeInTheDocument();
  });

  it("las pasadas llevan a pasar lista (o a ver la ya pasada)", async () => {
    await renderPage();
    await screen.findByText("Marta Prueba", {}, WAIT);
    fireEvent.click(screen.getByRole("tab", { name: "Pasadas (2)" }));
    const link = (await screen.findByText("Ver lista")).closest("a");
    expect(link).toHaveAttribute("href", "/mi-club/escuela/clases/past1");
    expect(screen.getByText("Pasar lista").closest("a")).toHaveAttribute("href", "/mi-club/escuela/clases/past2");
  });

  it("apunta a un cliente del club al grupo", async () => {
    school.members.add.mockResolvedValue(member("m9", "Nuria Nueva"));
    await renderPage();
    await screen.findByText("Marta Prueba", {}, WAIT);
    fireEvent.click(screen.getByRole("button", { name: "Elegir cliente" }));
    await waitFor(() => expect(school.members.add).toHaveBeenCalledWith("c1", "g1", "cc-9"), WAIT);
  });

  it("con el grupo completo no se ofrece apuntar a nadie más", async () => {
    school.groups.get.mockResolvedValue({ ...GROUP, maxStudents: 2 });
    await renderPage();
    expect(await screen.findByText(/El grupo está completo/, {}, WAIT)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Elegir cliente" })).not.toBeInTheDocument();
  });

  it("la baja pide confirmación y no borra al alumno", async () => {
    school.members.leave.mockResolvedValue(member("m1", "Ana Prueba", "2026-11-18T08:00:00.000Z"));
    await renderPage();
    await screen.findByText("Marta Prueba", {}, WAIT);
    fireEvent.click(screen.getByRole("button", { name: "Dar de baja a Ana Prueba" }));
    expect(school.members.leave).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Dar de baja" }));
    await waitFor(() => expect(school.members.leave).toHaveBeenCalledWith("c1", "g1", "m1"), WAIT);
  });

  it("regenerar las clases pide confirmación y avisa de lo que se ha hecho, también de las que se quedan sin pista", async () => {
    school.sessions.generate.mockResolvedValue({ created: 30, withoutCourt: 2, skippedClosedDays: 0, skippedOutsideHours: 0, removed: 28 });
    await renderPage();
    await screen.findByText("Marta Prueba", {}, WAIT);
    fireEvent.click(screen.getByRole("button", { name: "Regenerar clases" }));
    expect(school.sessions.generate).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/las que hayas movido o cambiado de pista a mano/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Regenerar clases" }));

    await waitFor(() => expect(school.sessions.generate).toHaveBeenCalledWith("c1", "g1"), WAIT);
    await waitFor(() => expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining("2 sin pista libre")), WAIT);
  });

  it("sin clases, se generan directamente", async () => {
    school.groups.get.mockResolvedValue({ ...GROUP, sessions: [] });
    school.sessions.generate.mockResolvedValue({ created: 38, withoutCourt: 0, skippedClosedDays: 0, skippedOutsideHours: 0, removed: 0 });
    await renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Generar clases de la temporada" }, WAIT));
    await waitFor(() => expect(school.sessions.generate).toHaveBeenCalledWith("c1", "g1"), WAIT);
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("Se han creado 38 clases"));
  });

  it("cancelar una clase pide el motivo y libera su pista; las que ya tienen asistencia no se pueden cancelar", async () => {
    school.sessions.cancel.mockResolvedValue({ recoveries: { granted: 0, returned: 0 } });
    await renderPage();
    await screen.findByText("Marta Prueba", {}, WAIT);
    const sessions = screen.getByRole("region", { name: "Clases" });
    const cancelButtons = within(sessions).getAllByRole("button", { name: /^Cancelar la clase del/ });
    // Las dos próximas que siguen programadas: la cancelada no ofrece nada
    expect(cancelButtons).toHaveLength(2);

    fireEvent.click(cancelButtons[0]);
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByPlaceholderText(/Lluvia/), { target: { value: " Obras " } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar clase" }));
    // Por defecto, los alumnos ganan una recuperación
    await waitFor(() => expect(school.sessions.cancel).toHaveBeenCalledWith("c1", "next1", "Obras", true), WAIT);
  });

  it("cancelar sin marcar «Dar recuperación a los alumnos» lo manda desmarcado y cuenta lo devuelto", async () => {
    school.sessions.cancel.mockResolvedValue({ recoveries: { granted: 0, returned: 1 } });
    await renderPage();
    await screen.findByText("Marta Prueba", {}, WAIT);
    const sessions = screen.getByRole("region", { name: "Clases" });
    fireEvent.click(within(sessions).getAllByRole("button", { name: /^Cancelar la clase del/ })[0]);
    const dialog = await screen.findByRole("dialog");
    const grant = within(dialog).getByRole("checkbox", { name: /Dar recuperación a los alumnos/ });
    expect(grant).toBeChecked();
    fireEvent.click(grant);
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar clase" }));
    await waitFor(() => expect(school.sessions.cancel).toHaveBeenCalledWith("c1", "next1", undefined, false), WAIT);
    await waitFor(
      () => expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("1 recuperación devuelta")),
      WAIT,
    );
  });

  it("cambiar la pista de una clase manda solo lo que cambia; si el back dice que está ocupada, lo enseña", async () => {
    school.sessions.update.mockRejectedValueOnce({
      response: { data: { message: "La pista ya está ocupada a esa hora (una reserva)" } },
    });
    await renderPage();
    await screen.findByText("Marta Prueba", {}, WAIT);
    const sessions = screen.getByRole("region", { name: "Clases" });
    fireEvent.click(within(sessions).getAllByRole("button", { name: /^Cambiar la clase del/ })[0]);

    const dialog = await screen.findByRole("dialog", { name: "Cambiar la clase" });
    // Sin cambiar nada, no se manda
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("No has cambiado nada"), WAIT);
    expect(school.sessions.update).not.toHaveBeenCalled();

    await waitFor(() => expect(within(dialog).getByRole("option", { name: "Pista 2" })).toBeInTheDocument(), WAIT);
    fireEvent.change(within(dialog).getByLabelText("Pista"), { target: { value: "p2" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(school.sessions.update).toHaveBeenCalledWith("c1", "next1", { courtId: "p2" }), WAIT);
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("La pista ya está ocupada a esa hora (una reserva)"),
    WAIT);
    // El diálogo sigue abierto para probar con otra
    expect(screen.getByRole("dialog", { name: "Cambiar la clase" })).toBeInTheDocument();
  });

  it("dejar una clase sin pista manda courtId null", async () => {
    school.sessions.update.mockResolvedValue({});
    await renderPage();
    await screen.findByText("Marta Prueba", {}, WAIT);
    const sessions = screen.getByRole("region", { name: "Clases" });
    fireEvent.click(within(sessions).getAllByRole("button", { name: /^Cambiar la clase del/ })[0]);
    const dialog = await screen.findByRole("dialog", { name: "Cambiar la clase" });
    fireEvent.change(within(dialog).getByLabelText("Pista"), { target: { value: "" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(school.sessions.update).toHaveBeenCalledWith("c1", "next1", { courtId: null }), WAIT);
  });

  it("archivar pide confirmación; un grupo archivado se restaura y no deja apuntar ni editar", async () => {
    school.groups.archive.mockResolvedValue({});
    await renderPage();
    await screen.findByText("Marta Prueba", {}, WAIT);
    fireEvent.click(screen.getByRole("button", { name: "Archivar" }));
    fireEvent.click(await screen.findByRole("button", { name: "Archivar grupo" }));
    await waitFor(() => expect(school.groups.archive).toHaveBeenCalledWith("c1", "g1"), WAIT);
  });

  it("un grupo archivado: se puede restaurar, pero no editar ni apuntar", async () => {
    school.groups.get.mockResolvedValue({ ...GROUP, archivedAt: "2026-11-01T00:00:00Z" });
    school.groups.restore.mockResolvedValue({});
    await renderPage();
    expect(await screen.findByText("Archivado", {}, WAIT)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Editar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Elegir cliente" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Regenerar clases" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Restaurar" }));
    await waitFor(() => expect(school.groups.restore).toHaveBeenCalledWith("c1", "g1"), WAIT);
  });

  it("quien solo lee (entrenador): ve el grupo y pasa lista, sin cambiar nada", async () => {
    access.write = false;
    await renderPage();
    await screen.findByText("Marta Prueba", {}, WAIT);
    expect(screen.queryByRole("button", { name: /Editar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Archivar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Regenerar clases" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Elegir cliente" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Dar de baja/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Cancelar la clase/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Cambiar la clase/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Pasadas (2)" }));
    expect(await screen.findByText("Ver lista")).toBeInTheDocument();
  });
});

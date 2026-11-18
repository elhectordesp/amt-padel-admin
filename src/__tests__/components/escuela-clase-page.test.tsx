/**
 * Pasar lista de una clase de la escuela: cada alumno presente, ausente o
 * justificado; se guarda lo cambiado; no se pasa lista de un día que no ha
 * llegado ni de una clase cancelada.
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
const access = vi.hoisted(() => ({ write: false }));
vi.mock("@/lib/use-club-access", () => ({
  useClubAccess: () => ({ roles: null, can: (_a: string, level = "read") => level === "read" || access.write }),
}));
const recovery = vi.hoisted(() => ({ config: { get: vi.fn() } }));
vi.mock("@/lib/services/school-recovery", async () => {
  const actual = await vi.importActual<typeof import("@/lib/services/school-recovery")>("@/lib/services/school-recovery");
  return { ...actual, schoolRecoveryService: { ...actual.schoolRecoveryService, ...recovery } };
});
vi.mock("@/lib/use-club-time-zone", () => ({
  useClubTimeZone: () => ({ timeZone: "Europe/Madrid", isError: false, refetch: vi.fn() }),
}));
const school = vi.hoisted(() => ({
  sessions: { sheet: vi.fn(), setAttendance: vi.fn() },
}));
vi.mock("@/lib/services/school", async () => {
  const actual = await vi.importActual<typeof import("@/lib/services/school")>("@/lib/services/school");
  return { ...actual, schoolService: { ...actual.schoolService, ...school } };
});

import ClaseEscuelaPage from "../../../app/(admin)/mi-club/escuela/clases/[id]/page";

// «Ahora»: miércoles 18 de noviembre de 2026, 11:00 en Madrid
const NOW = new Date("2026-11-18T10:00:00.000Z");

/** Un alumno de la hoja, sin aviso de ausencia ni recuperación. */
const student0 = (clubCustomerId: string, name: string, status: string | null, over: Record<string, unknown> = {}) => ({
  clubCustomerId, name, status, noticedAt: null, earnedCreditId: null, recovery: false, usedCreditId: null, ...over,
});

const sheet = (over: Record<string, unknown> = {}, sessionOver: Record<string, unknown> = {}) => ({
  session: {
    id: "ses1", groupId: "g1", slotId: "s1", startsAt: "2026-11-18T17:00:00.000Z", endsAt: "2026-11-18T18:00:00.000Z",
    status: "SCHEDULED", cancelReason: null, court: { id: "p1", name: "Pista 2" }, attendanceCount: 0, ...sessionOver,
  },
  group: { id: "g1", name: "Iniciación" },
  students: [
    student0("cc1", "Ana Prueba", null),
    student0("cc2", "Beto Prueba", "PRESENT"),
    student0("cc3", "Carla Prueba", null),
  ],
  capacity: { maxStudents: 8, freeSpots: 5 },
  ...over,
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

const WAIT = { timeout: 5000 };

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});
afterAll(() => vi.useRealTimers());

const student = (name: string) => screen.getByRole("group", { name: `Asistencia de ${name}` });

describe("Escuela: pasar lista", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    access.write = false;
    recovery.config.get.mockResolvedValue({ recoveryNoticeHours: 24, recoveryValidDays: 60 });
    school.sessions.sheet.mockResolvedValue(sheet());
  });

  it("enseña la clase, sus alumnos y lo ya apuntado", async () => {
    await renderPage();
    expect(await screen.findByText("Iniciación", {}, WAIT)).toBeInTheDocument();
    expect(screen.getByText(/18:00–19:00 · Pista 2/)).toBeInTheDocument();
    expect(within(student("Beto Prueba")).getByRole("button", { name: "Presente" })).toHaveAttribute("aria-pressed", "true");
    expect(within(student("Ana Prueba")).getByRole("button", { name: "Presente" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText(/1 presentes · 0 ausentes · 0 justificadas · 2 sin apuntar/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Volver a Iniciación/ })).toHaveAttribute("href", "/mi-club/escuela/grupos/g1");
  });

  it("guarda solo lo que se ha cambiado", async () => {
    school.sessions.setAttendance.mockResolvedValue(
      sheet({
        students: [
          student0("cc1", "Ana Prueba", "ABSENT"),
          student0("cc2", "Beto Prueba", "PRESENT"),
          student0("cc3", "Carla Prueba", "EXCUSED"),
        ],
      }),
    );
    await renderPage();
    await screen.findByText("Iniciación", {}, WAIT);

    const save = screen.getByRole("button", { name: "Guardar asistencia" });
    expect(save).toBeDisabled();
    fireEvent.click(within(student("Ana Prueba")).getByRole("button", { name: "Ausente" }));
    fireEvent.click(within(student("Carla Prueba")).getByRole("button", { name: "Justificada" }));
    expect(screen.getByText(/1 presentes · 1 ausentes · 1 justificadas · 0 sin apuntar/)).toBeInTheDocument();
    fireEvent.click(save);

    await waitFor(
      () =>
        expect(school.sessions.setAttendance).toHaveBeenCalledWith("c1", "ses1", [
          { clubCustomerId: "cc1", status: "ABSENT" },
          { clubCustomerId: "cc3", status: "EXCUSED" },
        ]),
      WAIT,
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Asistencia guardada"), WAIT);
    // Lo guardado pasa a ser lo de servidor: ya no hay nada pendiente
    await waitFor(() => expect(screen.getByRole("button", { name: "Guardar asistencia" })).toBeDisabled(), WAIT);
  });

  it("Marcar todos presentes cambia solo a los que no lo estaban", async () => {
    school.sessions.setAttendance.mockResolvedValue(sheet());
    await renderPage();
    await screen.findByText("Iniciación", {}, WAIT);
    fireEvent.click(screen.getByRole("button", { name: /Marcar todos presentes/ }));
    expect(screen.getByText(/3 presentes · 0 ausentes · 0 justificadas · 0 sin apuntar/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Guardar asistencia" }));
    await waitFor(
      () =>
        expect(school.sessions.setAttendance).toHaveBeenCalledWith("c1", "ses1", [
          { clubCustomerId: "cc1", status: "PRESENT" },
          { clubCustomerId: "cc3", status: "PRESENT" },
        ]),
      WAIT,
    );
  });

  it("si el back lo rechaza (otro entrenador), enseña su mensaje y deja lo escrito", async () => {
    school.sessions.setAttendance.mockRejectedValue({
      response: { data: { message: "Solo el entrenador del grupo puede pasar lista de esta clase." } },
    });
    await renderPage();
    await screen.findByText("Iniciación", {}, WAIT);
    fireEvent.click(within(student("Ana Prueba")).getByRole("button", { name: "Presente" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar asistencia" }));
    await waitFor(
      () => expect(toast.error).toHaveBeenCalledWith("Solo el entrenador del grupo puede pasar lista de esta clase."),
      WAIT,
    );
    expect(within(student("Ana Prueba")).getByRole("button", { name: "Presente" })).toHaveAttribute("aria-pressed", "true");
  });

  it("de una clase de un día que no ha llegado no se pasa lista", async () => {
    school.sessions.sheet.mockResolvedValue(
      sheet({}, { startsAt: "2026-11-25T17:00:00.000Z", endsAt: "2026-11-25T18:00:00.000Z" }),
    );
    await renderPage();
    expect(await screen.findByRole("status", {}, WAIT)).toHaveTextContent("Aún no es el día de la clase");
    expect(within(student("Ana Prueba")).getByRole("button", { name: "Presente" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Guardar asistencia" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Marcar todos presentes/ })).not.toBeInTheDocument();
  });

  it("de una clase cancelada tampoco", async () => {
    school.sessions.sheet.mockResolvedValue(sheet({}, { status: "CANCELLED", court: null }));
    await renderPage();
    expect(await screen.findByRole("status", {}, WAIT)).toHaveTextContent("La clase está cancelada");
    expect(screen.queryByRole("button", { name: "Guardar asistencia" })).not.toBeInTheDocument();
  });

  it("sin alumnos en la lista, lo dice", async () => {
    school.sessions.sheet.mockResolvedValue(sheet({ students: [] }));
    await renderPage();
    expect(await screen.findByText(/no tiene alumnos en la lista/, {}, WAIT)).toBeInTheDocument();
  });
});

/**
 * Bandeja de la escuela: lo que el entrenador apunta y recepción decide. El
 * gestor ve las pendientes con su contador, acepta (con lo que eso hace según
 * el tipo) y rechaza con motivo; el entrenador solo apunta y ve las suyas.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
vi.mock("@/components/admin/booking-customer-picker", () => ({
  BookingCustomerPicker: ({ onChange }: { onChange: (c: unknown) => void }) => (
    <button onClick={() => onChange({ id: "cc-9", name: "Nuria Nueva" })}>Elegir cliente</button>
  ),
}));

const recovery = vi.hoisted(() => ({
  requests: { list: vi.fn(), create: vi.fn(), accept: vi.fn(), reject: vi.fn() },
}));
vi.mock("@/lib/services/school-recovery", async () => {
  const actual = await vi.importActual<typeof import("@/lib/services/school-recovery")>("@/lib/services/school-recovery");
  return { ...actual, schoolRecoveryService: { ...actual.schoolRecoveryService, ...recovery } };
});
const school = vi.hoisted(() => ({ groups: { list: vi.fn(), get: vi.fn() } }));
vi.mock("@/lib/services/school", async () => {
  const actual = await vi.importActual<typeof import("@/lib/services/school")>("@/lib/services/school");
  return { ...actual, schoolService: { ...actual.schoolService, ...school } };
});

import { SchoolInboxSection } from "@/components/admin/school-inbox-section";

// «Ahora»: miércoles 18 de noviembre de 2026, 11:00 en Madrid
const NOW = new Date("2026-11-18T10:00:00.000Z");
const WAIT = { timeout: 5000 };
const TZ = "Europe/Madrid";

const request = (over: Record<string, unknown> = {}) => ({
  id: "r1", kind: "JOIN_GROUP", status: "PENDING",
  clubCustomerId: null, customerName: null, contactName: "Laura Prueba", contactPhone: "600000000",
  group: { id: "g1", name: "Iniciación" }, session: null, coach: null,
  message: "Quiere probar el jueves", createdBy: "Marta Prueba", createdAt: "2026-11-17T18:30:00.000Z",
  resolvedBy: null, resolvedAt: null, resolutionNote: null,
  ...over,
});

const ABSENCE = request({
  id: "r2", kind: "ABSENCE", clubCustomerId: "cc-1", customerName: "Ana Prueba", contactName: null, contactPhone: null,
  group: { id: "g1", name: "Iniciación" },
  session: { id: "ses1", startsAt: "2026-11-23T17:00:00.000Z", groupName: "Iniciación" },
  message: null,
});

function renderSection(opts: { canWrite?: boolean; canPickCustomer?: boolean } = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <SchoolInboxSection
        clubId="c1"
        timeZone={TZ}
        canWrite={opts.canWrite ?? true}
        canPickCustomer={opts.canPickCustomer ?? true}
      />
    </QueryClientProvider>,
  );
}

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});
afterAll(() => vi.useRealTimers());

describe("Escuela: bandeja", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    recovery.requests.list.mockImplementation((_club: string, status: string) =>
      Promise.resolve(
        status === "PENDING"
          ? [request(), ABSENCE]
          : [
              request({
                id: "r3", kind: "OTHER", status: "REJECTED", contactName: "Pedro Prueba", group: null, message: null,
                resolvedBy: "Gestor Prueba", resolvedAt: "2026-11-17T20:00:00.000Z", resolutionNote: "Sin plazas",
              }),
            ],
      ),
    );
  });

  it("el gestor ve las pendientes con su contador, el tipo, quién, el grupo y quién las apuntó", async () => {
    renderSection();
    expect(await screen.findByText("Laura Prueba", {}, WAIT)).toBeInTheDocument();
    expect(screen.getByLabelText("2 pendientes")).toBeInTheDocument();
    expect(screen.getByText("Alta en un grupo")).toBeInTheDocument();
    // Las dos (el alta y la ausencia) son de ese grupo
    expect(screen.getAllByText("Grupo: Iniciación")).toHaveLength(2);
    expect(screen.getByText("Quiere probar el jueves")).toBeInTheDocument();
    expect(screen.getAllByText(/Apuntada por Marta Prueba el 17 nov, 19:30/)).toHaveLength(2);
    // La ausencia lleva la clase y el nombre del cliente
    expect(screen.getByText("Ana Prueba")).toBeInTheDocument();
    expect(screen.getByText(/Clase: Iniciación, lun, 23 nov/)).toBeInTheDocument();
    expect(recovery.requests.list).toHaveBeenCalledWith("c1", "PENDING");
    // El historial no se pide hasta que se abre
    expect(recovery.requests.list).not.toHaveBeenCalledWith("c1", "RESOLVED");
  });

  it("sin pendientes, lo dice", async () => {
    recovery.requests.list.mockResolvedValue([]);
    renderSection();
    expect(await screen.findByText("No hay solicitudes pendientes.", {}, WAIT)).toBeInTheDocument();
  });

  it("el historial enseña quién resolvió cada una, cuándo y con qué motivo", async () => {
    renderSection();
    await screen.findByText("Laura Prueba", {}, WAIT);
    fireEvent.click(screen.getByRole("button", { name: "Ver historial" }));
    const history = await screen.findByRole("list", { name: "Historial de solicitudes" }, WAIT);
    expect(within(history).getByText("Pedro Prueba")).toBeInTheDocument();
    expect(within(history).getByText("Rechazada")).toBeInTheDocument();
    expect(within(history).getByText(/rechazada por Gestor Prueba/)).toBeInTheDocument();
    expect(within(history).getByText(/Sin plazas/)).toBeInTheDocument();
    // Lo resuelto no se vuelve a abrir: sin botones
    expect(within(history).queryByRole("button")).not.toBeInTheDocument();
    expect(recovery.requests.list).toHaveBeenCalledWith("c1", "RESOLVED");
  });

  it("el entrenador no resuelve: sin Aceptar ni Rechazar, pero sí Nueva solicitud", async () => {
    renderSection({ canWrite: false, canPickCustomer: false });
    await screen.findByText("Laura Prueba", {}, WAIT);
    expect(screen.queryByRole("button", { name: /^Aceptar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Rechazar/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Nueva solicitud/ })).toBeInTheDocument();
  });

  it("aceptar un alta de quien aún no es cliente pide su ficha y la manda", async () => {
    recovery.requests.accept.mockResolvedValue(request({ status: "ACCEPTED" }));
    renderSection();
    await screen.findByText("Laura Prueba", {}, WAIT);
    fireEvent.click(screen.getByRole("button", { name: "Aceptar la solicitud de Laura Prueba" }));

    const dialog = await screen.findByRole("dialog", { name: "Aceptar la solicitud" });
    expect(within(dialog).getByText(/Se apuntará a Laura Prueba al grupo Iniciación/)).toBeInTheDocument();
    const accept = within(dialog).getByRole("button", { name: "Aceptar" });
    expect(accept).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Elegir cliente" }));
    expect(accept).toBeEnabled();
    fireEvent.click(accept);

    await waitFor(() => expect(recovery.requests.accept).toHaveBeenCalledWith("c1", "r1", { clubCustomerId: "cc-9" }), WAIT);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Laura Prueba se ha apuntado al grupo"), WAIT);
  });

  it("aceptar una ausencia explica que avisa con la hora de la solicitud y no pide cliente", async () => {
    recovery.requests.accept.mockResolvedValue({ ...ABSENCE, status: "ACCEPTED" });
    renderSection();
    await screen.findByText("Ana Prueba", {}, WAIT);
    fireEvent.click(screen.getByRole("button", { name: "Aceptar la solicitud de Ana Prueba" }));

    const dialog = await screen.findByRole("dialog", { name: "Aceptar la solicitud" });
    expect(within(dialog).getByText(/con la hora en que se apuntó la solicitud/)).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Elegir cliente" })).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Aceptar" }));
    await waitFor(() => expect(recovery.requests.accept).toHaveBeenCalledWith("c1", "r2", {}), WAIT);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Ausencia avisada"), WAIT);
  });

  it("si lo que pide no se puede hacer (grupo lleno), enseña el motivo y no la da por aceptada", async () => {
    recovery.requests.accept.mockRejectedValue({ response: { data: { message: "El grupo está completo (8 plazas)" } } });
    renderSection();
    await screen.findByText("Laura Prueba", {}, WAIT);
    fireEvent.click(screen.getByRole("button", { name: "Aceptar la solicitud de Laura Prueba" }));
    const dialog = await screen.findByRole("dialog", { name: "Aceptar la solicitud" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Elegir cliente" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Aceptar" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("El grupo está completo (8 plazas)"), WAIT);
    expect(toast.success).not.toHaveBeenCalled();
    // El diálogo sigue abierto para poder volver o rechazar
    expect(screen.getByRole("dialog", { name: "Aceptar la solicitud" })).toBeInTheDocument();
  });

  it("rechazar manda el motivo (o nada si se deja vacío)", async () => {
    recovery.requests.reject.mockResolvedValue(request({ status: "REJECTED" }));
    renderSection();
    await screen.findByText("Laura Prueba", {}, WAIT);
    fireEvent.click(screen.getByRole("button", { name: "Rechazar la solicitud de Laura Prueba" }));
    const dialog = await screen.findByRole("dialog", { name: "Rechazar la solicitud" });
    fireEvent.change(within(dialog).getByPlaceholderText(/Grupo completo/), { target: { value: " Sin plazas " } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Rechazar" }));
    await waitFor(() => expect(recovery.requests.reject).toHaveBeenCalledWith("c1", "r1", "Sin plazas"), WAIT);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Solicitud rechazada"), WAIT);
  });
});

describe("Escuela: nueva solicitud", () => {
  const groupDetail = {
    id: "g1", name: "Iniciación",
    members: [
      { id: "m1", clubCustomerId: "cc-1", name: "Ana Prueba", joinedAt: "2026-09-14T08:00:00.000Z", leftAt: null },
      { id: "m2", clubCustomerId: "cc-2", name: "Beto Baja", joinedAt: "2026-09-14T08:00:00.000Z", leftAt: "2026-10-01T08:00:00.000Z" },
    ],
    sessions: [
      { id: "past", slotId: "s1", startsAt: "2026-11-16T17:00:00.000Z", endsAt: "2026-11-16T18:00:00.000Z", status: "SCHEDULED", cancelReason: null, court: null, attendanceCount: 0 },
      { id: "ses1", slotId: "s1", startsAt: "2026-11-23T17:00:00.000Z", endsAt: "2026-11-23T18:00:00.000Z", status: "SCHEDULED", cancelReason: null, court: null, attendanceCount: 0 },
      { id: "ses-x", slotId: "s1", startsAt: "2026-11-30T17:00:00.000Z", endsAt: "2026-11-30T18:00:00.000Z", status: "CANCELLED", cancelReason: "Lluvia", court: null, attendanceCount: 0 },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    recovery.requests.list.mockResolvedValue([]);
    recovery.requests.create.mockResolvedValue(request());
    school.groups.list.mockResolvedValue([{ id: "g1", name: "Iniciación" }]);
    school.groups.get.mockResolvedValue(groupDetail);
  });

  async function openDialog(opts: { canWrite?: boolean; canPickCustomer?: boolean } = {}) {
    renderSection(opts);
    await screen.findByText("No hay solicitudes pendientes.", {}, WAIT);
    fireEvent.click(screen.getByRole("button", { name: /Nueva solicitud/ }));
    return screen.findByRole("dialog", { name: "Nueva solicitud" });
  }

  it("el entrenador apunta una ausencia: elige su grupo, una clase futura y un alumno activo", async () => {
    const dialog = await openDialog({ canWrite: false, canPickCustomer: false });
    fireEvent.change(within(dialog).getByLabelText("Tipo de solicitud"), { target: { value: "ABSENCE" } });
    await waitFor(() => expect(within(dialog).getByRole("option", { name: "Iniciación" })).toBeInTheDocument(), WAIT);
    fireEvent.change(within(dialog).getByLabelText("Grupo"), { target: { value: "g1" } });
    await waitFor(() => expect(within(dialog).getByRole("option", { name: /23 nov/ })).toBeInTheDocument(), WAIT);

    // Solo las clases que siguen programadas y por delante; solo alumnos que siguen en el grupo
    expect(within(dialog).queryByRole("option", { name: /16 nov/ })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("option", { name: /30 nov/ })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("option", { name: "Beto Baja" })).not.toBeInTheDocument();

    // Sin elegir clase ni alumno, no se manda
    fireEvent.click(within(dialog).getByRole("button", { name: "Apuntar solicitud" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Elige la clase a la que falta"), WAIT);
    expect(recovery.requests.create).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByLabelText("Clase"), { target: { value: "ses1" } });
    fireEvent.change(within(dialog).getByLabelText("Alumno que falta"), { target: { value: "cc-1" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Apuntar solicitud" }));
    await waitFor(
      () =>
        expect(recovery.requests.create).toHaveBeenCalledWith("c1", {
          kind: "ABSENCE",
          message: null,
          groupId: "g1",
          sessionId: "ses1",
          clubCustomerId: "cc-1",
        }),
      WAIT,
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("Solicitud apuntada")), WAIT);
  });

  it("el entrenador no puede buscar clientes: apunta al que quiere un grupo con nombre y teléfono", async () => {
    const dialog = await openDialog({ canWrite: false, canPickCustomer: false });
    expect(within(dialog).queryByRole("button", { name: "Elegir cliente" })).not.toBeInTheDocument();
    await waitFor(() => expect(within(dialog).getByRole("option", { name: "Iniciación" })).toBeInTheDocument(), WAIT);
    fireEvent.change(within(dialog).getByLabelText("Grupo"), { target: { value: "g1" } });

    fireEvent.click(within(dialog).getByRole("button", { name: "Apuntar solicitud" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Indica quién es (nombre y teléfono)"), WAIT);

    fireEvent.change(within(dialog).getByLabelText("Nombre"), { target: { value: " Laura Prueba " } });
    fireEvent.change(within(dialog).getByLabelText("Teléfono"), { target: { value: "600000000" } });
    fireEvent.change(within(dialog).getByLabelText("Notas (opcional)"), { target: { value: " Quiere probar " } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Apuntar solicitud" }));
    await waitFor(
      () =>
        expect(recovery.requests.create).toHaveBeenCalledWith("c1", {
          kind: "JOIN_GROUP",
          message: "Quiere probar",
          groupId: "g1",
          contactName: "Laura Prueba",
          contactPhone: "600000000",
        }),
      WAIT,
    );
  });

  it("el gestor puede elegir al cliente del club en lugar de escribir su nombre", async () => {
    const dialog = await openDialog();
    await waitFor(() => expect(within(dialog).getByRole("option", { name: "Iniciación" })).toBeInTheDocument(), WAIT);
    fireEvent.change(within(dialog).getByLabelText("Grupo"), { target: { value: "g1" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Elegir cliente" }));
    // Con el cliente elegido ya no hace falta el nombre
    expect(within(dialog).queryByLabelText("Nombre")).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Apuntar solicitud" }));
    await waitFor(
      () =>
        expect(recovery.requests.create).toHaveBeenCalledWith("c1", {
          kind: "JOIN_GROUP",
          message: null,
          groupId: "g1",
          clubCustomerId: "cc-9",
        }),
      WAIT,
    );
  });

  it("«Otra» pide el texto; una clase particular, solo quién", async () => {
    const dialog = await openDialog({ canWrite: false, canPickCustomer: false });
    fireEvent.change(within(dialog).getByLabelText("Tipo de solicitud"), { target: { value: "OTHER" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Apuntar solicitud" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Escribe de qué se trata"), WAIT);
    expect(recovery.requests.create).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByLabelText("Tipo de solicitud"), { target: { value: "PRIVATE_CLASS" } });
    fireEvent.change(within(dialog).getByLabelText("Nombre"), { target: { value: "Pedro Prueba" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Apuntar solicitud" }));
    await waitFor(
      () =>
        expect(recovery.requests.create).toHaveBeenCalledWith("c1", {
          kind: "PRIVATE_CLASS",
          message: null,
          contactName: "Pedro Prueba",
          contactPhone: null,
        }),
      WAIT,
    );
  });

  it("si el back lo rechaza (un grupo que no lleva), enseña el motivo", async () => {
    recovery.requests.create.mockRejectedValue({ response: { data: { message: "Grupo no encontrado" } } });
    const dialog = await openDialog({ canWrite: false, canPickCustomer: false });
    fireEvent.change(within(dialog).getByLabelText("Tipo de solicitud"), { target: { value: "OTHER" } });
    fireEvent.change(within(dialog).getByLabelText("Qué hay que saber"), { target: { value: "Hola" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Apuntar solicitud" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Grupo no encontrado"), WAIT);
  });
});

/**
 * Clases privadas de la escuela: la lista por días con sus alumnos y su cobro,
 * crear una con el precio propuesto por la tarifa del entrenador, cobrar por
 * alumno en el mostrador o con un bono de clases privadas, quitar el cobro y
 * cancelar. Sin acceso de escritura, solo se lee.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
vi.mock("@/lib/use-club-time-zone", () => ({
  useClubTimeZone: () => ({ timeZone: "Europe/Madrid", isError: false, refetch: vi.fn() }),
}));
// El buscador de clientes tiene su propio test: aquí solo importa a quién se añade
vi.mock("@/components/admin/booking-customer-picker", () => ({
  BookingCustomerPicker: ({ onChange }: { onChange: (c: unknown) => void }) => (
    <div>
      <button type="button" onClick={() => onChange({ id: "cc-1", name: "Marta" })}>
        Añadir a Marta
      </button>
      <button type="button" onClick={() => onChange({ id: "cc-2", name: "Pablo" })}>
        Añadir a Pablo
      </button>
    </div>
  ),
}));

const access = vi.hoisted(() => ({ cash: true }));
vi.mock("@/lib/use-club-access", () => ({
  useClubAccess: () => ({ roles: null, can: (area: string) => (area === "cash" ? access.cash : true) }),
}));

const school = vi.hoisted(() => ({ coaches: { list: vi.fn() } }));
vi.mock("@/lib/services/school", async (orig) => {
  const actual = await orig<typeof import("@/lib/services/school")>();
  return { ...actual, schoolService: { ...actual.schoolService, ...school } };
});
const adminMock = vi.hoisted(() => ({ courts: { list: vi.fn() } }));
vi.mock("@/lib/services/admin", () => ({ adminService: adminMock }));
const billing = vi.hoisted(() => ({
  privateClasses: { list: vi.fn(), create: vi.fn(), update: vi.fn(), cancel: vi.fn(), vouchers: vi.fn(), pay: vi.fn(), unpay: vi.fn() },
}));
vi.mock("@/lib/services/school-billing", async (orig) => {
  const actual = await orig<typeof import("@/lib/services/school-billing")>();
  return { ...actual, schoolBillingService: { ...actual.schoolBillingService, ...billing } };
});

import { SchoolPrivateClassesSection } from "@/components/admin/school-private-classes-section";

const student = (over: Record<string, unknown> = {}) => ({
  id: "st1", clubCustomerId: "cc-1", name: "Marta", priceCents: 2000, paymentMethod: null, paidAt: null, paid: false, ...over,
});
const klass = (over: Record<string, unknown> = {}) => ({
  id: "pc1", coachStaffId: "co1", coachName: "Luis", startsAt: "2026-11-23T17:00:00.000Z", endsAt: "2026-11-23T18:00:00.000Z",
  status: "SCHEDULED", cancelReason: null, notes: null, court: { id: "p1", name: "Pista 1" },
  students: [student(), student({ id: "st2", clubCustomerId: "cc-2", name: "Pablo", paymentMethod: "CASH", paidAt: "2026-11-23T18:05:00Z", paid: true })],
  totalCents: 4000, createdAt: "2026-11-20T10:00:00Z", ...over,
});

const COACHES = [
  { staffId: "co1", userId: "u1", name: "Luis", coachBio: null, privateClassRateCents: 4000, groups: [] },
  { staffId: "co2", userId: "u2", name: "Eva", coachBio: null, privateClassRateCents: null, groups: [] },
];
const COURTS = [
  { id: "p1", name: "Pista 1", active: true },
  { id: "p2", name: "Pista 2", active: true },
];

function renderSection(canWrite = true) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <SchoolPrivateClassesSection clubId="c1" canWrite={canWrite} />
    </QueryClientProvider>,
  );
}

const WAIT = { timeout: 5000 };

describe("SchoolPrivateClassesSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    access.cash = true;
    // «Hoy» es el 18 de noviembre de 2026
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-18T10:00:00Z"));
    billing.privateClasses.list.mockResolvedValue([klass()]);
    billing.privateClasses.create.mockResolvedValue(klass());
    billing.privateClasses.update.mockResolvedValue(klass());
    billing.privateClasses.cancel.mockResolvedValue(klass({ status: "CANCELLED" }));
    billing.privateClasses.vouchers.mockResolvedValue([]);
    billing.privateClasses.pay.mockResolvedValue(klass());
    billing.privateClasses.unpay.mockResolvedValue(klass());
    school.coaches.list.mockResolvedValue(COACHES);
    adminMock.courts.list.mockResolvedValue(COURTS);
  });
  afterEach(() => vi.useRealTimers());

  it("lista del día de hoy a dentro de una semana, por días, con la pista, el entrenador y el cobro de cada alumno", async () => {
    renderSection();
    expect(await screen.findByText("Marta", {}, WAIT)).toBeInTheDocument();
    expect(billing.privateClasses.list).toHaveBeenCalledWith("c1", "2026-11-18", "2026-11-24");
    expect(screen.getByRole("heading", { name: "Lunes, 23 de noviembre" })).toBeInTheDocument();
    expect(screen.getByText(/lun, 23 nov · 18:00–19:00/)).toBeInTheDocument();
    expect(screen.getByText("Pista 1")).toBeInTheDocument();
    expect(screen.getByText(/Entrenador: Luis · 1 de 2 cobrados/)).toBeInTheDocument();
    expect(screen.getByText(/20,00 € · Pendiente/)).toBeInTheDocument();
    expect(screen.getByText(/20,00 € · Cobrado · Efectivo/)).toBeInTheDocument();
  });

  it("sin acceso a la caja (el entrenador) no se ve lo que paga cada alumno", async () => {
    access.cash = false;
    renderSection(false);
    expect(await screen.findByText("Marta", {}, WAIT)).toBeInTheDocument();
    expect(screen.queryByText(/20,00 €/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Pendiente/)).not.toBeInTheDocument();
    expect(screen.queryByText(/cobrados/)).not.toBeInTheDocument();
  });

  it("el entrenador recibe la clase sin precios ni cobros y el listado no se rompe", async () => {
    access.cash = false;
    billing.privateClasses.list.mockResolvedValue([
      {
        id: "pc1", coachStaffId: "s1", coachName: "Luis", startsAt: "2026-11-23T17:00:00.000Z",
        endsAt: "2026-11-23T18:00:00.000Z", status: "SCHEDULED", cancelReason: null, notes: null,
        court: { id: "c1", name: "Pista 1" }, createdAt: "2026-11-20T10:00:00.000Z",
        students: [{ id: "st1", clubCustomerId: "cc1", name: "Marta" }],
      },
    ]);
    renderSection(false);
    expect(await screen.findByText("Marta", {}, WAIT)).toBeInTheDocument();
    expect(screen.queryByText(/NaN|undefined|cobrados/)).not.toBeInTheDocument();
  });

  it("cambiar el rango pide esos días; un rango del revés no pide nada", async () => {
    renderSection();
    await screen.findByText("Marta", {}, WAIT);
    fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "2026-12-01" } });
    await waitFor(() => expect(billing.privateClasses.list).toHaveBeenCalledWith("c1", "2026-11-18", "2026-12-01"), WAIT);

    billing.privateClasses.list.mockClear();
    fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "2026-11-01" } });
    expect(await screen.findByText("El rango no puede acabar antes de empezar.", {}, WAIT)).toBeInTheDocument();
    expect(billing.privateClasses.list).not.toHaveBeenCalled();
  });

  it("sin clases, lo dice", async () => {
    billing.privateClasses.list.mockResolvedValue([]);
    renderSection();
    expect(await screen.findByText("No hay clases privadas en estos días.", {}, WAIT)).toBeInTheDocument();
  });

  it("cobrar a un alumno en el mostrador: método de la lista", async () => {
    renderSection();
    await screen.findByText("Marta", {}, WAIT);
    fireEvent.click(screen.getByRole("button", { name: "Cobrar a Marta" }));
    const dialog = await screen.findByRole("dialog", { name: "Cobrar clase privada" });
    expect(within(dialog).getByText(/Marta · lun, 23 nov · 18:00–19:00/)).toBeInTheDocument();
    const confirm = within(dialog).getByRole("button", { name: "Cobrar" });
    expect(confirm).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Tarjeta" }));
    fireEvent.click(confirm);
    await waitFor(
      () => expect(billing.privateClasses.pay).toHaveBeenCalledWith("c1", "pc1", "st1", { paymentMethod: "CARD" }),
      WAIT,
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Clase cobrada"), WAIT);
    // En el mostrador no se piden bonos
    expect(billing.privateClasses.vouchers).not.toHaveBeenCalled();
  });

  it("cobrar con un bono: lista los bonos de clases privadas del alumno y gasta el elegido", async () => {
    billing.privateClasses.vouchers.mockResolvedValue([
      {
        id: "v1", name: "Bono 8 clases", kind: "PRIVATE_CLASS", sessions: 8, remainingSessions: 5, paid: true,
        expiresAt: "2026-12-18T22:59:59.999Z",
      },
    ]);
    renderSection();
    await screen.findByText("Marta", {}, WAIT);
    fireEvent.click(screen.getByRole("button", { name: "Cobrar a Marta" }));
    const dialog = await screen.findByRole("dialog", { name: "Cobrar clase privada" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Con bono" }));

    expect(await within(dialog).findByText("Bono 8 clases", {}, WAIT)).toBeInTheDocument();
    expect(billing.privateClasses.vouchers).toHaveBeenCalledWith("c1", "pc1", "st1");
    expect(within(dialog).getByText(/5 de 8 sesiones · Caduca el 18\/12\/2026/)).toBeInTheDocument();
    const confirm = within(dialog).getByRole("button", { name: "Pagar con bono" });
    expect(confirm).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("radio"));
    fireEvent.click(confirm);
    await waitFor(
      () => expect(billing.privateClasses.pay).toHaveBeenCalledWith("c1", "pc1", "st1", { voucherId: "v1" }),
      WAIT,
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Clase pagada con bono"), WAIT);
  });

  it("sin bonos de clases privadas que sirvan, lo dice y no deja pagar con bono", async () => {
    renderSection();
    await screen.findByText("Marta", {}, WAIT);
    fireEvent.click(screen.getByRole("button", { name: "Cobrar a Marta" }));
    const dialog = await screen.findByRole("dialog", { name: "Cobrar clase privada" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Con bono" }));
    expect(await within(dialog).findByText(/no tiene ningún bono de clases privadas/, {}, WAIT)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Pagar con bono" })).toBeDisabled();
  });

  it("un error del cobro (bono del tipo equivocado) se enseña tal cual y no se cierra el diálogo", async () => {
    billing.privateClasses.pay.mockRejectedValue({ response: { data: { message: "Este bono es de pista" } } });
    renderSection();
    await screen.findByText("Marta", {}, WAIT);
    fireEvent.click(screen.getByRole("button", { name: "Cobrar a Marta" }));
    const dialog = await screen.findByRole("dialog", { name: "Cobrar clase privada" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Efectivo" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Cobrar" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Este bono es de pista"), WAIT);
    expect(screen.getByRole("dialog", { name: "Cobrar clase privada" })).toBeInTheDocument();
  });

  it("quitar el cobro de un alumno cobrado pide confirmación", async () => {
    renderSection();
    await screen.findByText("Pablo", {}, WAIT);
    fireEvent.click(screen.getByRole("button", { name: "Quitar el cobro a Pablo" }));
    expect(billing.privateClasses.unpay).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Quitar el cobro" }));
    await waitFor(() => expect(billing.privateClasses.unpay).toHaveBeenCalledWith("c1", "pc1", "st2"), WAIT);
  });

  it("cancelar la clase, con su motivo", async () => {
    renderSection();
    await screen.findByText("Marta", {}, WAIT);
    fireEvent.click(screen.getByRole("button", { name: /Cancelar clase/ }));
    const dialog = within(await screen.findByRole("dialog"));
    fireEvent.change(dialog.getByLabelText("Motivo de la cancelación"), { target: { value: " Se lesionó " } });
    fireEvent.click(dialog.getByRole("button", { name: "Cancelar clase" }));
    await waitFor(() => expect(billing.privateClasses.cancel).toHaveBeenCalledWith("c1", "pc1", "Se lesionó"), WAIT);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Clase cancelada: su pista queda libre"), WAIT);
  });

  it("una clase cancelada no se cobra ni se toca", async () => {
    billing.privateClasses.list.mockResolvedValue([klass({ status: "CANCELLED", cancelReason: "Lluvia", court: null })]);
    renderSection();
    expect(await screen.findByText("Cancelada", {}, WAIT)).toBeInTheDocument();
    expect(screen.getByText("Motivo: Lluvia")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Cobrar a/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Editar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Cancelar clase/ })).not.toBeInTheDocument();
  });

  it("sin acceso de escritura, solo se lee: sin crear, cobrar, editar ni cancelar", async () => {
    renderSection(false);
    await screen.findByText("Marta", {}, WAIT);
    expect(screen.queryByRole("button", { name: /Nueva clase privada/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Cobrar a/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Quitar el cobro/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Editar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Cancelar clase/ })).not.toBeInTheDocument();
  });

  it("una clase sin pista (se borró) avisa de que hay que elegir otra", async () => {
    billing.privateClasses.list.mockResolvedValue([klass({ court: null })]);
    renderSection();
    expect(await screen.findByText(/La pista de esta clase ya no existe/, {}, WAIT)).toBeInTheDocument();
    expect(screen.getByText("Sin pista")).toBeInTheDocument();
  });

  describe("crear y editar", () => {
    const open = async () => {
      renderSection();
      await screen.findByText("Marta", {}, WAIT);
      fireEvent.click(screen.getByRole("button", { name: /Nueva clase privada/ }));
      return within(await screen.findByRole("dialog", { name: "Nueva clase privada" }));
    };

    it("propone el precio de cada alumno con la tarifa del entrenador y lo manda en céntimos", async () => {
      const dialog = await open();
      await waitFor(() => expect(dialog.getByRole("option", { name: "Luis" })).toBeInTheDocument(), WAIT);
      await waitFor(() => expect(dialog.getByRole("option", { name: "Pista 1" })).toBeInTheDocument(), WAIT);
      fireEvent.change(dialog.getByLabelText("Entrenador"), { target: { value: "co1" } });
      fireEvent.change(dialog.getByLabelText("Pista"), { target: { value: "p1" } });
      fireEvent.change(dialog.getByLabelText("Día"), { target: { value: "2026-11-23" } });
      fireEvent.change(dialog.getByLabelText("Hora"), { target: { value: "18:00" } });

      // Un alumno: la tarifa entera (40 €/h × 1 h)
      fireEvent.click(dialog.getByRole("button", { name: "Añadir a Marta" }));
      expect(dialog.getByLabelText("Precio de Marta")).toHaveValue("40,00");
      // Dos alumnos: se reparte (20 € cada uno)
      fireEvent.click(dialog.getByRole("button", { name: "Añadir a Pablo" }));
      expect(dialog.getByLabelText("Precio de Marta")).toHaveValue("20,00");
      expect(dialog.getByLabelText("Precio de Pablo")).toHaveValue("20,00");
      expect(dialog.getByText(/Precio propuesto: 20,00 € por alumno/)).toBeInTheDocument();

      // Una hora y media: 40 € × 1,5 ÷ 2 = 30 € cada uno
      fireEvent.change(dialog.getByLabelText("Duración (min)"), { target: { value: "90" } });
      expect(dialog.getByLabelText("Precio de Marta")).toHaveValue("30,00");

      // Lo que se escribe a mano ya no se recalcula
      fireEvent.change(dialog.getByLabelText("Precio de Pablo"), { target: { value: "25" } });
      fireEvent.change(dialog.getByLabelText("Duración (min)"), { target: { value: "60" } });
      expect(dialog.getByLabelText("Precio de Marta")).toHaveValue("20,00");
      expect(dialog.getByLabelText("Precio de Pablo")).toHaveValue("25");

      fireEvent.click(dialog.getByRole("button", { name: "Crear clase" }));
      await waitFor(
        () =>
          expect(billing.privateClasses.create).toHaveBeenCalledWith("c1", {
            coachStaffId: "co1",
            courtId: "p1",
            date: "2026-11-23",
            startTime: "18:00",
            durationMinutes: 60,
            students: [
              { clubCustomerId: "cc-1", priceCents: 2000 },
              { clubCustomerId: "cc-2", priceCents: 2500 },
            ],
            notes: null,
          }),
        WAIT,
      );
      await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Clase privada creada: su pista queda reservada"), WAIT);
    });

    it("un entrenador sin tarifa no propone nada: dice dónde ponerla y el precio se escribe a mano", async () => {
      const dialog = await open();
      await waitFor(() => expect(dialog.getByRole("option", { name: "Eva" })).toBeInTheDocument(), WAIT);
      fireEvent.change(dialog.getByLabelText("Entrenador"), { target: { value: "co2" } });
      fireEvent.click(dialog.getByRole("button", { name: "Añadir a Marta" }));
      expect(dialog.getByLabelText("Precio de Marta")).toHaveValue("");
      expect(dialog.getByText(/no tiene tarifa de clase privada/)).toBeInTheDocument();
    });

    it("no se manda sin pista, sin alumnos o con un precio sin escribir, y se dice qué falta", async () => {
      const dialog = await open();
      fireEvent.click(dialog.getByRole("button", { name: "Crear clase" }));
      expect(toast.error).toHaveBeenLastCalledWith("Elige la pista de la clase");

      await waitFor(() => expect(dialog.getByRole("option", { name: "Pista 1" })).toBeInTheDocument(), WAIT);
      fireEvent.change(dialog.getByLabelText("Pista"), { target: { value: "p1" } });
      fireEvent.click(dialog.getByRole("button", { name: "Crear clase" }));
      expect(toast.error).toHaveBeenLastCalledWith("Añade al menos un alumno");

      fireEvent.click(dialog.getByRole("button", { name: "Añadir a Marta" }));
      fireEvent.click(dialog.getByRole("button", { name: "Crear clase" }));
      expect(toast.error).toHaveBeenLastCalledWith("Escribe un precio válido para Marta (por ejemplo 30 o 12,50)");
      expect(billing.privateClasses.create).not.toHaveBeenCalled();
    });

    it("el mismo alumno no se añade dos veces", async () => {
      const dialog = await open();
      fireEvent.click(dialog.getByRole("button", { name: "Añadir a Marta" }));
      fireEvent.click(dialog.getByRole("button", { name: "Añadir a Marta" }));
      expect(toast.error).toHaveBeenCalledWith("Ese alumno ya está en la clase");
      expect(dialog.getAllByLabelText(/Precio de/)).toHaveLength(1);
    });

    it("pista ocupada: el error del servidor se enseña y el diálogo sigue abierto con lo escrito", async () => {
      billing.privateClasses.create.mockRejectedValue({
        response: { data: { message: "La pista ya está ocupada a esa hora (una reserva)" } },
      });
      const dialog = await open();
      await waitFor(() => expect(dialog.getByRole("option", { name: "Pista 1" })).toBeInTheDocument(), WAIT);
      fireEvent.change(dialog.getByLabelText("Pista"), { target: { value: "p1" } });
      fireEvent.click(dialog.getByRole("button", { name: "Añadir a Marta" }));
      fireEvent.change(dialog.getByLabelText("Precio de Marta"), { target: { value: "30" } });
      fireEvent.click(dialog.getByRole("button", { name: "Crear clase" }));
      await waitFor(
        () => expect(toast.error).toHaveBeenCalledWith("La pista ya está ocupada a esa hora (una reserva)"),
        WAIT,
      );
      expect(screen.getByRole("dialog", { name: "Nueva clase privada" })).toBeInTheDocument();
    });

    it("editar: carga la clase, un alumno cobrado no se quita ni cambia de precio y se manda todo", async () => {
      renderSection();
      await screen.findByText("Marta", {}, WAIT);
      fireEvent.click(screen.getByRole("button", { name: /Editar/ }));
      const dialog = within(await screen.findByRole("dialog", { name: "Editar clase privada" }));

      expect(dialog.getByLabelText("Día")).toHaveValue("2026-11-23");
      expect(dialog.getByLabelText("Hora")).toHaveValue("18:00");
      expect(dialog.getByLabelText("Duración (min)")).toHaveValue(60);
      expect(dialog.getByLabelText("Precio de Marta")).toHaveValue("20,00");
      // Pablo ya pagó: ni precio ni quitarlo
      expect(dialog.getByLabelText("Precio de Pablo")).toBeDisabled();
      expect(dialog.getByRole("button", { name: "Quitar a Pablo" })).toBeDisabled();
      expect(dialog.getByRole("button", { name: "Quitar a Marta" })).toBeEnabled();

      // Mover una hora
      fireEvent.change(dialog.getByLabelText("Hora"), { target: { value: "19:00" } });
      fireEvent.click(dialog.getByRole("button", { name: "Guardar clase" }));
      await waitFor(
        () =>
          expect(billing.privateClasses.update).toHaveBeenCalledWith("c1", "pc1", {
            coachStaffId: "co1",
            courtId: "p1",
            date: "2026-11-23",
            startTime: "19:00",
            durationMinutes: 60,
            students: [
              { clubCustomerId: "cc-1", priceCents: 2000 },
              { clubCustomerId: "cc-2", priceCents: 2000 },
            ],
            notes: null,
          }),
        WAIT,
      );
    });
  });
});

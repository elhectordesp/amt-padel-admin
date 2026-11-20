/**
 * Cobro de la escuela (cuotas y clases privadas): los meses, los totales, el
 * precio que se propone a cada alumno y el formulario de la clase, con las
 * mismas reglas que el back.
 */
import { describe, it, expect } from "vitest";
import {
  FEE_STATUS_LABEL,
  checkPrivateClassForm,
  classPaymentSummary,
  currentMonth,
  defaultPrivateClassRange,
  emptyPrivateClassForm,
  feeStateText,
  feeTotals,
  generateFeesText,
  monthLabel,
  privateClassDuration,
  privateClassFormOf,
  privateClassWhen,
  proposedStudentPriceCents,
  shiftMonth,
  studentPaymentText,
  withProposedPrices,
  type PrivateClassFormValues,
} from "@/lib/utils/school-billing";
import { centsToFieldText, checkMonthlyFee, checkRate } from "@/lib/utils/school-money";
import type { SchoolPrivateClass } from "@/types/school-billing";

const MADRID = "Europe/Madrid";

describe("meses de las cuotas", () => {
  it("el mes de hoy es el de la zona del club, no el de UTC", () => {
    const now = new Date("2026-11-30T23:30:00Z");
    expect(currentMonth(now, MADRID)).toBe("2026-12");
    expect(currentMonth(now, "UTC")).toBe("2026-11");
  });

  it("pasar de mes cruza el año en los dos sentidos", () => {
    expect(shiftMonth("2026-11", 1)).toBe("2026-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2027-01", -1)).toBe("2026-12");
    expect(shiftMonth("2026-03", -14)).toBe("2025-01");
    expect(shiftMonth("no es un mes", 1)).toBe("no es un mes");
  });

  it("el nombre del mes, con mayúscula", () => {
    expect(monthLabel("2026-11")).toBe("Noviembre de 2026");
    expect(monthLabel("2027-01")).toBe("Enero de 2027");
  });
});

describe("cuotas: totales y textos", () => {
  const fee = (status: "pending" | "paid" | "cancelled", amountCents: number) => ({ status, amountCents });

  it("lo pendiente y lo cobrado; las anuladas no cuentan", () => {
    expect(feeTotals([fee("pending", 4500), fee("pending", 4500), fee("paid", 3000), fee("cancelled", 9999)])).toEqual({
      pendingCount: 2,
      pendingCents: 9000,
      paidCount: 1,
      paidCents: 3000,
    });
    expect(feeTotals([])).toEqual({ pendingCount: 0, pendingCents: 0, paidCount: 0, paidCents: 0 });
  });

  it("el estado de una cuota para leer", () => {
    expect(feeStateText({ status: "pending", paymentMethod: null })).toBe("Pendiente");
    expect(feeStateText({ status: "paid", paymentMethod: "CARD" })).toBe("Cobrada · Tarjeta");
    expect(feeStateText({ status: "cancelled", paymentMethod: null })).toBe("Anulada");
    expect(Object.keys(FEE_STATUS_LABEL)).toEqual(["pending", "paid", "cancelled"]);
  });

  it("lo que pasó al generar, en una línea", () => {
    expect(generateFeesText({ groups: 0, due: 0, created: 0, existing: 0 })).toMatch(/Ningún grupo con cuota/);
    expect(generateFeesText({ groups: 2, due: 0, created: 0, existing: 0 })).toMatch(/no tienen alumnos/);
    expect(generateFeesText({ groups: 2, due: 5, created: 5, existing: 0 })).toBe("Se han creado 5 cuotas");
    expect(generateFeesText({ groups: 2, due: 5, created: 1, existing: 4 })).toBe("Se ha creado 1 cuota · 4 ya estaban");
    expect(generateFeesText({ groups: 2, due: 5, created: 0, existing: 5 })).toBe("No había cuotas nuevas · 5 ya estaban");
  });
});

describe("importes de la escuela en euros", () => {
  it("la cuota y la tarifa: euros escritos a céntimos; vacío, sin importe", () => {
    expect(checkMonthlyFee("45")).toEqual({ ok: true, value: 4500 });
    expect(checkMonthlyFee(" 45,5 ")).toEqual({ ok: true, value: 4550 });
    expect(checkMonthlyFee("")).toEqual({ ok: true, value: null });
    expect(checkRate("40,50")).toEqual({ ok: true, value: 4050 });
    expect(checkRate("  ")).toEqual({ ok: true, value: null });
  });

  it("un importe mal escrito, a cero o pasado de tope no vale y se dice cuál", () => {
    for (const bad of ["abc", "-5", "12,345", "0", "0,00", "100000,01"]) {
      expect(checkMonthlyFee(bad)).toMatchObject({ ok: false });
      expect(checkRate(bad)).toMatchObject({ ok: false });
    }
    expect(checkMonthlyFee("abc")).toEqual({ ok: false, message: "Escribe una cuota válida (por ejemplo 45 o 45,50)" });
    expect(checkRate("abc")).toEqual({ ok: false, message: "Escribe una tarifa válida (por ejemplo 40 o 40,50)" });
    expect(checkMonthlyFee("100000")).toEqual({ ok: true, value: 10_000_000 });
  });

  it("céntimos a euros para un campo; sin importe, vacío", () => {
    expect(centsToFieldText(4500)).toBe("45,00");
    expect(centsToFieldText(4550)).toBe("45,50");
    expect(centsToFieldText(null)).toBe("");
    expect(centsToFieldText(undefined)).toBe("");
  });
});

describe("precio propuesto de una clase privada", () => {
  it("la tarifa por las horas de la clase, repartida entre los alumnos y redondeada al céntimo", () => {
    // 40 €/h, 1 hora: 40 € para uno, 20 € cada uno entre dos
    expect(proposedStudentPriceCents(4000, 60, 1)).toBe(4000);
    expect(proposedStudentPriceCents(4000, 60, 2)).toBe(2000);
    // 1 hora y media entre tres: 60 € / 3
    expect(proposedStudentPriceCents(4000, 90, 3)).toBe(2000);
    // 40 € entre 3: 13,333... → 13,33 €
    expect(proposedStudentPriceCents(4000, 60, 3)).toBe(1333);
    // 45 minutos de 30 €/h: 22,50 €
    expect(proposedStudentPriceCents(3000, 45, 1)).toBe(2250);
  });

  it("sin tarifa, sin duración o sin alumnos, no se propone nada", () => {
    expect(proposedStudentPriceCents(null, 60, 1)).toBeNull();
    expect(proposedStudentPriceCents(undefined, 60, 1)).toBeNull();
    expect(proposedStudentPriceCents(0, 60, 1)).toBeNull();
    expect(proposedStudentPriceCents(4000, 0, 1)).toBeNull();
    expect(proposedStudentPriceCents(4000, Number.NaN, 1)).toBeNull();
    expect(proposedStudentPriceCents(4000, 60, 0)).toBeNull();
  });
});

describe("formulario de la clase privada", () => {
  const student = (over: Partial<PrivateClassFormValues["students"][number]> = {}) => ({
    clubCustomerId: "cc-1",
    name: "Marta",
    price: "30",
    priceTouched: true,
    paid: false,
    ...over,
  });
  const form = (over: Partial<PrivateClassFormValues> = {}): PrivateClassFormValues => ({
    coachStaffId: "st-1",
    courtId: "c1",
    date: "2026-11-23",
    startTime: "18:00",
    durationMinutes: "60",
    students: [student()],
    notes: "",
    ...over,
  });

  it("un formulario correcto sale listo para mandar: euros a céntimos, null donde va vacío", () => {
    expect(checkPrivateClassForm(form({ coachStaffId: "", notes: "  " }))).toEqual({
      ok: true,
      value: {
        coachStaffId: null,
        courtId: "c1",
        date: "2026-11-23",
        startTime: "18:00",
        durationMinutes: 60,
        students: [{ clubCustomerId: "cc-1", priceCents: 3000 }],
        notes: null,
      },
    });
    expect(
      checkPrivateClassForm(form({ students: [student({ price: "12,50" }), student({ clubCustomerId: "cc-2", price: "0" })] })),
    ).toMatchObject({
      ok: true,
      value: {
        students: [
          { clubCustomerId: "cc-1", priceCents: 1250 },
          { clubCustomerId: "cc-2", priceCents: 0 },
        ],
      },
    });
  });

  it.each([
    ["sin pista", { courtId: "" }, "pista"],
    ["un día que no existe", { date: "2026-02-30" }, "día"],
    ["sin día", { date: "" }, "día"],
    ["una hora mal escrita", { startTime: "25:00" }, "hora"],
    ["una duración de 5 minutos", { durationMinutes: "5" }, "duración"],
    ["una duración de 500 minutos", { durationMinutes: "500" }, "duración"],
    ["una clase que pasa de las 24:00", { startTime: "23:30", durationMinutes: "60" }, "24:00"],
    ["sin alumnos", { students: [] }, "alumno"],
    ["cinco alumnos", { students: ["a", "b", "c", "d", "e"].map((id) => student({ clubCustomerId: id })) }, "como mucho 4"],
    ["un precio mal escrito", { students: [student({ price: "abc" })] }, "precio válido para Marta"],
    ["un precio vacío", { students: [student({ price: "" })] }, "precio válido para Marta"],
    ["un precio pasado de tope", { students: [student({ price: "100000,01" })] }, "100.000"],
  ])("%s no se manda", (_name, over, message) => {
    const r = checkPrivateClassForm(form(over as Partial<PrivateClassFormValues>));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.message).toContain(message);
  });

  it("una clase de 4 alumnos y una que acaba justo a las 24:00 valen", () => {
    expect(
      checkPrivateClassForm(form({ students: ["a", "b", "c", "d"].map((id) => student({ clubCustomerId: id })) })).ok,
    ).toBe(true);
    expect(checkPrivateClassForm(form({ startTime: "23:00", durationMinutes: "60" })).ok).toBe(true);
  });

  it("el precio propuesto solo toca a quien nadie ha escrito ni está cobrado", () => {
    const f = form({
      durationMinutes: "60",
      students: [
        student({ clubCustomerId: "a", price: "", priceTouched: false }),
        student({ clubCustomerId: "b", price: "99", priceTouched: true }),
        student({ clubCustomerId: "c", price: "10", priceTouched: false, paid: true }),
        student({ clubCustomerId: "d", price: "", priceTouched: false }),
      ],
    });
    // 40 €/h entre 4 alumnos: 10 €
    const r = withProposedPrices(f, 4000);
    expect(r.students.map((s) => s.price)).toEqual(["10,00", "99", "10", "10,00"]);
    // Sin tarifa, igual que estaba
    expect(withProposedPrices(f, null)).toBe(f);
  });

  it("el formulario de una clase guardada vuelve a escribirse en la zona del club, con los precios fijados", () => {
    const c: SchoolPrivateClass = {
      id: "pc-1",
      coachStaffId: "st-1",
      coachName: "Luis",
      startsAt: "2026-11-23T17:00:00.000Z",
      endsAt: "2026-11-23T18:30:00.000Z",
      status: "SCHEDULED",
      cancelReason: null,
      notes: "Con material",
      court: { id: "c1", name: "Pista 1" },
      students: [
        { id: "s1", clubCustomerId: "cc-1", name: "Marta", priceCents: 3050, paymentMethod: "CASH", paidAt: "2026-11-23T18:00:00Z", paid: true },
        { id: "s2", clubCustomerId: "cc-2", name: null, priceCents: 2000, paymentMethod: null, paidAt: null, paid: false },
      ],
      totalCents: 5050,
      createdAt: "2026-11-20T10:00:00Z",
    };
    expect(privateClassFormOf(c, MADRID)).toEqual({
      coachStaffId: "st-1",
      courtId: "c1",
      date: "2026-11-23",
      startTime: "18:00",
      durationMinutes: "90",
      students: [
        { clubCustomerId: "cc-1", name: "Marta", price: "30,50", priceTouched: true, paid: true },
        { clubCustomerId: "cc-2", name: "Sin nombre", price: "20,00", priceTouched: true, paid: false },
      ],
      notes: "Con material",
    });
    // Y vuelve a ser un payload válido tal cual
    expect(checkPrivateClassForm(privateClassFormOf(c, MADRID))).toMatchObject({
      ok: true,
      value: { durationMinutes: 90, students: [{ priceCents: 3050 }, { priceCents: 2000 }] },
    });
    expect(emptyPrivateClassForm("2026-11-23")).toMatchObject({ date: "2026-11-23", students: [], startTime: "18:00" });
  });
});

describe("clases privadas: textos", () => {
  const base = { startsAt: "2026-11-23T17:00:00.000Z", endsAt: "2026-11-23T18:00:00.000Z" };

  it("la hora de la clase en la zona del club y lo que dura", () => {
    expect(privateClassWhen(base, MADRID)).toBe("lun, 23 nov · 18:00–19:00");
    expect(privateClassDuration(base, MADRID)).toBe(60);
    // Acaba a medianoche: cuenta hasta las 24:00
    expect(privateClassDuration({ startsAt: "2026-11-23T22:00:00Z", endsAt: "2026-11-23T23:00:00Z" }, MADRID)).toBe(60);
  });

  it("el cobro de un alumno: pendiente, en dinero o con bono", () => {
    expect(studentPaymentText({ paid: false, paymentMethod: null })).toBe("Pendiente");
    expect(studentPaymentText({ paid: true, paymentMethod: "BIZUM" })).toBe("Cobrado · Bizum");
    expect(studentPaymentText({ paid: true, paymentMethod: "VOUCHER" })).toBe("Pagado con bono");
  });

  it("cuántos alumnos han pagado", () => {
    const s = (paid: boolean) => ({ paid }) as never;
    expect(classPaymentSummary({ students: [s(true), s(false), s(false)] })).toBe("1 de 3 cobrados");
    expect(classPaymentSummary({ students: [s(true)] })).toBe("1 de 1 cobrado");
  });

  it("la lista empieza hoy y llega a una semana", () => {
    expect(defaultPrivateClassRange(new Date("2026-11-20T10:00:00Z"), MADRID)).toEqual({ from: "2026-11-20", to: "2026-11-26" });
    // A las 23:30 UTC ya es mañana en Madrid
    expect(defaultPrivateClassRange(new Date("2026-11-20T23:30:00Z"), MADRID).from).toBe("2026-11-21");
  });
});

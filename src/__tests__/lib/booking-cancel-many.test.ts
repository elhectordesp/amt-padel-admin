import { describe, expect, it } from "vitest";
import { cancelFailureReason, cancelledSummary } from "@/lib/utils/booking-cancel-many";

describe("booking-cancel-many", () => {
  it("dice en llano por qué no se pudo cancelar", () => {
    expect(cancelFailureReason("BOOKING_ALREADY_CANCELLED")).toBe("ya estaba cancelada");
    expect(cancelFailureReason("BOOKING_CANNOT_CANCEL_COMPLETED")).toBe("ya se jugó");
    expect(cancelFailureReason("UNKNOWN")).toBe("no se ha podido cancelar");
  });

  it("cuenta las canceladas en singular y plural", () => {
    expect(cancelledSummary({ cancelled: ["a"], failed: [] })).toBe("1 reserva cancelada");
    expect(cancelledSummary({ cancelled: ["a", "b"], failed: [] })).toBe("2 reservas canceladas");
  });
});

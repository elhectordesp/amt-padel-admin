/**
 * Quién cuenta en una reserva (R3-3): quien rechazó o salió no es jugador ni
 * recibe el aviso de cancelación; quien cancela tampoco se avisa a sí mismo.
 */
import { describe, it, expect } from "vitest";
import {
  activeParticipants,
  bookingCapacity,
  cancellationNoticeCount,
  playersLabel,
} from "@/lib/utils/booking-participants";
import type { BookingParticipant, BookingParticipantStatus } from "@/types/bookings";

const p = (id: string, status: BookingParticipantStatus, userId: string | null = id): BookingParticipant => ({
  id, bookingId: "b1", userId, guestName: userId ? null : "Juan", isCreator: false,
  status, invitedAt: "", respondedAt: null,
});

const participants = [
  p("club-admin", "AUTO_ACCEPTED"),
  p("u2", "ACCEPTED"),
  p("u3", "INVITED"),
  p("u4", "DECLINED"),
  p("u5", "REMOVED"),
  p("g1", "AUTO_ACCEPTED", null),
];

describe("activeParticipants", () => {
  it("sin quien rechazó ni quien salió", () => {
    expect(activeParticipants({ participants }).map((x) => x.id)).toEqual(["club-admin", "u2", "u3", "g1"]);
    expect(activeParticipants({})).toEqual([]);
  });
});

describe("cancellationNoticeCount", () => {
  it("los que siguen y tienen cuenta, menos quien cancela (como el back)", () => {
    expect(cancellationNoticeCount({ participants }, "club-admin")).toBe(2);
    // Sin saber aún quién es: no descuenta a nadie
    expect(cancellationNoticeCount({ participants }, undefined)).toBe(3);
  });
});

describe("bookingCapacity", () => {
  it("2 en una pista individual, 4 en el resto", () => {
    expect(bookingCapacity({ court: { id: "c", name: "P", type: "SINGLES", isIndoor: false } })).toBe(2);
    expect(bookingCapacity({ court: { id: "c", name: "P", type: "DOUBLES", isIndoor: false } })).toBe(4);
    expect(bookingCapacity({})).toBe(4);
  });
});

describe("playersLabel", () => {
  it("singular y plural («1 jugadores» → «1 jugador»)", () => {
    expect(playersLabel(1)).toBe("1 jugador");
    expect(playersLabel(0)).toBe("0 jugadores");
    expect(playersLabel(4)).toBe("4 jugadores");
  });
});

import { describe, it, expect } from "vitest";
import { charCount } from "../../../lib/utils/char-count";

// Tiene que contar igual que el back (MaxLength de class-validator)
describe("charCount", () => {
  it("texto normal, con tildes y eñes: un carácter cada uno", () => {
    expect(charCount("")).toBe(0);
    expect(charCount("Lluvia")).toBe(6);
    expect(charCount("Pádel en Castellón, año")).toBe(23);
  });

  it("un emoji cuenta como uno (aunque sean dos unidades UTF-16)", () => {
    expect("🎾".length).toBe(2);
    expect(charCount("🎾")).toBe(1);
    expect(charCount("Hoy 🎾🎾")).toBe(6);
  });

  it("el selector de presentación del emoji no cuenta", () => {
    expect(charCount("❤️")).toBe(1);
    expect(charCount("☀️ Sol")).toBe(5);
  });
});

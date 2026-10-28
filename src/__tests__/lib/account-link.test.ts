import { describe, it, expect } from "vitest";
import { appResetUrl, isMobileDevice, readAccountLink } from "@/lib/account-link";
import { PASSWORD_REGEX, PASSWORD_RULES } from "@/lib/password-rules";

describe("readAccountLink", () => {
  it("lee el token del fragmento (#), como lo manda el back", () => {
    expect(readAccountLink("#token=abc_-1", "")).toEqual({ token: "abc_-1", activate: false });
    expect(readAccountLink("#token=abc&mode=activate", "")).toEqual({ token: "abc", activate: true });
  });

  it("también de la query (?token=), por si llega así", () => {
    expect(readAccountLink("", "?token=abc&mode=activate")).toEqual({ token: "abc", activate: true });
  });

  it("sin token, o vacío: null", () => {
    expect(readAccountLink("", "")).toBeNull();
    expect(readAccountLink("#mode=activate", "?token=")).toBeNull();
  });
});

describe("appResetUrl", () => {
  it("el enlace de la app lleva el token (y el modo) en la query", () => {
    expect(appResetUrl({ token: "abc", activate: false })).toBe("amtpadel://reset-password?token=abc");
    expect(appResetUrl({ token: "abc", activate: true })).toBe(
      "amtpadel://reset-password?token=abc&mode=activate",
    );
  });
});

describe("isMobileDevice", () => {
  it.each([
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", 5, true],
    ["Mozilla/5.0 (Linux; Android 14; Pixel 8)", 5, true],
    // iPadOS se presenta como Mac, pero es táctil
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5, true],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 0, false],
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64)", 0, false],
  ])("%s (%i puntos táctiles): %s", (ua, touch, expected) => {
    expect(isMobileDevice(ua, touch)).toBe(expected);
  });
});

describe("reglas de la contraseña (las del back)", () => {
  it.each(["Abcdef1!", "Password1", "A1aaaaaa"])("válida: %s", (p) => {
    expect(PASSWORD_REGEX.test(p)).toBe(true);
    expect(PASSWORD_RULES.every((r) => r.test(p))).toBe(true);
  });

  it.each(["", "abcdefgh", "ABCDEFGH", "12345678", "Abcdef1", "abcdefg1"])("no válida: %s", (p) => {
    expect(PASSWORD_REGEX.test(p)).toBe(false);
    expect(PASSWORD_RULES.every((r) => r.test(p))).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import { scrubEvent, scrubTokens } from "@/lib/sentry-scrub";
import { isWebUrl } from "@/lib/utils/web-url";

describe("scrubTokens", () => {
  it("quita el token del fragmento y de la query, y deja lo demás", () => {
    expect(scrubTokens("https://admin.amtpadel.com/restablecer#token=abc_-1&mode=activate")).toBe(
      "https://admin.amtpadel.com/restablecer#token=[Filtered]&mode=activate",
    );
    expect(scrubTokens("/aceptar-invitacion?token=xyz")).toBe("/aceptar-invitacion?token=[Filtered]");
    expect(scrubTokens("/torneos?page=2")).toBe("/torneos?page=2");
  });
});

describe("scrubEvent", () => {
  it("limpia la URL de la petición, las migas y las trazas, sin tocar lo interno del SDK", () => {
    class Scope {
      url = "https://x/restablecer#token=interno";
    }
    const scope = new Scope();
    const event = {
      request: { url: "https://admin.amtpadel.com/restablecer#token=abc" },
      breadcrumbs: [{ category: "navigation", data: { from: "/x", to: "/restablecer?token=abc" } }],
      spans: [{ data: { "url.full": "https://admin.amtpadel.com/restablecer#token=abc" } }],
      sdkProcessingMetadata: { capturedSpanScope: scope },
    };

    const out = scrubEvent(event);

    expect(out).toBe(event);
    expect(out.request.url).toBe("https://admin.amtpadel.com/restablecer#token=[Filtered]");
    expect(out.breadcrumbs[0].data.to).toBe("/restablecer?token=[Filtered]");
    expect(out.spans[0].data["url.full"]).toBe("https://admin.amtpadel.com/restablecer#token=[Filtered]");
    expect(scope.url).toBe("https://x/restablecer#token=interno");
  });

  it("aguanta referencias circulares", () => {
    const event: Record<string, unknown> = { message: "?token=abc" };
    event.self = event;
    expect(scrubEvent(event).message).toBe("?token=[Filtered]");
  });
});

describe("isWebUrl", () => {
  it.each([
    "https://raquetas.example",
    "http://raquetas.example/tienda?x=1",
    "https://res.cloudinary.com/demo/image/upload/s.png",
    "https://www.raquetas.example:8443/#ofertas",
  ])("%s: sí", (url) => {
    expect(isWebUrl(url)).toBe(true);
  });

  // Sin punto en el dominio tampoco: el back (IsUrl) lo rechaza
  it.each([
    "javascript:alert(1)",
    "JAVASCRIPT:alert(1)",
    "raquetas.example",
    "data:text/html,x",
    "https://",
    "https://localhost",
    "https://raquetas",
    "https://raquetas./tienda",
  ])(
    "%s: no",
    (url) => {
      expect(isWebUrl(url)).toBe(false);
    },
  );
});

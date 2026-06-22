"use client";

import { useEffect, useState } from "react";
import Cookies from "js-cookie";

const TOKEN_KEY = "amt_admin_token";

export type Role = "admin" | "club" | "user" | null;

interface JwtPayload {
  role?: string;
  clubId?: string | null;
}

function decode(token: string | undefined): JwtPayload | null {
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(atob(padded)) as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Lee el rol y clubId del JWT en cookies. Devuelve null durante SSR para
 * evitar mismatch de hidratación — los componentes que lo usen deben
 * tratar el estado inicial como "todavía no sé qué rol es".
 */
export function useRole(): { role: Role; clubId: string | null } {
  const [state, setState] = useState<{ role: Role; clubId: string | null }>({
    role: null,
    clubId: null,
  });

  useEffect(() => {
    const token = Cookies.get(TOKEN_KEY);
    const payload = decode(token);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({
      role: (payload?.role as Role) ?? null,
      clubId: payload?.clubId ?? null,
    });
  }, []);

  return state;
}

export function isClub(role: Role): boolean {
  return role === "club";
}

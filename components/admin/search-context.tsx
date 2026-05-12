"use client";

import { createContext, useContext, useState } from "react";

interface SearchCtx { open: boolean; toggle: () => void; close: () => void }

const Ctx = createContext<SearchCtx>({ open: false, toggle: () => {}, close: () => {} });

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Ctx.Provider value={{ open, toggle: () => setOpen((o) => !o), close: () => setOpen(false) }}>
      {children}
    </Ctx.Provider>
  );
}

export const useSearch = () => useContext(Ctx);

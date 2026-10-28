"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { useState } from "react";
import { NavProgress } from "@/components/admin/nav-progress";
import { SearchModal } from "@/components/admin/search-modal";
import { SearchProvider } from "@/components/admin/search-context";
import { useMediaQuery } from "@/lib/use-media-query";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }),
  );
  // En el móvil sonner ocupa todo el ancho de abajo y tapaba los botones de
  // los formularios (los del asistente, al fallar «Crear»): ahí, arriba. El
  // ancho es el que usa sonner para su vista de móvil
  const isMobile = useMediaQuery("(max-width: 600px)");

  return (
    <QueryClientProvider client={queryClient}>
      <SearchProvider>
        <NavProgress />
        <SearchModal />
        {children}
      </SearchProvider>
      <Toaster
        theme="dark"
        position={isMobile ? "top-center" : "bottom-right"}
        toastOptions={{
          style: {
            background: "#1A1A1A",
            border:     "1px solid rgba(212,175,55,0.3)",
            color:      "#F5F5F0",
          },
        }}
      />
    </QueryClientProvider>
  );
}

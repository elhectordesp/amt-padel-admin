"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { useState } from "react";
import { NavProgress } from "@/components/admin/nav-progress";
import { SearchModal } from "@/components/admin/search-modal";
import { SearchProvider } from "@/components/admin/search-context";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SearchProvider>
        <NavProgress />
        <SearchModal />
        {children}
      </SearchProvider>
      <Toaster
        theme="dark"
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

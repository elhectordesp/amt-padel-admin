import { Sidebar } from "@/components/admin/sidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      {/* pt-14 en móvil para no quedar bajo el botón hamburguesa (h-9 + top-4 + margen) */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden pt-14 lg:pt-0">
        {children}
      </main>
    </div>
  );
}

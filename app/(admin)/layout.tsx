import { AccessGate } from "@/components/admin/access-gate";
import { Sidebar } from "@/components/admin/sidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        <AccessGate>{children}</AccessGate>
      </main>
    </div>
  );
}

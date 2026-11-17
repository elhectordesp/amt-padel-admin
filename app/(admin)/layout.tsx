import { AccessGate } from "@/components/admin/access-gate";
import { Sidebar } from "@/components/admin/sidebar";
import { SupportBanner } from "@/components/admin/support-mode";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <SupportBanner />
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <AccessGate>{children}</AccessGate>
        </main>
      </div>
    </div>
  );
}

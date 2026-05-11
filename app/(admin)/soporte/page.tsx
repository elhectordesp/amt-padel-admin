import { Header } from "@/components/admin/header";

export default function Page() {
  return (
    <div className="flex flex-col min-h-full">
      <Header title="En construcción" />
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        Módulo en construcción
      </div>
    </div>
  );
}

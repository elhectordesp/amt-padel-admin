export default function AdminLoading() {
  return (
    <div className="flex flex-col min-h-full">
      {/* Header skeleton */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="h-6 w-40 rounded bg-secondary animate-pulse" />
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-secondary animate-pulse" />
          <div className="w-24 h-8 rounded bg-secondary animate-pulse" />
        </div>
      </div>
      {/* Content skeleton */}
      <div className="flex-1 p-6 space-y-4">
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 rounded-lg bg-card border border-border animate-pulse" />
          ))}
        </div>
        <div className="h-64 rounded-lg bg-card border border-border animate-pulse" />
        <div className="h-48 rounded-lg bg-card border border-border animate-pulse" />
      </div>
    </div>
  );
}

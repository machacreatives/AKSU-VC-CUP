// Loading placeholders.
//
// These deliberately mirror the shape of the content they stand in for — a
// card the size of a card, a row the height of a row — so the page does not
// jump when the real data arrives. A bare "Loading…" line collapses the layout
// and then reflows it, which reads as a flash of breakage.

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

/** Wraps a block of placeholders and announces it to assistive tech once. */
export function SkeletonScreen({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

export function SkeletonPageHeader() {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="space-y-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-3.5 w-64" />
      </div>
      <Skeleton className="h-9 w-28 rounded-[8px]" />
    </div>
  );
}

/** A bordered card with rows inside, matching the admin list cards. */
export function SkeletonRows({ rows = 4, className = "" }: { rows?: number; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-card border border-line bg-surface shadow-premium ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 border-b border-line px-3 py-3 last:border-b-0"
        >
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-3.5 w-14" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div className={`space-y-2.5 rounded-card border border-line bg-surface p-3 shadow-premium ${className}`}>
      <Skeleton className="h-4 w-2/5" />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-20 rounded-[6px]" />
        <Skeleton className="h-8 w-24 rounded-[6px]" />
        <Skeleton className="h-8 w-16 rounded-[6px]" />
      </div>
      <Skeleton className="h-3 w-1/3" />
    </div>
  );
}

/** Mirrors a public match card: status column, two team rows, two scores. */
export function SkeletonMatchCard() {
  return (
    <div className="flex items-center gap-3 rounded-card border border-line bg-surface py-3 pl-4 pr-3 shadow-premium">
      <div className="flex w-14 shrink-0 flex-col items-center gap-1.5">
        <Skeleton className="h-3.5 w-9" />
        <Skeleton className="h-3.5 w-11" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5 rounded-full" />
          <Skeleton className="h-3.5 w-1/2" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5 rounded-full" />
          <Skeleton className="h-3.5 w-2/5" />
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <Skeleton className="h-4 w-3" />
        <Skeleton className="h-4 w-3" />
      </div>
    </div>
  );
}

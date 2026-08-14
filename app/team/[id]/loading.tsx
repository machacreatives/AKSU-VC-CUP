// Mirrors the real layout: badge and title, two fixture cards, the stat grid,
// then the squad. A skeleton whose shape does not match what arrives reads as
// the page jumping.
export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl animate-pulse space-y-6 px-4 py-5 lg:px-6 lg:py-7" aria-hidden>
      <div className="h-4 w-24 rounded bg-surface2" />

      <div className="flex items-start gap-3">
        <div className="h-14 w-14 shrink-0 rounded-full bg-surface2" />
        <div className="flex-1 space-y-2">
          <div className="h-7 w-2/3 rounded bg-surface2" />
          <div className="h-4 w-1/3 rounded bg-surface2" />
          <div className="h-4 w-1/4 rounded bg-surface2" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-[92px] rounded-card bg-surface2" />
        <div className="h-[92px] rounded-card bg-surface2" />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-[68px] rounded-card bg-surface2" />
        ))}
      </div>

      <div className="space-y-1.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-[38px] rounded-card bg-surface2" />
        ))}
      </div>
    </div>
  );
}

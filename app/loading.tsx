import { Skeleton, SkeletonMatchCard, SkeletonScreen } from "@/components/Skeleton";

// Shown while the home page's server component reads Postgres. The pages are
// dynamic (live scores must never be cached), so there is always a round trip
// to cover — without this the tab sits on the previous page with no feedback.
export default function HomeLoading() {
  return (
    <SkeletonScreen label="Loading matches">
      <div>
        {/* tab bar */}
        <div className="flex gap-1.5 border-b border-line px-4 py-2 lg:px-6 lg:py-3">
          {["w-24", "w-20", "w-24", "w-28", "w-28", "w-24", "w-20"].map((w, i) => (
            <Skeleton key={i} className={`h-8 shrink-0 rounded-full ${w}`} />
          ))}
        </div>

        <div className="space-y-5 px-4 py-4 lg:space-y-7 lg:px-6 lg:py-6">
          {[0, 1].map((section) => (
            <section key={section} className="space-y-2">
              <Skeleton className="h-3.5 w-24" />
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <SkeletonMatchCard key={i} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </SkeletonScreen>
  );
}

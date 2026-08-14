import { Skeleton, SkeletonScreen } from "@/components/Skeleton";

// Mirrors the match header — badges, names, scoreline — then the tab bar and a
// panel, so tapping a match from the list holds its shape while the server
// reads the fixture.
export default function MatchLoading() {
  return (
    <SkeletonScreen label="Loading match">
      <div>
        <div className="border-b border-line px-4 py-6 lg:py-8">
          <div className="mx-auto mb-3 flex max-w-3xl items-center justify-center gap-2">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3.5 w-40" />
          </div>

          <div className="mx-auto flex max-w-3xl items-start justify-between">
            <div className="flex flex-1 flex-col items-center gap-2">
              <Skeleton className="h-11 w-11 rounded-full" />
              <Skeleton className="h-4 w-28" />
            </div>
            <div className="px-3 pt-1">
              <Skeleton className="h-9 w-24 lg:h-12 lg:w-32" />
            </div>
            <div className="flex flex-1 flex-col items-center gap-2">
              <Skeleton className="h-11 w-11 rounded-full" />
              <Skeleton className="h-4 w-28" />
            </div>
          </div>
        </div>

        <div className="flex gap-1.5 border-b border-line px-4 py-2 lg:px-6 lg:py-3">
          {["w-24", "w-20", "w-24"].map((w, i) => (
            <Skeleton key={i} className={`h-8 shrink-0 rounded-full ${w}`} />
          ))}
        </div>

        <div className="px-4 py-4 lg:px-6 lg:py-6">
          <Skeleton className="mx-auto h-[420px] w-full rounded-card sm:max-w-md" />
        </div>
      </div>
    </SkeletonScreen>
  );
}

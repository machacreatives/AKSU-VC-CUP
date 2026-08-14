import Link from "next/link";

/**
 * What a viewer sees when the match they asked for is not there.
 *
 * Reached two ways, which is why it is a component rather than a page: opening
 * a link to a fixture that has since been removed, and — the one that actually
 * happens — sitting on a live match when the organisers delete it, where the
 * page would otherwise just stop updating with no explanation at all.
 *
 * Deliberately not an error. From the viewer's side nothing has gone wrong;
 * the fixture is simply gone, and the useful thing is the way back to what is
 * still on.
 */
export default function MatchGone({
  reason = "removed",
}: {
  /** "removed" if it vanished while being watched, "missing" on a stale link. */
  reason?: "removed" | "missing";
}) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-16 text-center lg:py-24">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-line bg-surface2">
        {/* A crossed-out whistle would be cute and unreadable at this size. */}
        <span className="text-[26px] leading-none" aria-hidden>
          🗓
        </span>
      </div>

      <h1 className="text-[20px] font-extrabold text-white lg:text-[24px]">
        {reason === "removed" ? "This match is no longer listed" : "Match not found"}
      </h1>

      <p className="mt-2 text-[14px] leading-relaxed text-white/70 lg:text-[15px]">
        {reason === "removed"
          ? "The organisers removed this fixture while you were watching. Its score and events are no longer part of the tournament."
          : "This fixture has been removed, or the link is out of date. It may have been rescheduled under a new entry."}
      </p>

      {/* One destination, one button. Two of them both pointing at the home
          page is a choice that isn't a choice. */}
      <Link
        href="/"
        className="mt-6 rounded-[8px] bg-accent px-5 py-2.5 text-[13.5px] font-bold text-white transition-colors hover:bg-accent/90"
      >
        See the live scores
      </Link>

      <p className="mt-6 text-[12.5px] text-white/50">
        The fixture list on the home page is always the current one.
      </p>
    </div>
  );
}
